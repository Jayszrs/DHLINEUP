export class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
export const SITES = ['BCP', 'ACP', 'KCP', 'SSCP'];
export const SHIFTS = ['Belum ditentukan', 'D', 'N'];
export const CATEGORIES = ['Belum diklasifikasi', 'Production', 'Support'];
export const STATUSES = ['Ya', 'Tidak', 'Belum dicek'];
export function text(input, key, max = 200, required = false) {
  const value = input?.[key];
  if (value !== undefined && value !== null && !['string', 'number'].includes(typeof value)) throw new HttpError(422, `Kolom ${key} tidak valid.`);
  const result = String(value ?? '').trim();
  if ((required && !result) || [...result].length > max) throw new HttpError(422, `Kolom ${key} wajib sesuai format (maksimal ${max} karakter).`);
  return result;
}
export function choice(input, key, allowed, fallback) {
  const value = text(input, key, 80) || fallback;
  if (!allowed.includes(value)) throw new HttpError(422, `Pilihan ${key} tidak valid.`);
  return value;
}
export function date(input, key, required = true) {
  const value = text(input, key, 10, required);
  if (!value && !required) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || !Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) throw new HttpError(422, `Tanggal ${key} harus valid (YYYY-MM-DD).`);
  return value;
}
export function filters(input) {
  return { site: choice(input, 'site', SITES, 'BCP'), work_date: date(input, 'work_date', false) || '', shift: choice(input, 'shift', ['All', ...SHIFTS], 'All'), type_category: choice(input, 'type_category', ['All', ...CATEGORIES], 'All'), search: text(input, 'search', 200) };
}
export function lineup(input) {
  const row = { site: choice(input, 'site', SITES), work_date: date(input, 'work_date'), shift: choice(input, 'shift', SHIFTS, SHIFTS[0]), type_category: choice(input, 'type_category', CATEGORIES, CATEGORIES[0]) };
  for (const [key, max] of Object.entries({ unit: 60, equipment: 100, operator_name: 150, nik: 60, source_status: 150, note: 10000 })) row[key] = text(input, key, max, key === 'unit');
  row.unit = row.unit.toUpperCase();
  for (const key of ['dh', 'mine', 'ftw']) row[key] = choice(input, key, STATUSES, 'Belum dicek');
  return row;
}
export function operator(input) {
  return { site: choice(input, 'site', SITES), name: text(input, 'name', 150, true), nik: text(input, 'nik', 60, true), unit: text(input, 'unit', 60).toUpperCase(), equipment: text(input, 'equipment', 100), last_date: date(input, 'last_date', false) };
}
export function identity(input) {
  const name = text(input, 'name', 120, true), username = text(input, 'username', 80, true);
  if (!/^[\w.-]{3,80}$/.test(username)) throw new HttpError(422, 'Username 3–80 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.');
  return { name, username };
}
export function newPassword(input) {
  const password = text(input, 'password', 128, true);
  if ([...password].length < 10 || Buffer.byteLength(password) > 72) throw new HttpError(422, 'Password minimal 10 karakter dan maksimal 72 byte.');
  if (password !== input.password_confirmation) throw new HttpError(422, 'Konfirmasi password tidak cocok.');
  return password;
}
export function version(input) {
  const value = text(input, 'version', 12);
  if (!/^\d+$/.test(value)) throw new HttpError(422, 'Versi data tidak valid.');
  return Number(value);
}
export function recordId(input, key = 'id', required = false) {
  const value = text(input, key, 20, required);
  if (!value && !required) return null;
  if (!/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) throw new HttpError(422, 'ID data tidak valid.');
  return value;
}
export function blankLineup() {
  return { id: '', version: 0, site: 'BCP', work_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }), shift: SHIFTS[0], type_category: CATEGORIES[0], unit: '', equipment: '', operator_name: '', nik: '', dh: 'Ya', mine: 'Belum dicek', ftw: 'Belum dicek', source_status: '', note: '', proof_ftw: '', proof_mine: '' };
}
