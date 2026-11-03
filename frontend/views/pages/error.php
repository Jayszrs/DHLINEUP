<h1><?= e($title ?? 'Permintaan gagal') ?></h1>
<p class="error-description"><?= e($message ?? 'Coba muat ulang halaman.') ?></p>
<div class="row-buttons"><button type="button" class="subtle-button" data-back>Kembali</button><a class="btn primary" href="<?= e(url('lineup')) ?>">Buka Line Up</a></div>
