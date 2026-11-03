<h1>Masuk ke FleetSync</h1>
<p class="muted">Kelola Line Up operator dan bukti pemeriksaan.</p>
<form method="post" action="<?= e(url('login')) ?>" class="auth-form">
    <?php csrf_field() ?>
    <label>Username<input name="username" required maxlength="80" autocomplete="username" autofocus value="<?= e(is_string($_POST['username'] ?? null) ? $_POST['username'] : '') ?>"></label>
    <label>Password<input name="password" type="password" required maxlength="128" autocomplete="current-password"></label>
    <button class="btn primary" type="submit">Masuk</button>
</form>
<p class="fineprint">Gunakan akun yang dibuat saat setup. Data tersimpan di server aplikasi.</p>
