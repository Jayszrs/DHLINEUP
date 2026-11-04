import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../backend/src/app.js';
import { database,initialize,one } from '../backend/src/db.js';
import { accountVersion } from '../backend/src/auth.js';
import { Mailer } from '../backend/src/mail.js';

const token=response=>response.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
const adminPassword='Admin-Role-Test-2026',memberPassword='Member-Role-Test-2026';
test('administrator edits profiles and roles while retaining at least one administrator',async t=>{
  const db=await database({dataDir:null});await initialize(db);
  const app=createApp({db,mailer:new Mailer({})}),admin=request.agent(app),member=request.agent(app),guest=request.agent(app);
  const login=async(agent,username,password)=>{const csrf=token(await agent.get('/login'));return agent.post('/login').type('form').send({csrf,username,password});};
  const payload=async(id,overrides={})=>{
    const row=await one(db,'SELECT id,name,username,is_admin FROM fleetsync.users WHERE id=$1',[id]);
    return {id,name:row.name,username:row.username,role:row.is_admin?'Administrator':'Pengelola',account_version:accountVersion(row),current_password:adminPassword,...overrides};
  };
  let adminToken,memberToken;
  try {
    const setup=await admin.get('/setup');await admin.post('/setup').type('form').send({csrf:token(setup),name:'Admin',username:'admin',password:adminPassword,password_confirmation:adminPassword});
    adminToken=token(await admin.get('/accounts'));await admin.post('/account-create').type('form').send({csrf:adminToken,name:'Member',username:'member',password:memberPassword,password_confirmation:memberPassword,current_password:adminPassword});
    await login(member,'member',memberPassword);memberToken=token(await member.get('/profile'));
    await t.test('edit form is administrator-only and rejects CSRF and wrong administrator password',async()=>{
      assert.equal((await guest.get('/account-edit?id=2')).headers.location,'/login');assert.equal((await member.get('/account-edit?id=1')).status,403);
      assert.equal((await member.post('/account-update').type('form').send({...await payload(2),csrf:memberToken,role:'Administrator',current_password:memberPassword})).status,403);
      assert.equal((await admin.get('/account-edit?id=999')).status,404);assert.equal((await admin.get('/account-edit?id=2')).status,200);
      assert.ok((await admin.get('/accounts')).text.includes('Edit profil &amp; role'));assert.ok(!(await member.get('/accounts')).text.includes('Edit profil &amp; role'));
      const data=await payload(2,{name:'Unsaved'});
      assert.equal((await admin.post('/account-update').type('form').send({...data,csrf:'invalid'})).status,419);
      assert.equal((await admin.post('/account-update').type('form').send({...data,csrf:adminToken,account_version:'é'.repeat(64)})).status,422);
      const result=await admin.post('/account-update').type('form').send({...data,csrf:adminToken,current_password:'wrong'});assert.equal(result.status,422);assert.ok(!result.text.includes('value="wrong"'));
      assert.equal((await one(db,'SELECT name FROM fleetsync.users WHERE id=2')).name,'Member');
    });
    await t.test('name and username changes are validated and version conflicts preserve newer changes',async()=>{
      const original=await payload(2),data={...original,csrf:adminToken,name:'Updated <Member>',username:'member.updated'};
      const before=(await one(db,'SELECT password_hash FROM fleetsync.users WHERE id=2')).password_hash;
      assert.equal((await admin.post('/account-update').type('form').send({...data,username:'admin'})).status,409);
      assert.equal((await admin.post('/account-update').type('form').send({...data,role:'root'})).status,422);
      assert.equal((await admin.post('/account-update').type('form').send(data)).status,303);
      const row=await one(db,'SELECT * FROM fleetsync.users WHERE id=2');assert.equal(row.name,'Updated <Member>');assert.equal(row.username,'member.updated');assert.equal(row.is_admin,false);assert.equal(row.password_hash,before);
      assert.equal((await member.get('/profile')).headers.location,'/login');
      assert.ok((await admin.get('/accounts')).text.includes('Updated &lt;Member&gt;'));
      const stale=await admin.post('/account-update').type('form').send({...original,csrf:adminToken,name:'Stale overwrite'});assert.equal(stale.status,409);assert.ok(stale.text.includes('Muat ulang halaman'));
      assert.equal((await one(db,'SELECT name FROM fleetsync.users WHERE id=2')).name,'Updated <Member>');
    });
    await t.test('last administrator cannot be demoted and users cannot forge their own role',async()=>{
      const data={...await payload(1,{role:'Pengelola'}),csrf:adminToken};
      const result=await admin.post('/account-update').type('form').send(data);assert.equal(result.status,409);assert.ok(result.text.includes('Administrator terakhir'));
      assert.equal((await one(db,'SELECT is_admin FROM fleetsync.users WHERE id=1')).is_admin,true);
      await login(member,'member.updated',memberPassword);memberToken=token(await member.get('/profile'));
      await member.post('/profile-save').type('form').send({csrf:memberToken,name:'Updated <Member>',username:'member.updated',is_admin:true,role:'Administrator'});
      assert.equal((await one(db,'SELECT is_admin FROM fleetsync.users WHERE id=2')).is_admin,false);
    });
    await t.test('promotion and demotion revoke target sessions and take effect on next login',async()=>{
      const promoted=await admin.post('/account-update').type('form').send({...await payload(2,{role:'Administrator'}),csrf:adminToken});assert.equal(promoted.status,303);
      assert.equal((await member.get('/account-edit?id=1')).headers.location,'/login');await login(member,'member.updated',memberPassword);memberToken=token(await member.get('/accounts'));
      assert.equal((await member.get('/account-edit?id=1')).status,200);
      assert.equal((await admin.post('/account-update').type('form').send({...await payload(2,{role:'Pengelola'}),csrf:adminToken})).status,303);
      assert.equal((await member.post('/account-update').type('form').send({...await payload(1),csrf:memberToken,current_password:memberPassword})).headers.location,'/login');
      await login(member,'member.updated',memberPassword);assert.equal((await member.get('/account-edit?id=1')).status,403);
      const audit=JSON.stringify((await db.query("SELECT * FROM fleetsync.audit_logs WHERE action='account_update'")).rows);assert.ok(audit.includes('Administrator'));assert.ok(audit.includes('Pengelola'));assert.ok(!audit.includes(adminPassword));assert.ok(!audit.includes('password_hash'));
    });
    await t.test('concurrent self-demotions cannot remove every administrator',async()=>{
      await admin.post('/account-update').type('form').send({...await payload(2,{role:'Administrator'}),csrf:adminToken});
      await login(member,'member.updated',memberPassword);memberToken=token(await member.get('/accounts'));
      const first={...await payload(1,{role:'Pengelola'}),csrf:adminToken},second={...await payload(2,{role:'Pengelola',current_password:memberPassword}),csrf:memberToken};
      const results=await Promise.all([admin.post('/account-update').type('form').send(first),member.post('/account-update').type('form').send(second)]);
      assert.deepEqual(results.map(result=>result.status).sort(),[303,409]);assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.users WHERE is_admin')).n),1);
      const demoted=results[0].status===303?admin:member;assert.equal(results.find(result=>result.status===303).headers.location,'/login');assert.equal((await demoted.get('/accounts')).headers.location,'/login');
    });
  } finally {await db.close();}
});
