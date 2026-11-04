<?php /* A profile can only update the account stored in the session. */ ?>
<section class="editor-page">
<div class="page-title"><div><h2>Profil saya</h2><p>Perbarui nama yang tampil dan username untuk masuk.</p></div><span class="chip muted"><?= e(Fleet\Accounts::ROLE) ?></span></div>
<form class="editor-form" method="post" action="<?= e(url('profile-save')) ?>" data-saving>
<?php csrf_field() ?>
<div class="form-grid">
<label>Nama lengkap<input name="name" autocomplete="name" required maxlength="120" value="<?= e($values['name'] ?? '') ?>"></label>
<label>Username<input name="username" autocomplete="username" required minlength="3" maxlength="80" pattern="[a-zA-Z0-9_.\-]{3,80}" value="<?= e($values['username'] ?? '') ?>"><small>Huruf, angka, titik, garis bawah, atau tanda hubung.</small></label>
</div><div class="modal-actions"><a class="subtle-button" href="<?= e(url('lineup')) ?>">Kembali</a><button class="btn primary" type="submit">Simpan profil</button></div>
</form></section>
