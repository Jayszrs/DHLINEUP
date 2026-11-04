<?php
$titles = ['lineup' => 'DH Line Up', 'dashboard' => 'Dashboard', 'master' => 'Master Operator', 'dokumentasi' => 'Dokumentasi', 'detail' => 'Detail Unit', 'lineup-form' => 'Form Line Up', 'operator-form' => 'Form Operator', 'import' => 'Impor Data', 'audit' => 'Riwayat Perubahan', 'login' => 'Login', 'setup' => 'Buat Akun Pertama', 'profile' => 'Profil Saya', 'accounts' => 'Kelola Akun', 'error' => 'Kesalahan'];
$label = $titles[$page] ?? 'DH FleetSync';
$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);
?>
<!doctype html>
<html lang="id" data-theme="light">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <title><?= e($label) ?> | DH FleetSync</title>
    <link rel="icon" href="<?= e(asset('dh-logo.png')) ?>">
    <script src="<?= e(asset('js/theme.js')) ?>"></script>
    <link rel="stylesheet" href="<?= e(asset('css/app.css')) ?>">
    <script src="<?= e(asset('js/app.js')) ?>" defer></script>
</head>
<body>
<a class="skip-link" href="#main-content">Lewati ke konten</a>
<?php if ($user): ?>
<div class="app-shell">
    <aside class="sidebar" id="sidebar" aria-label="Navigasi utama">
        <a class="brand" href="<?= e(url('dashboard')) ?>"><img src="<?= e(asset('dh-logo.png')) ?>" alt="DH"><div class="brand-caption">FLEETSYNC</div></a>
        <button class="sidebar-close icon-button" id="nav-close" aria-label="Tutup navigasi" type="button"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button><p class="workspace-label">WORKSPACE</p>
        <nav>
        <?php foreach (['dashboard' => 'Dashboard', 'lineup' => 'DH Line Up', 'master' => 'Master Operator', 'import' => 'Impor Excel', 'dokumentasi' => 'Dokumentasi', 'audit' => 'Riwayat Perubahan', 'accounts' => 'Kelola Akun'] as $destination => $text):
            $active = $destination === $page || ($destination === 'lineup' && in_array($page, ['detail', 'lineup-form'], true)) || ($destination === 'master' && $page === 'operator-form'); ?>
            <a class="nav-item <?= $active ? 'active' : '' ?>" href="<?= e(url($destination)) ?>" <?= $active ? 'aria-current="page"' : '' ?>><?= e($text) ?></a>
        <?php endforeach ?>
        </nav>
        <div class="sidebar-foot"><span class="dot"></span>DATA TERSIMPAN DI SERVER<small>Perubahan disimpan ke MySQL.<br>Tidak tersinkron ke Mine Dispatch.</small></div>
    </aside>
    <button class="sidebar-backdrop" id="nav-backdrop" aria-label="Tutup menu" hidden></button>
    <main class="main-shell" id="main-content">
        <header class="topbar">
            <div class="topbar-left"><button class="icon-button" id="nav-toggle" type="button" aria-label="Buka navigasi" aria-expanded="true" aria-controls="sidebar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button><span class="operational-label">Operasional</span><span class="slash">/</span><strong><?= e($label) ?></strong></div>
            <div class="topbar-right">
                <button class="icon-button theme-toggle" id="theme-toggle" type="button" aria-label="Aktifkan mode gelap"><svg class="moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20.5 13a8.5 8.5 0 0 1-9.5-9.5A8.5 8.5 0 1 0 20.5 13Z"/></svg><svg class="sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/></svg></button>
                <a class="subtle-button header-import" href="<?= e(url('import')) ?>">Impor Excel</a>
                <a class="top-add" href="<?= e(url('lineup-form')) ?>"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg><span class="add-label">Input Line Up</span><span class="sr-only mobile-add-label">Input Line Up</span></a>
                <details class="profile-menu"><summary aria-label="Menu akun <?= e($user['name']) ?>"><span class="avatar"><?= e(mb_strtoupper(mb_substr($user['name'], 0, 1))) ?></span><span class="signed-in"><?= e($user['name']) ?></span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary><div class="profile-dropdown"><div class="profile-identity"><strong><?= e($user['name']) ?></strong><small>@<?= e($user['username']) ?> / Pengelola</small></div><a href="<?= e(url('profile')) ?>">Edit profil</a><a href="<?= e(url('accounts')) ?>">Kelola akun</a><form method="post" action="<?= e(url('logout')) ?>"><?php csrf_field() ?><button type="submit">Keluar</button></form></div></details>
            </div>
        </header>
        <div class="page-content">
        <?php if ($flash): ?><div class="alert <?= e($flash['type']) ?>" role="status"><?= e($flash['message']) ?><button type="button" data-dismiss aria-label="Tutup notifikasi">×</button></div><?php endif ?>
        <?php if (!empty($errorMessage)): ?><div class="alert error" role="alert"><?= e($errorMessage) ?><p>Data belum tersimpan. Periksa isian lalu coba lagi.</p></div><?php endif ?>
        <?php require $content ?>
        </div>
    </main>
</div>
<?php else: ?>
<main id="main-content" class="guest-shell">
    <div class="guest-brand"><img src="<?= e(asset('dh-logo.png')) ?>" alt="DH"><span>FLEETSYNC</span></div>
    <section class="guest-panel">
        <?php if (!empty($errorMessage)): ?><div class="alert error" role="alert"><?= e($errorMessage) ?></div><?php endif ?>
        <?php require $content ?>
    </section>
</main>
<?php endif ?>
<dialog class="image-dialog" id="image-dialog" aria-label="Gambar bukti diperbesar"><div class="lightbox"><header><strong id="image-title">Bukti dokumentasi</strong><button type="button" class="subtle-button" id="image-close">Tutup</button></header><img id="image-full" alt=""></div></dialog>
<div class="loading-status" id="loading-status" role="status" hidden>Menyimpan perubahan. Mohon tunggu...</div>
</body>
</html>
