import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../backend/src/app.js';
import { database,initialize,one } from '../backend/src/db.js';
import { passwordMatches } from '../backend/src/auth.js';
import { Mailer } from '../backend/src/mail.js';

const token=response=>response.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
const adminPassword='Admin-Original-2026',operatorPassword='Operator-Original-2026',temporary='Temporary-Reset-2026',newPassword='User-New-Password-2026';
test('administrator assistance, required password change and profile editing',async t=>{
  const db=await database({dataDir:null});await initialize(db);
  const app=createApp({db,mailer:new Mailer({})}),admin=request.agent(app),operator=request.agent(app),secondDevice=request.agent(app),guest=request.agent(app);
  let adminToken,operatorToken;
  const login=async(agent,username,password)=>{const form=await agent.get('/login');return agent.post('/login').type('form').send({csrf:token(form),username,password});};
  try {
    const setup=await admin.get('/setup');await admin.post('/setup').type('form').send({csrf:token(setup),name:'Test Administrator',username:'admin',password:adminPassword,password_confirmation:adminPassword});
    adminToken=token(await admin.get('/accounts'));
    await admin.post('/account-create').type('form').send({csrf:adminToken,name:'Test Operator',username:'operator',password:operatorPassword,password_confirmation:operatorPassword,current_password:adminPassword,is_admin:true});
    assert.equal((await login(operator,'operator',operatorPassword)).status,303);assert.equal((await login(secondDevice,'operator',operatorPassword)).status,303);operatorToken=token(await operator.get('/profile'));
    await t.test('only the administrator can access account reset; profile cannot promote an account',async()=>{
      assert.equal((await one(db,'SELECT is_admin FROM fleetsync.users WHERE id=1')).is_admin,true);assert.equal((await one(db,'SELECT is_admin FROM fleetsync.users WHERE id=2')).is_admin,false);
      const help=await guest.get('/forgot-password');assert.equal(help.status,200);assert.ok(help.text.includes('administrator OCC'));assert.ok(!help.text.includes('Kirim kode reset'));
      assert.equal((await guest.get('/account-reset?id=2')).headers.location,'/login');assert.equal((await operator.get('/account-reset?id=1')).status,403);
      assert.equal((await operator.post('/account-password-reset').type('form').send({csrf:operatorToken,id:1,current_password:operatorPassword,password:temporary,password_confirmation:temporary,is_admin:true})).status,403);
      assert.equal((await operator.post('/profile-save').type('form').send({csrf:operatorToken,name:'Updated Operator',username:'operator.updated',id:1,is_admin:true})).status,303);
      const profile=await operator.get('/profile');assert.ok(profile.text.includes('Updated Operator'));assert.ok(profile.text.includes('Ganti password'));
      assert.equal((await one(db,'SELECT name,is_admin FROM fleetsync.users WHERE id=2')).is_admin,false);assert.equal((await one(db,'SELECT username FROM fleetsync.users WHERE id=1')).username,'admin');
      assert.equal((await admin.get('/account-reset?id=1')).headers.location,'/profile#password-title');assert.equal((await admin.get('/account-reset?id=999')).status,404);
    });
    await t.test('self-service password change validates current password, confirmation and CSRF',async()=>{
      const data={csrf:operatorToken,current_password:'wrong',password:newPassword,password_confirmation:newPassword};
      assert.equal((await operator.post('/password-change').type('form').send({...data,csrf:'bad'})).status,419);assert.equal((await operator.post('/password-change').type('form').send(data)).status,422);
      assert.equal((await operator.post('/password-change').type('form').send({...data,current_password:operatorPassword,password_confirmation:'different'})).status,422);
      assert.equal((await operator.post('/password-change').type('form').send({...data,current_password:operatorPassword,password:operatorPassword,password_confirmation:operatorPassword})).status,422);
      assert.equal((await secondDevice.get('/lineup')).status,200);assert.equal(await passwordMatches(operatorPassword,(await one(db,'SELECT password_hash FROM fleetsync.users WHERE id=2')).password_hash),true);
    });
    await t.test('administrator reset needs own password and revokes only target credentials',async()=>{
      const data={csrf:adminToken,id:2,current_password:'wrong',password:temporary,password_confirmation:temporary};
      assert.equal((await admin.post('/account-password-reset').type('form').send({...data,csrf:'bad'})).status,419);
      const bad=await admin.post('/account-password-reset').type('form').send(data);assert.equal(bad.status,422);assert.ok(!bad.text.includes(temporary));
      assert.equal((await admin.post('/account-password-reset').type('form').send({...data,current_password:adminPassword,password_confirmation:'different'})).status,422);
      assert.equal((await admin.post('/account-password-reset').type('form').send({...data,current_password:adminPassword,id:1})).status,422);
      const result=await admin.post('/account-password-reset').type('form').send({...data,current_password:adminPassword});assert.equal(result.status,303);assert.equal(result.headers.location,'/accounts');
      const target=await one(db,'SELECT password_hash,must_change_password FROM fleetsync.users WHERE id=2');assert.equal(target.must_change_password,true);assert.equal(await passwordMatches(temporary,target.password_hash),true);
      assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.sessions WHERE user_id=2')).n),0);assert.equal((await operator.get('/lineup')).headers.location,'/login');assert.equal((await secondDevice.get('/profile')).headers.location,'/login');assert.equal((await admin.get('/lineup')).status,200);
      const audits=JSON.stringify((await db.query('SELECT * FROM fleetsync.audit_logs')).rows);assert.ok(audits.includes('account_password_reset'));assert.ok(!audits.includes(temporary));assert.ok(!audits.includes(adminPassword));
    });
    await t.test('temporary password grants only password change and logout until replaced',async()=>{
      assert.equal((await login(operator,'operator.updated',temporary)).status,303);assert.equal((await operator.get('/lineup')).headers.location,'/profile');
      const profile=await operator.get('/profile');operatorToken=token(profile);assert.ok(profile.text.includes('password sementara'));assert.ok(!profile.text.includes('Simpan profil'));
      assert.equal((await operator.get('/export')).headers.location,'/profile');assert.equal((await operator.get('/accounts')).headers.location,'/profile');
      assert.equal((await operator.post('/profile-save').type('form').send({csrf:operatorToken,name:'Must not save',username:'tampered'})).headers.location,'/profile');
      assert.equal((await operator.post('/upload-ticket').send({csrf:operatorToken})).status,403);
      const result=await operator.post('/password-change').type('form').send({csrf:operatorToken,current_password:temporary,password:newPassword,password_confirmation:newPassword,id:1});assert.equal(result.status,303);assert.equal(result.headers.location,'/login');
      assert.equal((await operator.get('/lineup')).headers.location,'/login');assert.equal((await one(db,'SELECT must_change_password FROM fleetsync.users WHERE id=2')).must_change_password,false);
      assert.equal(await passwordMatches(adminPassword,(await one(db,'SELECT password_hash FROM fleetsync.users WHERE id=1')).password_hash),true);
      assert.equal((await login(operator,'operator.updated',temporary)).status,422);assert.equal((await login(operator,'operator.updated',newPassword)).status,303);assert.equal((await operator.get('/lineup')).status,200);
      assert.equal((await one(db,'SELECT name FROM fleetsync.users WHERE id=2')).name,'Updated Operator');
    });
    await t.test('password changes also revoke other sessions for an unrestricted user',async()=>{
      await login(secondDevice,'operator.updated',newPassword);operatorToken=token(await operator.get('/profile'));
      const finalPassword='Final-Private-Password-2026';assert.equal((await operator.post('/password-change').type('form').send({csrf:operatorToken,current_password:newPassword,password:finalPassword,password_confirmation:finalPassword})).status,303);
      assert.equal((await secondDevice.get('/profile')).headers.location,'/login');assert.equal((await login(operator,'operator.updated',finalPassword)).status,303);
      const audits=JSON.stringify((await db.query('SELECT * FROM fleetsync.audit_logs')).rows);assert.ok(audits.includes('password_change'));assert.ok(!audits.includes(finalPassword));
    });
  } finally {await db.close();}
});
