<section class="editor-page"><div class="page-title"><div><h2><?= $row['id'] ? 'Edit' : 'Tambah' ?> Master Operator</h2><p>Profil master tidak mengubah identitas pada catatan Line Up lama.</p></div><a class="subtle-button" href="<?= e(url('master')) ?>">Kembali</a></div>
<form method="post" action="<?= e(url('operator-save')) ?>" class="editor-form" data-saving>
<?php csrf_field() ?><input type="hidden" name="id" value="<?= e($row['id']) ?>"><input type="hidden" name="version" value="<?= e($row['version']) ?>">
<div class="form-grid"><label>District<select name="site"><?php options(Fleet\Validation::SITES, $row['site'] ?? 'BCP') ?></select></label>
<?php foreach (['name' => ['Nama Operator *', 150], 'nik' => ['NIK *', 60], 'unit' => ['Unit Terakhir', 60], 'equipment' => ['Jenis Alat', 100]] as $key => [$label, $max]): ?><label><?= $label ?><input name="<?= $key ?>" maxlength="<?= $max ?>" value="<?= e($row[$key] ?? '') ?>" <?= in_array($key, ['name', 'nik'], true) ? 'required' : '' ?>></label><?php endforeach ?><label>Tanggal Terakhir<input name="last_date" type="date" value="<?= e($row['last_date'] ?? '') ?>"></label></div>
<div class="modal-actions"><a class="subtle-button" href="<?= e(url('master')) ?>">Batal</a><button class="btn primary" type="submit">Simpan Operator</button></div>
</form>
<?php if ($row['id']): ?><form method="post" action="<?= e(url('operator-delete')) ?>" class="delete-form" data-confirm="Hapus operator ini? Operator dengan riwayat Line Up tidak dapat dihapus."><?php csrf_field() ?><input type="hidden" name="id" value="<?= e($row['id']) ?>"><input type="hidden" name="version" value="<?= e($row['version']) ?>"><button class="danger-button" type="submit">Hapus Operator</button></form><?php endif ?>
</section>
