import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { database,initialize,one } from '../backend/src/db.js';
import { createApp } from '../backend/src/app.js';
import { Auth,passwordMatches } from '../backend/src/auth.js';
import { Mailer } from '../backend/src/mail.js';
import { HttpError } from '../backend/src/validation.js';

const token=response=>response.text.match(/name="csrf" value="([a-f0-9]{64})"/)?.[1];
const password='Recovery-Test-Original-2026',replacement='Recovery-Test-Replaced-2026',email='owner@example.test';

test('short login cooldown and verified email recovery',async t=>{
  const db=await database({dataDir:null});await initialize(db);
  const outbox=[],mail={ready:true,fail:false,async send(message){if(this.fail) throw new HttpError(503,'Mail test failed');outbox.push(message);}};
  const app=createApp({db,mailer:mail}),owner=request.agent(app),other=request.agent(app),guest=request.agent(app);
  let csrf,resetCode;
  const sendReset=async()=>{
    await db.query("DELETE FROM fleetsync.login_attempts WHERE attempt_key LIKE 'email-request%'");
    const form=await guest.get('/forgot-password');
    return guest.post('/forgot-password').type('form').send({csrf:token(form),username:'recovery.owner',email});
  };
  try {
    csrf=token(await owner.get('/setup'));
    assert.equal((await owner.post('/setup').type('form').send({csrf,name:'Recovery Owner',username:'recovery.owner',password,password_confirmation:password})).status,303);
    csrf=token(await owner.get('/profile'));
    await t.test('mailbox registration requires password, CSRF and one-time email verification',async()=>{
      assert.ok((await guest.get('/login')).text.includes('href="/forgot-password"'));
      const form=await guest.get('/forgot-password');assert.equal(form.status,200);
      assert.equal((await guest.post('/recovery-email-save').type('form').send({csrf:token(form),email,current_password:password})).headers.location,'/login');
      assert.equal((await owner.post('/recovery-email-save').type('form').send({csrf:'bad',email,current_password:password})).status,419);
      assert.equal((await owner.post('/recovery-email-save').type('form').send({csrf,email,current_password:'wrong'})).status,422);assert.equal(outbox.length,0);
      assert.equal((await owner.post('/recovery-email-save').type('form').send({csrf,email,current_password:password})).status,303);
      assert.equal(outbox[0].to,email);assert.equal(outbox[0].purpose,'verify');assert.match(outbox[0].code,/^(?:[A-F0-9]{4}-){3}[A-F0-9]{4}$/);
      let row=await one(db,'SELECT * FROM fleetsync.email_recovery WHERE user_id=1');assert.equal(row.email,null);assert.equal(row.pending_email,email);assert.ok(!JSON.stringify(row).includes(outbox[0].code));
      const profile=await owner.get('/profile');assert.ok(profile.text.includes('Verifikasi email'));assert.ok(!profile.text.includes(outbox[0].code));
      assert.equal((await owner.post('/recovery-email-verify').type('form').send({csrf,recovery_code:'wrong'})).status,422);
      assert.equal((await owner.post('/recovery-email-verify').type('form').send({csrf,recovery_code:outbox[0].code.toLowerCase()})).status,303);
      assert.equal((await owner.post('/recovery-email-verify').type('form').send({csrf,recovery_code:outbox[0].code})).status,422);
      row=await one(db,'SELECT * FROM fleetsync.email_recovery WHERE user_id=1');assert.equal(row.email,email);assert.equal(row.verify_hash,null);
      const loginToken=token(await other.get('/login'));assert.equal((await other.post('/login').type('form').send({csrf:loginToken,username:'recovery.owner',password})).status,303);
    });
    await t.test('requests are generic, delivery-limited and target only a verified mailbox',async()=>{
      const before=outbox.length,form=await guest.get('/forgot-password');
      assert.equal((await guest.post('/forgot-password').type('form').send({csrf:token(form),username:'recovery.owner',email:'attacker@example.test'})).status,303);assert.equal(outbox.length,before);
      assert.ok((await guest.get('/reset-password')).text.includes('Jika username dan email cocok'));
      assert.equal((await sendReset()).status,303);assert.equal(outbox.length,before+1);assert.equal(outbox.at(-1).purpose,'reset');resetCode=outbox.at(-1).code;
      const again=token(await guest.get('/forgot-password'));await guest.post('/forgot-password').type('form').send({csrf:again,username:'recovery.owner',email});assert.equal(outbox.length,before+1);
      const row=await one(db,'SELECT * FROM fleetsync.email_recovery WHERE user_id=1');assert.ok(row.reset_hash);assert.ok(!JSON.stringify(row).includes(resetCode));assert.ok(!(await owner.get('/audit')).text.includes(resetCode));
    });
    await t.test('invalid, expired and superseded codes preserve the password and sessions',async()=>{
      const data={csrf:token(await guest.get('/reset-password')),username:'recovery.owner',email,recovery_code:'wrong',password:replacement,password_confirmation:replacement};
      const invalid=await guest.post('/reset-password').type('form').send(data),missing=await guest.post('/reset-password').type('form').send({...data,username:'missing-user'});
      assert.equal(invalid.status,422);assert.equal(missing.status,422);const message='Kode tidak cocok, sudah digunakan, atau sudah kedaluwarsa.';assert.ok(invalid.text.includes(message));assert.ok(missing.text.includes(message));assert.ok(!invalid.text.includes(replacement));
      assert.equal((await guest.post('/reset-password').type('form').send({...data,csrf:'bad',recovery_code:resetCode})).status,419);
      assert.equal((await guest.post('/reset-password').type('form').send({...data,recovery_code:resetCode,password_confirmation:'different'})).status,422);
      await db.query("UPDATE fleetsync.email_recovery SET reset_expires_at=now()-interval '1 second'");
      assert.equal((await guest.post('/reset-password').type('form').send({...data,recovery_code:resetCode})).status,422);
      await sendReset();const next=outbox.at(-1).code;assert.equal((await guest.post('/reset-password').type('form').send({...data,recovery_code:resetCode})).status,422);resetCode=next;
      assert.equal(await passwordMatches(password,(await one(db,'SELECT password_hash FROM fleetsync.users WHERE id=1')).password_hash),true);assert.equal((await other.get('/profile')).status,200);
    });
    await t.test('cooldown is 30 seconds per username and connection and ignores old locks',async()=>{
      const auth=new Auth(db),loginToken=token(await guest.get('/login'));
      await db.query('INSERT INTO fleetsync.login_attempts(attempt_key,attempts) VALUES($1,99)',['login:legacy']);
      for(let i=0;i<5;i++) assert.equal((await guest.post('/login').type('form').send({csrf:loginToken,username:'recovery.owner',password:'wrong'})).status,422);
      const blocked=await guest.post('/login').type('form').send({csrf:loginToken,username:'RECOVERY.OWNER',password});assert.equal(blocked.status,429);assert.ok(Number(blocked.headers['retry-after'])>0&&Number(blocked.headers['retry-after'])<=30);assert.ok(blocked.text.includes('data-retry-after'));assert.ok(!blocked.text.includes('15 menit'));
      const another=request.agent(app),anotherToken=token(await another.get('/login'));assert.equal((await another.post('/login').type('form').send({csrf:anotherToken,username:'RECOVERY.OWNER',password})).status,429);
      assert.equal((await another.post('/login').type('form').send({csrf:anotherToken,username:'unrelated-user',password:'wrong'})).status,422);
      assert.notEqual(auth.attemptKey({ip:'10.1.1.1'},'login','recovery.owner'),auth.attemptKey({ip:'10.1.1.2'},'login','recovery.owner'));
      await db.query("UPDATE fleetsync.login_attempts SET last_attempt=now()-interval '20 seconds' WHERE attempts>=5");
      const remaining=await guest.post('/login').type('form').send({csrf:loginToken,username:'recovery.owner',password});assert.equal(remaining.status,429);assert.ok(Number(remaining.headers['retry-after'])<=10);
      await db.query("UPDATE fleetsync.login_attempts SET last_attempt=now()-interval '31 seconds' WHERE attempts>=5");assert.equal((await another.post('/login').type('form').send({csrf:anotherToken,username:'recovery.owner',password})).status,303);
      for(let i=0;i<5;i++) await guest.post('/login').type('form').send({csrf:loginToken,username:'recovery.owner',password:'wrong'});
    });
    await t.test('reset works during cooldown, revokes all sessions and consumes the code atomically',async()=>{
      const data={csrf:token(await guest.get('/reset-password')),username:'RECOVERY.OWNER',email,recovery_code:resetCode.toLowerCase(),password:replacement,password_confirmation:replacement};
      const results=await Promise.all([guest.post('/reset-password').type('form').send(data),guest.post('/reset-password').type('form').send(data)]);assert.deepEqual(results.map(r=>r.status).sort(),[303,422]);assert.equal(results.find(r=>r.status===303).headers.location,'/login');
      assert.equal((await one(db,'SELECT reset_hash FROM fleetsync.email_recovery WHERE user_id=1')).reset_hash,null);assert.equal(Number((await one(db,'SELECT count(*) AS n FROM fleetsync.sessions WHERE user_id=1')).n),0);
      assert.equal((await other.get('/profile')).headers.location,'/login');assert.equal((await owner.get('/profile')).headers.location,'/login');
      const fresh=request.agent(app),login=await fresh.get('/login');assert.equal((await fresh.post('/login').type('form').send({csrf:token(login),username:'recovery.owner',password:replacement})).status,303);assert.equal((await fresh.get('/profile')).status,200);
      assert.equal(await passwordMatches(password,(await one(db,'SELECT password_hash FROM fleetsync.users WHERE id=1')).password_hash),false);
      const audits=JSON.stringify((await db.query('SELECT * FROM fleetsync.audit_logs')).rows);assert.ok(audits.includes('password_reset'));assert.ok(!audits.includes(resetCode));assert.ok(!audits.includes(replacement));
    });
    await t.test('missing and failing SMTP never activate an unverified email',async()=>{
      assert.equal(new Mailer({}).ready,false);
      const disabled=request.agent(createApp({db,mailer:new Mailer({})})),form=await disabled.get('/forgot-password');assert.ok(form.text.includes('administrator DHOCC'));assert.ok(!form.text.includes('Kirim kode reset'));assert.equal((await disabled.get('/reset-password')).headers.location,'/forgot-password');const disabledToken=token(await disabled.get('/login'));assert.equal((await disabled.post('/forgot-password').type('form').send({csrf:disabledToken,username:'recovery.owner',email})).status,503);
      const fresh=request.agent(app),login=await fresh.get('/login');await fresh.post('/login').type('form').send({csrf:token(login),username:'recovery.owner',password:replacement});
      await db.query("DELETE FROM fleetsync.login_attempts WHERE attempt_key LIKE 'email-enroll%'");mail.fail=true;
      const profileToken=token(await fresh.get('/profile'));assert.equal((await fresh.post('/recovery-email-save').type('form').send({csrf:profileToken,email:'replacement@example.test',current_password:replacement})).status,503);
      const settings=await one(db,'SELECT * FROM fleetsync.email_recovery WHERE user_id=1');assert.equal(settings.email,email);assert.equal(settings.pending_email,null);
    });
  } finally {await db.close();}
});
