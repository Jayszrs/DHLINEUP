<h1>Buat akun pertama</h1>
<p class="muted">Database siap. Buat akun pengelola untuk mulai memakai DH FleetSync.</p>
<form method="post" action="<?= e(url('setup')) ?>" class="auth-form">
    <?php csrf_field() ?>
    <label>Nama pengelola<input name="name" required maxlength="120" autocomplete="name" value="<?= e(is_string($_POST['name'] ?? null) ? $_POST['name'] : '') ?>"></label>
    <label>Username<input name="username" required minlength="3" maxlength="80" pattern="[a-zA-Z0-9_.\-]{3,80}" autocomplete="username" value="<?= e(is_string($_POST['username'] ?? null) ? $_POST['username'] : '') ?>"><small>Huruf, angka, titik, underscore, atau tanda minus.</small></label>
    <label>Password<input name="password" type="password" required minlength="10" maxlength="128" autocomplete="new-password"><small>Minimal 10 karakter.</small></label>
    <label>Ulangi password<input name="password_confirmation" type="password" required minlength="10" maxlength="128" autocomplete="new-password"></label>
    <button class="btn primary" type="submit">Buat akun &amp; masuk</button>
</form>
<p class="fineprint">Setup hanya tersedia dari localhost dan ditutup setelah akun pertama dibuat.</p>
