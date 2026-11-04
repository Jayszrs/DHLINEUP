import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { parseCookie } from 'cookie';
import bcrypt from 'bcryptjs';
import { audit, one } from './db.js';
import { HttpError, identity, newPassword, text, recordId, choice } from './validation.js';

const random = () => randomBytes(32).toString('hex');
const digest = value => createHash('sha256').update(value).digest('hex');
export const ROLE = 'Pengelola';
export const canEditData = user => Boolean(user && (user.is_admin || user.can_edit_data));
export const accountVersion = account => digest(JSON.stringify([String(account.id),account.name,account.username,Boolean(account.is_admin)]));
export function equal(a, b) { return typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
export async function passwordMatches(password, hash) { return bcrypt.compare(password, hash.replace(/^\$2y\$/, '$2b$')); }
const fakeHash = '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';

export class Auth {
  constructor(db, { production = false, activationHash = '' } = {}) { this.db = db; this.production = production; this.activationHash = activationHash; this.cookieName = production ? '__Host-fleetsync' : 'fleetsync_node'; }
  async session(req, res) {
    const cookie = parseCookie(req.headers.cookie || '')[this.cookieName];
    let session = /^[a-f0-9]{64}$/.test(cookie || '') ? await one(this.db, 'SELECT * FROM fleetsync.sessions WHERE id=$1 AND expires_at>now()', [digest(cookie)]) : null;
    if (!session) session = await this.establish(req, res, null);
    req.session = session;
    req.user = session.user_id ? await one(this.db, 'SELECT id,name,username,created_at,is_admin,must_change_password,can_edit_data FROM fleetsync.users WHERE id=$1', [session.user_id]) : null;
    if (req.user) await this.db.query("UPDATE fleetsync.sessions SET expires_at=now()+interval '8 hours' WHERE id=$1", [session.id]);
  }
  async establish(req, res, userId, db = this.db) {
    const token = random(), id = digest(token), csrf = random();
    if (req.session) await db.query('DELETE FROM fleetsync.sessions WHERE id=$1', [req.session.id]);
    const session = await one(db, "INSERT INTO fleetsync.sessions(id,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '8 hours') RETURNING *", [id, userId, csrf]);
    res.cookie(this.cookieName, token, { secure: this.production, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 * 1000 });
    req.session = session;
    return session;
  }
  csrf(req) { if (!equal(req.session?.csrf, req.body?.csrf)) throw new HttpError(419, 'Sesi formulir berakhir. Muat ulang halaman lalu coba lagi.'); }
  async needsSetup() { return Number((await one(this.db, 'SELECT count(*) AS n FROM fleetsync.users')).n) === 0; }
  attemptKey(req, prefix = 'login', username = '') { return `${prefix}:v2:${digest(JSON.stringify([req.ip || req.socket.remoteAddress || 'unknown', username.toLowerCase()]))}`; }
  async checkAttempts(key) {
    const row = await one(this.db, "SELECT attempts,ceil(extract(epoch FROM last_attempt+interval '30 seconds'-now()))::integer AS retry_after FROM fleetsync.login_attempts WHERE attempt_key=$1 AND last_attempt>now()-interval '30 seconds'", [key]);
    if (row && row.attempts >= 5) {
      const error = new HttpError(429, `Beberapa percobaan belum cocok. Coba lagi dalam ${row.retry_after} detik, atau gunakan Lupa password.`);
      error.retryAfter = Math.max(1, Number(row.retry_after));
      throw error;
    }
  }
  async failAttempt(key) {
    await this.db.query("INSERT INTO fleetsync.login_attempts(attempt_key,attempts) VALUES($1,1) ON CONFLICT(attempt_key) DO UPDATE SET attempts=CASE WHEN fleetsync.login_attempts.last_attempt<=now()-interval '30 seconds' THEN 1 ELSE fleetsync.login_attempts.attempts+1 END,last_attempt=now()", [key]);
  }
  async setup(req, res) {
    if (this.production && (!this.activationHash || !equal(digest(text(req.body, 'activation_code', 128)), this.activationHash))) throw new HttpError(403, 'Kode aktivasi hosting tidak cocok.');
    const { name, username } = identity(req.body), password = newPassword(req.body);
    await this.db.transaction(async tx => {
      await tx.query("SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='bootstrap' FOR UPDATE");
      if (Number((await one(tx, 'SELECT count(*) AS n FROM fleetsync.users')).n)) throw new HttpError(409, 'Akun pertama sudah dibuat. Silakan masuk.');
      const user = await one(tx, 'INSERT INTO fleetsync.users(name,username,password_hash,is_admin) VALUES($1,$2,$3,true) RETURNING id', [name, username, await bcrypt.hash(password, 12)]);
      await audit(tx, user.id, 'setup', 'user', user.id);
      await this.establish(req, res, user.id, tx);
    });
  }
  async login(req, res) {
    const username = text(req.body, 'username', 80, true), password = text(req.body, 'password', 128, true), key = this.attemptKey(req, 'login', username);
    await this.checkAttempts(key);
    const user = await one(this.db, 'SELECT * FROM fleetsync.users WHERE lower(username)=lower($1)', [username]);
    const match = await passwordMatches(password, user?.password_hash || fakeHash);
    if (!user || !match) { await this.failAttempt(key); throw new HttpError(422, 'Username atau password tidak cocok.'); }
    await this.db.transaction(async tx => {
      const current = await one(tx, 'SELECT password_hash FROM fleetsync.users WHERE id=$1 FOR UPDATE', [user.id]);
      if (!current || current.password_hash !== user.password_hash) throw new HttpError(422, 'Password baru saja berubah. Silakan masuk dengan password terbaru.');
      await tx.query('DELETE FROM fleetsync.login_attempts WHERE attempt_key=$1', [key]);
      await audit(tx, user.id, 'login', 'user', user.id);
      await this.establish(req, res, user.id, tx);
    });
  }
  async flash(req, message) { await this.db.query('UPDATE fleetsync.sessions SET flash=$1 WHERE id=$2', [JSON.stringify({ message, type: 'success' }), req.session.id]); }
  async takeFlash(req) {
    const row = await one(this.db, 'UPDATE fleetsync.sessions SET flash=NULL WHERE id=$1 RETURNING $2::jsonb AS flash', [req.session.id, JSON.stringify(req.session.flash ?? null)]);
    return row?.flash;
  }
  async logout(req, res) { await audit(this.db, req.user.id, 'logout', 'user', req.user.id); await this.db.query('DELETE FROM fleetsync.sessions WHERE id=$1', [req.session.id]); res.clearCookie(this.cookieName, { path: '/', secure: this.production, httpOnly: true, sameSite: 'lax' }); }
  async saveProfile(req) {
    const { name, username } = identity(req.body);
    await this.db.transaction(async tx => { await tx.query('UPDATE fleetsync.users SET name=$1,username=$2 WHERE id=$3', [name, username, req.user.id]); await audit(tx, req.user.id, 'profile_update', 'user', req.user.id, { username }); });
  }
  async confirmPassword(req) {
    const key = this.attemptKey(req, `reauth-${req.user.id}`);
    await this.checkAttempts(key);
    const owner = await one(this.db, 'SELECT id,password_hash,is_admin FROM fleetsync.users WHERE id=$1', [req.user.id]);
    if (!owner || !await passwordMatches(text(req.body, 'current_password', 128, true), owner.password_hash)) {
      await this.failAttempt(key);throw new HttpError(422, 'Password Anda saat ini belum cocok. Perubahan belum disimpan.');
    }
    return { owner, key };
  }
  async editAccount(req, res) {
    if (!req.user.is_admin) throw new HttpError(403, 'Hanya administrator yang dapat mengubah profil dan role akun lain.');
    const id = recordId(req.body, 'id', true), { name, username } = identity(req.body);
    const isAdmin = choice(req.body, 'role', ['Administrator', ROLE]) === 'Administrator';
    const version = text(req.body, 'account_version', 64, true), { owner, key } = await this.confirmPassword(req);
    if (!/^[a-f0-9]{64}$/.test(version)) throw new HttpError(422, 'Versi akun tidak valid. Muat ulang halaman lalu coba lagi.');
    return this.db.transaction(async tx => {
      await tx.query("SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='bootstrap' FOR UPDATE");
      const users = (await tx.query('SELECT id,name,username,is_admin,password_hash FROM fleetsync.users WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [[owner.id, id]])).rows;
      const actor = users.find(user => String(user.id) === String(owner.id)), target = users.find(user => String(user.id) === String(id));
      if (!actor?.is_admin || actor.password_hash !== owner.password_hash) throw new HttpError(403, 'Akses administrator berubah. Masuk kembali lalu coba lagi.');
      if (!target) throw new HttpError(404, 'Akun tidak ditemukan.');
      if (!equal(version, accountVersion(target))) throw new HttpError(409, 'Profil atau role akun sudah berubah. Muat ulang halaman sebelum menyimpan kembali.');
      if (target.is_admin && !isAdmin && Number((await one(tx,'SELECT count(*) AS n FROM fleetsync.users WHERE is_admin')).n) <= 1) throw new HttpError(409, 'Administrator terakhir tidak dapat dijadikan Pengelola. Jadikan akun lain administrator terlebih dahulu.');
      await tx.query('UPDATE fleetsync.users SET name=$1,username=$2,is_admin=$3 WHERE id=$4', [name, username, isAdmin, id]);
      const credentialsChanged = target.username !== username || target.is_admin !== isAdmin;
      if (credentialsChanged) await this.revokePasswordAccess(tx, target.id);
      await tx.query('DELETE FROM fleetsync.login_attempts WHERE attempt_key=$1', [key]);
      await audit(tx, actor.id, 'account_update', 'user', target.id, {
        before: { name: target.name, username: target.username, role: target.is_admin ? 'Administrator' : ROLE },
        after: { name, username, role: isAdmin ? 'Administrator' : ROLE }, sessions_revoked: credentialsChanged,
      });
      const relogin = credentialsChanged && String(actor.id) === String(target.id);
      if (relogin) await this.establish(req, res, null, tx);
      return { relogin, username, credentialsChanged };
    });
  }
  async changePassword(req, res) {
    const password = newPassword(req.body), { owner, key } = await this.confirmPassword(req);
    if (await passwordMatches(password, owner.password_hash)) throw new HttpError(422, 'Gunakan password baru yang berbeda dari password saat ini.');
    const passwordHash = await bcrypt.hash(password, 12);
    await this.db.transaction(async tx => {
      const current = await one(tx, 'SELECT password_hash FROM fleetsync.users WHERE id=$1 FOR UPDATE', [owner.id]);
      if (!current || current.password_hash !== owner.password_hash) throw new HttpError(409, 'Password baru saja berubah. Masuk kembali lalu coba lagi.');
      await tx.query('UPDATE fleetsync.users SET password_hash=$1,must_change_password=false WHERE id=$2', [passwordHash, owner.id]);
      await this.revokePasswordAccess(tx, owner.id);
      await tx.query('DELETE FROM fleetsync.login_attempts WHERE attempt_key=ANY($1::text[])', [[key, this.attemptKey(req, 'login', req.user.username)]]);
      await audit(tx, owner.id, 'password_change', 'user', owner.id);
      await this.establish(req, res, null, tx);
    });
  }
  async resetAccountPassword(req) {
    if (!req.user.is_admin) throw new HttpError(403, 'Hanya administrator yang dapat mereset password akun lain.');
    const id = recordId(req.body, 'id', true), password = newPassword(req.body);
    if (String(id) === String(req.user.id)) throw new HttpError(422, 'Untuk akun Anda sendiri, gunakan Ganti password di Profil.');
    const { owner, key } = await this.confirmPassword(req), passwordHash = await bcrypt.hash(password, 12);
    return this.db.transaction(async tx => {
      const users = (await tx.query('SELECT id,username,password_hash,is_admin FROM fleetsync.users WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [[owner.id, id]])).rows;
      const actor = users.find(user => String(user.id) === String(owner.id)), target = users.find(user => String(user.id) === String(id));
      if (!actor?.is_admin || actor.password_hash !== owner.password_hash) throw new HttpError(403, 'Konfirmasi administrator berubah. Masuk kembali lalu coba lagi.');
      if (!target) throw new HttpError(404, 'Akun tidak ditemukan.');
      await tx.query('UPDATE fleetsync.users SET password_hash=$1,must_change_password=true WHERE id=$2', [passwordHash, target.id]);
      await this.revokePasswordAccess(tx, target.id);
      await tx.query('DELETE FROM fleetsync.login_attempts WHERE attempt_key=ANY($1::text[])', [[key, this.attemptKey(req, 'login', target.username)]]);
      await audit(tx, actor.id, 'account_password_reset', 'user', target.id, { username: target.username, must_change_password: true });
      return target.username;
    });
  }
  async revokePasswordAccess(tx, userId) {
    await tx.query('DELETE FROM fleetsync.sessions WHERE user_id=$1', [userId]);
    await tx.query('DELETE FROM fleetsync.upload_tickets WHERE user_id=$1', [userId]);
    await tx.query('UPDATE fleetsync.email_recovery SET reset_hash=NULL,reset_expires_at=NULL,verify_hash=NULL,verify_expires_at=NULL,pending_email=NULL WHERE user_id=$1', [userId]);
  }
  async createAccount(req) {
    const { name, username } = identity(req.body), password = newPassword(req.body), key = this.attemptKey(req, `reauth-${req.user.id}`);
    await this.checkAttempts(key);
    const actor = await one(this.db, 'SELECT password_hash FROM fleetsync.users WHERE id=$1', [req.user.id]);
    if (!await passwordMatches(text(req.body, 'current_password', 128, true), actor.password_hash)) { await this.failAttempt(key); throw new HttpError(422, 'Password Anda belum cocok. Akun baru belum dibuat.'); }
    await this.db.transaction(async tx => {
      const user = await one(tx, 'INSERT INTO fleetsync.users(name,username,password_hash) VALUES($1,$2,$3) RETURNING id', [name, username, await bcrypt.hash(password, 12)]);
      await audit(tx, req.user.id, 'account_create', 'user', user.id, { username, role: ROLE });
      await tx.query('DELETE FROM fleetsync.login_attempts WHERE attempt_key=$1', [key]);
    });
  }
}
