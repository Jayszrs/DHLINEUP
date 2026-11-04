import { createHash, randomBytes } from 'node:crypto';
import { one, audit } from './db.js';
import { equal, passwordMatches } from './auth.js';
import { HttpError, newPassword, text } from './validation.js';
import bcrypt from 'bcryptjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const makeCode = () => randomBytes(8).toString('hex');
const pretty = code => code.toUpperCase().match(/.{4}/g).join('-');
const normalizeCode = input => text(input, 'recovery_code', 80, true).replace(/[\s-]/g, '').toLowerCase();
const invalid = () => new HttpError(422, 'Kode tidak cocok, sudah digunakan, atau sudah kedaluwarsa.');
export function emailAddress(input) {
  const email = text(input, 'email', 254, true).toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(email)) throw new HttpError(422, 'Masukkan alamat email yang valid.');
  return email;
}

export class Recovery {
  constructor(db, auth, mail) { this.db = db; this.auth = auth; this.mail = mail; }
  requireMail() { if (!this.mail.ready) throw new HttpError(503, 'Pengiriman email belum aktif. Hubungi pengelola aplikasi.'); }
  async settings(userId) {
    return await one(this.db, 'SELECT email,pending_email,verify_expires_at FROM fleetsync.email_recovery WHERE user_id=$1', [userId]) || {};
  }
  async deliveryLimit(key) {
    const row = await one(this.db, "INSERT INTO fleetsync.login_attempts(attempt_key,attempts) VALUES($1,1) ON CONFLICT(attempt_key) DO UPDATE SET attempts=1,last_attempt=now() WHERE fleetsync.login_attempts.last_attempt<=now()-interval '60 seconds' RETURNING attempt_key", [key]);
    return Boolean(row);
  }
  async enroll(req) {
    this.requireMail();
    const email = emailAddress(req.body),key = this.auth.attemptKey(req, `reauth-${req.user.id}`);
    await this.auth.checkAttempts(key);
    const owner = await one(this.db, 'SELECT password_hash FROM fleetsync.users WHERE id=$1', [req.user.id]);
    if (!owner || !await passwordMatches(text(req.body, 'current_password', 128, true), owner.password_hash)) {
      await this.auth.failAttempt(key);throw new HttpError(422, 'Password Anda belum cocok. Email pemulihan belum diubah.');
    }
    if (!await this.deliveryLimit(`email-enroll:${req.user.id}`)) throw new HttpError(429, 'Kode baru saja dikirim. Tunggu 60 detik sebelum meminta kode lain.');
    const code = makeCode(),hash = digest(`${req.user.id}:verify:${code}`);
    await this.db.transaction(async tx => {
      const current = await one(tx, 'SELECT password_hash FROM fleetsync.users WHERE id=$1 FOR UPDATE', [req.user.id]);
      if (!current || current.password_hash !== owner.password_hash) throw new HttpError(409, 'Password baru saja berubah. Masuk kembali lalu coba lagi.');
      await tx.query("INSERT INTO fleetsync.email_recovery(user_id,pending_email,verify_hash,verify_expires_at) VALUES($1,$2,$3,now()+interval '10 minutes') ON CONFLICT(user_id) DO UPDATE SET pending_email=excluded.pending_email,verify_hash=excluded.verify_hash,verify_expires_at=excluded.verify_expires_at,last_sent_at=now()", [req.user.id, email, hash]);
      await tx.query('DELETE FROM fleetsync.login_attempts WHERE attempt_key=$1', [key]);
    });
    try { await this.mail.send({ to: email, code: pretty(code), purpose: 'verify' }); }
    catch(error) {
      await this.db.query('UPDATE fleetsync.email_recovery SET pending_email=NULL,verify_hash=NULL,verify_expires_at=NULL WHERE user_id=$1 AND verify_hash=$2', [req.user.id, hash]);
      throw error;
    }
  }
  async verify(req) {
    const code = normalizeCode(req.body),key = this.auth.attemptKey(req, `email-verify-${req.user.id}`);
    await this.auth.checkAttempts(key);
    const hash = digest(`${req.user.id}:verify:${code}`);
    const row = await one(this.db, "UPDATE fleetsync.email_recovery SET email=pending_email,pending_email=NULL,verify_hash=NULL,verify_expires_at=NULL,reset_hash=NULL,reset_expires_at=NULL WHERE user_id=$1 AND verify_hash=$2 AND verify_expires_at>now() AND pending_email IS NOT NULL RETURNING email", [req.user.id, hash]);
    if (!row) { await this.auth.failAttempt(key);throw invalid(); }
    await this.db.query('DELETE FROM fleetsync.login_attempts WHERE attempt_key=$1', [key]);
    await audit(this.db, req.user.id, 'recovery_email_verified', 'user', req.user.id);
  }
  async request(req) {
    this.requireMail();
    const username = text(req.body, 'username', 80, true),email = emailAddress(req.body);
    if (!await this.deliveryLimit(this.auth.attemptKey(req, 'email-request-ip'))) return;
    const identityKey = `email-request:${digest(username.toLowerCase())}`;
    if (!await this.deliveryLimit(identityKey)) return;
    const owner = await one(this.db, 'SELECT u.id,r.email FROM fleetsync.users u JOIN fleetsync.email_recovery r ON r.user_id=u.id WHERE lower(u.username)=lower($1)', [username]);
    if (!owner?.email || owner.email !== email) return;
    const code = makeCode(),hash = digest(`${owner.id}:reset:${code}`);
    const issued = await one(this.db, "UPDATE fleetsync.email_recovery SET reset_hash=$1,reset_expires_at=now()+interval '10 minutes',last_sent_at=now() WHERE user_id=$2 AND email=$3 RETURNING user_id", [hash, owner.id, email]);
    if (!issued) return;
    try { await this.mail.send({ to: email, code: pretty(code), purpose: 'reset' }); }
    catch {
      await this.db.query('UPDATE fleetsync.email_recovery SET reset_hash=NULL,reset_expires_at=NULL WHERE user_id=$1 AND reset_hash=$2', [owner.id, hash]);
      console.error('FleetSync password recovery email delivery failed.');
    }
  }
  async reset(req, res) {
    const username = text(req.body, 'username', 80, true),email = emailAddress(req.body),password = newPassword(req.body),code = normalizeCode(req.body);
    const key = this.auth.attemptKey(req, 'recovery', username);await this.auth.checkAttempts(key);
    const owner = await one(this.db, 'SELECT u.id,r.email,r.reset_hash,r.reset_expires_at FROM fleetsync.users u LEFT JOIN fleetsync.email_recovery r ON r.user_id=u.id WHERE lower(u.username)=lower($1)', [username]);
    const hash = digest(`${owner?.id || 'missing'}:reset:${code}`);
    if (!equal(hash, owner?.reset_hash || '0'.repeat(64)) || owner?.email !== email || new Date(owner.reset_expires_at).getTime() <= Date.now()) {
      await this.auth.failAttempt(key);throw invalid();
    }
    const passwordHash = await bcrypt.hash(password, 12);
    await this.db.transaction(async tx => {
      await tx.query('SELECT id FROM fleetsync.users WHERE id=$1 FOR UPDATE', [owner.id]);
      const current = await one(tx, "UPDATE fleetsync.email_recovery SET reset_hash=NULL,reset_expires_at=NULL,pending_email=NULL,verify_hash=NULL,verify_expires_at=NULL WHERE user_id=$1 AND reset_hash=$2 AND reset_expires_at>now() AND email=$3 RETURNING user_id", [owner.id, hash, email]);
      if (!current) throw invalid();
      await tx.query('UPDATE fleetsync.users SET password_hash=$1,must_change_password=false WHERE id=$2', [passwordHash, owner.id]);
      await tx.query('DELETE FROM fleetsync.sessions WHERE user_id=$1', [owner.id]);
      await tx.query('DELETE FROM fleetsync.upload_tickets WHERE user_id=$1', [owner.id]);
      await tx.query('DELETE FROM fleetsync.login_attempts WHERE attempt_key=ANY($1::text[])', [[key, this.auth.attemptKey(req, 'login', username)]]);
      await audit(tx, owner.id, 'password_reset', 'user', owner.id);
      await this.auth.establish(req, res, null, tx);
    });
  }
}
