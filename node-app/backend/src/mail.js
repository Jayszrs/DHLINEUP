import nodemailer from 'nodemailer';
import { HttpError } from './validation.js';

export class Mailer {
  constructor(env = process.env) {
    this.from = env.MAIL_FROM || env.SMTP_USER;
    this.ready = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && this.from);
    if (this.ready) this.transport = nodemailer.createTransport({
      host: env.SMTP_HOST, port: Number(env.SMTP_PORT || 465),
      secure: Number(env.SMTP_PORT || 465) === 465, requireTLS: true,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
      disableFileAccess: true, disableUrlAccess: true,
    });
  }
  async send({ to, code, purpose }) {
    if (!this.ready) throw new HttpError(503, 'Pengiriman email belum aktif. Hubungi pengelola aplikasi.');
    const verification = purpose === 'verify';
    try {
      await this.transport.sendMail({
        from: { name: 'DH Line Up', address: this.from }, to,
        subject: verification ? 'Verifikasi email pemulihan DH Line Up' : 'Kode reset password DH Line Up',
        text: `DH Line Up\n\n${verification ? 'Verifikasi alamat email pemulihan Anda' : 'Gunakan kode ini untuk mengganti password Anda'}:\n\n${code}\n\nKode berlaku 10 menit dan hanya bisa digunakan sekali. Masukkan pada halaman ${verification ? 'Profil' : 'Lupa password'} di https://dhlineup.vercel.app.\n\nJangan bagikan kode ini. Jika Anda tidak meminta kode, abaikan email ini.`,
      });
    } catch {
      throw new HttpError(503, 'Email belum berhasil dikirim. Coba lagi sebentar atau hubungi pengelola aplikasi.');
    }
  }
}
