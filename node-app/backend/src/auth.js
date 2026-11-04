import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { parseCookie } from 'cookie';
import bcrypt from 'bcryptjs';
import { audit, one } from './db.js';
import { HttpError, identity, newPassword, text } from './validation.js';

const random = () => randomBytes(32).toString('hex');
const digest = value => createHash('sha256').update(value).digest('hex');
export const ROLE = 'Pengelola';
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
    req.user = session.user_id ? await one(this.db, 'SELECT id,name,username,created_at FROM fleetsync.users WHERE id=$1', [session.user_id]) : null;
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
  attemptKey(req, prefix = 'login') { return `${prefix}:${digest(req.ip || req.socket.remoteAddress || 'unknown')}`; }
  async checkAttempts(key) {
    const row = await one(this.db, "SELECT * FROM fleetsync.login_attempts WHERE attempt_key=$1 AND last_attempt>now()-interval '15 minutes'", [key]);
    if (row && row.attempts >= 5) throw new HttpError(429, 'Terlalu banyak percobaan. Tunggu 15 menit.');
  }
  async failAttempt(key) {
    await this.db.query("INSERT INTO fleetsync.login_attempts(attempt_key,attempts) VALUES($1,1) ON CONFLICT(attempt_key) DO UPDATE SET attempts=CASE WHEN fleetsync.login_attempts.last_attempt<now()-interval '15 minutes' THEN 1 ELSE fleetsync.login_attempts.attempts+1 END,last_attempt=now()", [key]);
  }
  async setup(req, res) {
    if (this.production && (!this.activationHash || !equal(digest(text(req.body, 'activation_code', 128)), this.activationHash))) throw new HttpError(403, 'Kode aktivasi hosting tidak cocok.');
    const { name, username } = identity(req.body), password = newPassword(req.body);
    await this.db.transaction(async tx => {
      await tx.query("SELECT setting_value FROM fleetsync.app_settings WHERE setting_key='bootstrap' FOR UPDATE");
      if (Number((await one(tx, 'SELECT count(*) AS n FROM fleetsync.users')).n)) throw new HttpError(409, 'Akun pertama sudah dibuat. Silakan masuk.');
      const user = await one(tx, 'INSERT INTO fleetsync.users(name,username,password_hash) VALUES($1,$2,$3) RETURNING id', [name, username, await bcrypt.hash(password, 12)]);
      await audit(tx, user.id, 'setup', 'user', user.id);
      await this.establish(req, res, user.id, tx);
    });
  }
  async login(req, res) {
    const username = text(req.body, 'username', 80, true), password = text(req.body, 'password', 128, true), key = this.attemptKey(req);
    await this.checkAttempts(key);
    const user = await one(this.db, 'SELECT * FROM fleetsync.users WHERE lower(username)=lower($1)', [username]);
    const match = await passwordMatches(password, user?.password_hash || fakeHash);
    if (!user || !match) { await this.failAttempt(key); throw new HttpError(422, 'Username atau password tidak cocok.'); }
    await this.db.transaction(async tx => { await tx.query('DELETE FROM fleetsync.login_attempts WHERE attempt_key=$1', [key]); await audit(tx, user.id, 'login', 'user', user.id); await this.establish(req, res, user.id, tx); });
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
