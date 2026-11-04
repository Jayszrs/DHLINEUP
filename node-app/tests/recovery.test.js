import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { database,initialize,one } from '../backend/src/db.js';
import { createApp } from '../backend/src/app.js';
import { Auth,passwordMatches } from '../backend/src/auth.js';

const token=response=>response.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
const code=response=>response.text.match(/id="recovery-code" readonly value="([A-F0-9-]+)"/)?.[1];
const password='Recovery-Test-Original-2026',replacement='Recovery-Test-Replaced-2026';

test('short login cooldown and single-use account recovery',async t=>{
  const db=await database({dataDir:null});await initialize(db);
  const app=createApp({db}),owner=request.agent(app),otherDevice=request.agent(app),guest=request.agent(app);
  let csrf,recoveryCode,oldCode;
  try {
    csrf=token(await owner.get('/setup'));
    assert.equal((await owner.post('/setup').type('form').send({csrf,name:'Recovery Owner',username:'recovery.owner',password,password_confirmation:password})).status,303);
    csrf=token(await owner.get('/profile'));
    await t.test('recovery is reachable from login and code generation requires current owner password',async()=>{
      assert.ok((await guest.get('/login')).text.includes('href="/forgot-password"'));
      const forgot=await guest.get('/forgot-password');assert.equal(forgot.status,200);assert.ok(forgot.text.includes('autocomplete="new-password"'));
      assert.equal((await guest.post('/recovery-create').type('form').send({csrf:token(forgot),current_password:password})).headers.location,'/login');
      assert.equal((await owner.post('/recovery-create').type('form').send({csrf:'bad',current_password:password})).status,419);
      assert.equal((await owner.post('/recovery-create').type('form').send({csrf,current_password:'wrong'})).status,422);
      assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.password_recovery')).n),0);
      const result=await owner.post('/recovery-create').type('form').send({csrf,current_password:password});
      assert.equal(result.status,200);recoveryCode=code(result);assert.match(recoveryCode,/^(?:[A-F0-9]{4}-){7}[A-F0-9]{4}$/);
      assert.match(result.headers['cache-control'],/no-store/);
      const row=await one(db,'SELECT * FROM fleetsync.password_recovery WHERE user_id=1');
      assert.equal(row.code_hash,createHash('sha256').update('1:'+recoveryCode.replaceAll('-','').toLowerCase()).digest('hex'));
      assert.ok(!JSON.stringify(row).includes(recoveryCode));
      assert.ok(!(await owner.get('/profile')).text.includes(recoveryCode));
      assert.ok((await owner.get('/profile')).text.includes('Kode pemulihan sudah aktif'));
      assert.ok(!(await owner.get('/audit')).text.includes(recoveryCode));
      oldCode=recoveryCode;
      recoveryCode=code(await owner.post('/recovery-create').type('form').send({csrf,current_password:password}));assert.notEqual(recoveryCode,oldCode);
      const loginToken=token(await otherDevice.get('/login'));
      assert.equal((await otherDevice.post('/login').type('form').send({csrf:loginToken,username:'recovery.owner',password})).status,303);
    });
    await t.test('failed recovery does not change password or expose account existence',async()=>{
      const recoveryToken=token(await guest.get('/forgot-password'));
      const data={csrf:recoveryToken,username:'recovery.owner',recovery_code:oldCode,password:replacement,password_confirmation:replacement};
      const invalid=await guest.post('/forgot-password').type('form').send(data);assert.equal(invalid.status,422);
      const missing=await guest.post('/forgot-password').type('form').send({...data,username:'does-not-exist'});assert.equal(missing.status,422);
      const message='Username atau kode pemulihan tidak cocok, atau kode sudah digunakan.';
      assert.ok(invalid.text.includes(message));assert.ok(missing.text.includes(message));
      assert.ok(!invalid.text.includes(oldCode));assert.ok(!invalid.text.includes(replacement));
      assert.equal(await passwordMatches(password,(await one(db,'SELECT password_hash FROM fleetsync.users WHERE id=1')).password_hash),true);
      assert.equal((await otherDevice.get('/profile')).status,200);
      assert.equal((await guest.post('/forgot-password').type('form').send({...data,recovery_code:recoveryCode,csrf:'bad'})).status,419);
      assert.equal((await guest.post('/forgot-password').type('form').send({...data,recovery_code:recoveryCode,password_confirmation:'different'})).status,422);
    });
    await t.test('cooldown is scoped to username and connection with a real remaining time',async()=>{
      const auth=new Auth(db),loginToken=token(await guest.get('/login'));
      await db.query('INSERT INTO fleetsync.login_attempts(attempt_key,attempts) VALUES($1,99)',['login:legacy']);
      for(let i=0;i<5;i++) assert.equal((await guest.post('/login').type('form').send({csrf:loginToken,username:'recovery.owner',password:'wrong'})).status,422);
      const blocked=await guest.post('/login').type('form').send({csrf:loginToken,username:'RECOVERY.OWNER',password});
      assert.equal(blocked.status,429);assert.ok(Number(blocked.headers['retry-after'])>0&&Number(blocked.headers['retry-after'])<=30);
      assert.ok(blocked.text.includes('data-retry-after'));assert.ok(!blocked.text.includes('15 menit'));
      const another=request.agent(app),anotherToken=token(await another.get('/login'));
      assert.equal((await another.post('/login').type('form').send({csrf:anotherToken,username:'RECOVERY.OWNER',password})).status,429);
      assert.equal((await another.post('/login').type('form').send({csrf:anotherToken,username:'unrelated-user',password:'wrong'})).status,422);
      assert.notEqual(auth.attemptKey({ip:'10.1.1.1'},'login','recovery.owner'),auth.attemptKey({ip:'10.1.1.2'},'login','recovery.owner'));
      assert.equal(auth.attemptKey({ip:'10.1.1.1'},'login','recovery.owner'),auth.attemptKey({ip:'10.1.1.1'},'login','RECOVERY.OWNER'));
      await db.query("UPDATE fleetsync.login_attempts SET last_attempt=now()-interval '20 seconds' WHERE attempts>=5");
      const remaining=await guest.post('/login').type('form').send({csrf:loginToken,username:'recovery.owner',password});
      assert.equal(remaining.status,429);assert.ok(Number(remaining.headers['retry-after'])<=10);
      await db.query("UPDATE fleetsync.login_attempts SET last_attempt=now()-interval '31 seconds' WHERE attempts>=5");
      const recovered=request.agent(app),recoveredToken=token(await recovered.get('/login'));
      assert.equal((await recovered.post('/login').type('form').send({csrf:recoveredToken,username:'recovery.owner',password})).status,303);
      assert.equal((await recovered.get('/profile')).status,200);
      for(let i=0;i<5;i++) await guest.post('/login').type('form').send({csrf:loginToken,username:'recovery.owner',password:'wrong'});
    });
    await t.test('recovery bypasses login cooldown, revokes sessions and consumes the code atomically',async()=>{
      const recoveryToken=token(await guest.get('/forgot-password'));
      const data={csrf:recoveryToken,username:'RECOVERY.OWNER',recovery_code:recoveryCode.toLowerCase(),password:replacement,password_confirmation:replacement};
      const results=await Promise.all([guest.post('/forgot-password').type('form').send(data),guest.post('/forgot-password').type('form').send(data)]);
      assert.deepEqual(results.map(r=>r.status).sort(),[303,422]);
      assert.equal(results.find(r=>r.status===303).headers.location,'/login');
      assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.password_recovery')).n),0);
      assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.sessions WHERE user_id=1')).n),0);
      assert.equal((await otherDevice.get('/profile')).headers.location,'/login');
      assert.equal((await owner.get('/profile')).headers.location,'/login');
      const fresh=request.agent(app),login=await fresh.get('/login');
      assert.equal((await fresh.post('/login').type('form').send({csrf:token(login),username:'recovery.owner',password:replacement})).status,303);
      const profile=await fresh.get('/profile');assert.equal(profile.status,200);assert.ok(profile.text.includes('Belum ada kode pemulihan'));
      const user=await one(db,'SELECT password_hash FROM fleetsync.users WHERE id=1');assert.equal(await passwordMatches(password,user.password_hash),false);
      const audits=JSON.stringify((await db.query('SELECT * FROM fleetsync.audit_logs')).rows);assert.ok(audits.includes('password_reset'));assert.ok(!audits.includes(recoveryCode));assert.ok(!audits.includes(replacement));
      const retry=request.agent(app),retryToken=token(await retry.get('/forgot-password'));
      assert.equal((await retry.post('/forgot-password').type('form').send({...data,csrf:retryToken})).status,422);
    });
  } finally {await db.close();}
});
