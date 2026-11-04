<section>
<div class="page-title"><div><h2>Kelola akun</h2><p>Tambahkan rekan kerja untuk mengelola data FleetSync bersama.</p></div><span class="count-tag"><?= count($accounts) ?> akun</span></div>
<div class="accounts-layout">
<div class="table-outer"><div class="table-scroll accounts-table"><table class="data-table"><caption class="sr-only">Akun FleetSync</caption><thead><tr><th scope="col">NAMA / USERNAME</th><th scope="col">AKSES</th><th scope="col">DIBUAT</th></tr></thead><tbody>
<?php foreach ($accounts as $account): ?><tr><td><strong class="operator-name"><?= e($account['name']) ?><?= (int) $account['id'] === (int) $user['id'] ? ' (Anda)' : '' ?></strong><small><?= e($account['username']) ?></small></td><td><?php echo e(Fleet\Accounts::ROLE) ?></td><td class="date-cell"><?= e(date_id(substr($account['created_at'], 0, 10))) ?></td></tr><?php endforeach ?>
</tbody></table></div><p class="account-note">Semua akun memiliki akses yang sama, termasuk mengelola data dan membuat akun lainnya.</p></div>
<form class="editor-form" method="post" action="<?= e(url('account-create')) ?>" data-saving>
<?php csrf_field() ?><h3>Buat akun baru</h3><p class="form-intro">Siapkan identitas dan password untuk rekan kerja.</p>
<div class="form-grid">
<label class="full-span">Nama lengkap<input name="name" autocomplete="off" required maxlength="120" value="<?= e($values['name'] ?? '') ?>"></label>
<label class="full-span">Username<input name="username" autocomplete="off" required minlength="3" maxlength="80" pattern="[a-zA-Z0-9_.\-]{3,80}" value="<?= e($values['username'] ?? '') ?>"><small>Huruf, angka, titik, garis bawah, atau tanda hubung.</small></label>
<label>Password akun baru<input type="password" name="password" autocomplete="new-password" required minlength="10" maxlength="72"><small>Minimal 10 karakter.</small></label>
<label>Ulangi password baru<input type="password" name="password_confirmation" autocomplete="new-password" required minlength="10" maxlength="72"></label>
<label class="full-span verification-field">Password Anda<input type="password" name="current_password" autocomplete="current-password" required maxlength="128"><small>Konfirmasi bahwa Anda yang membuat akun ini.</small></label>
</div><div class="modal-actions"><button class="btn primary" type="submit">Buat akun Pengelola</button></div>
</form></div></section>
