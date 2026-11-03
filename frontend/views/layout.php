<?php
$titles = ['lineup' => 'DH Line Up', 'dashboard' => 'Dashboard', 'master' => 'Master Operator', 'dokumentasi' => 'Dokumentasi', 'detail' => 'Detail Unit', 'lineup-form' => 'Form Line Up', 'operator-form' => 'Form Operator', 'import' => 'Impor Data', 'audit' => 'Riwayat Perubahan', 'login' => 'Login', 'setup' => 'Buat Akun Pertama', 'error' => 'Kesalahan'];
$label = $titles[$page] ?? 'DH FleetSync';
$flash = $_SESSION['flash'] ?? null;
unset($_SESSION['flash']);
?>
<!doctype html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="dark">
    <title><?= e($label) ?> | DH FleetSync</title>
    <link rel="icon" href="<?= e(asset('dh-logo.png')) ?>">
    <link rel="stylesheet" href="<?= e(asset('css/source.css')) ?>">
    <link rel="stylesheet" href="<?= e(asset('css/app.css')) ?>">
    <script src="<?= e(asset('js/app.js')) ?>" defer></script>
</head>
<body>
<a class="skip-link" href="#main-content">Lewati ke konten</a>
<?php if ($user): ?>
<div class="app-shell">
    <aside class="sidebar" id="sidebar" aria-label="Navigasi utama">
        <a class="brand" href="<?= e(url('dashboard')) ?>"><img src="<?= e(asset('dh-logo.png')) ?>" alt="DH"><div class="brand-caption">FLEETSYNC</div></a>
        <p class="workspace-label">WORKSPACE</p>
        <nav>
        <?php foreach (['dashboard' => 'Dashboard', 'lineup' => 'DH Line Up', 'master' => 'Master Operator', 'dokumentasi' => 'Dokumentasi', 'audit' => 'Riwayat Perubahan'] as $destination => $text):
            $active = $destination === $page || ($destination === 'lineup' && in_array($page, ['detail', 'lineup-form', 'import'], true)) || ($destination === 'master' && $page === 'operator-form'); ?>
            <a class="nav-item <?= $active ? 'active' : '' ?>" href="<?= e(url($destination)) ?>" <?= $active ? 'aria-current="page"' : '' ?>><?= e($text) ?></a>
        <?php endforeach ?>
        </nav>
        <div class="sidebar-foot"><span class="dot"></span>DATA TERSIMPAN DI SERVER<small>Perubahan disimpan ke MySQL.<br>Tidak tersinkron ke Mine Dispatch.</small></div>
    </aside>
    <button class="sidebar-backdrop" id="nav-backdrop" aria-label="Tutup menu" hidden></button>
    <main class="main-shell" id="main-content">
        <header class="topbar">
            <div class="topbar-left"><button class="mobile-toggle" id="nav-toggle" aria-label="Buka menu" aria-expanded="false" aria-controls="sidebar">☰</button><span class="operational-label">OPERASIONAL</span><span class="slash">/</span><strong><?= e(mb_strtoupper($label)) ?></strong></div>
            <div class="topbar-right">
                <a class="top-add" href="<?= e(url('lineup-form')) ?>"><span aria-hidden="true">+</span><span class="add-label">Input Line Up</span></a>
                <span class="signed-in" title="<?= e($user['username']) ?>"><?= e($user['name']) ?></span>
                <form method="post" action="<?= e(url('logout')) ?>"><?php csrf_field() ?><button class="subtle-button" type="submit">Keluar</button></form>
            </div>
        </header>
        <div class="page-content">
        <?php if ($flash): ?><div class="alert <?= e($flash['type']) ?>" role="status"><?= e($flash['message']) ?><button type="button" data-dismiss aria-label="Tutup notifikasi">×</button></div><?php endif ?>
        <?php if (!empty($errorMessage)): ?><div class="alert error" role="alert"><?= e($errorMessage) ?><p>Data belum tersimpan. Periksa isian; unggah kembali gambar jika ada.</p></div><?php endif ?>
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
