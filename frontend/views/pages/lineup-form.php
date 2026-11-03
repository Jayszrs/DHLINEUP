<section class="editor-page">
<div class="page-title"><div><h2><?= $row['id'] ? 'Edit' : 'Input' ?> DH Line Up</h2><p>Pencatatan operator dan verifikasi sumber.</p></div><a class="subtle-button" href="<?= e($row['id'] ? url('detail', ['id' => $row['id']]) : url('lineup')) ?>">Kembali</a></div>
<form method="post" action="<?= e(url('lineup-save')) ?>" enctype="multipart/form-data" class="editor-form" data-saving>
    <?php csrf_field() ?><input type="hidden" name="id" value="<?= e($row['id']) ?>"><input type="hidden" name="version" value="<?= e($row['version']) ?>"><input type="hidden" name="MAX_FILE_SIZE" value="5242880">
    <div class="form-grid">
        <label>District<select name="site"><?php options(Fleet\Validation::SITES, $row['site']) ?></select></label>
        <label>Tanggal *<input name="work_date" type="date" required value="<?= e($row['work_date']) ?>"></label>
        <label>Shift<select name="shift"><?php options(Fleet\Validation::SHIFTS, $row['shift']) ?></select></label>
        <label>Type<select name="type_category"><?php options(Fleet\Validation::CATEGORIES, $row['type_category']) ?></select></label>
        <?php foreach (['unit' => ['Kode Alat *', 60], 'equipment' => ['Jenis Alat', 100], 'operator_name' => ['Nama Operator', 150], 'nik' => ['NIK Operator', 60]] as $key => [$label, $max]): ?>
        <label><?= e($label) ?><input name="<?= $key ?>" maxlength="<?= $max ?>" value="<?= e($row[$key]) ?>" <?= $key === 'unit' ? 'required' : '' ?>></label>
        <?php endforeach ?>
        <?php foreach (['dh' => 'DH Line Up', 'mine' => 'Mine Dispatch', 'ftw' => 'FTW Terisi'] as $key => $label): ?><label><?= $label ?><select name="<?= $key ?>"><?php options(Fleet\Validation::STATUSES, $row[$key]) ?></select></label><?php endforeach ?>
        <label>Status Sumber<input name="source_status" maxlength="150" value="<?= e($row['source_status']) ?>"></label>
        <label class="full-span">Catatan<textarea name="note" rows="4" maxlength="10000"><?= e($row['note']) ?></textarea></label>
        <?php foreach (['proof_ftw' => 'Bukti FTW', 'proof_mine' => 'Bukti Mine Dispatch'] as $key => $label): ?>
        <div class="upload-field"><label><?= $label ?><input type="file" name="<?= $key ?>" accept="image/png,image/jpeg,image/webp"><small>PNG, JPG, WebP. Maksimal 5 MB.</small></label>
        <?php if ($row[$key]): ?><a class="attached" data-lightbox href="<?= e(evidence_url($row[$key])) ?>">Lihat bukti saat ini</a><label class="checkbox-label"><input type="checkbox" name="remove_<?= $key ?>" value="1"> Lepas bukti dari catatan ini</label><?php endif ?>
        </div>
        <?php endforeach ?>
    </div>
    <p class="fineprint">Simpan mengubah database MySQL. Gambar tidak otomatis mengubah status FTW atau Mine Dispatch.</p>
    <div class="modal-actions"><a class="subtle-button" href="<?= e(url('lineup')) ?>">Batal</a><button class="btn primary" type="submit">Simpan Line Up</button></div>
</form>
<?php if ($row['id']): ?><form class="delete-form" method="post" action="<?= e(url('lineup-delete')) ?>" data-confirm="Hapus Line Up ini dari database? Tindakan ini tidak dapat dibatalkan."><?php csrf_field() ?><input type="hidden" name="id" value="<?= e($row['id']) ?>"><input type="hidden" name="version" value="<?= e($row['version']) ?>"><button class="danger-button" type="submit">Hapus Line Up</button></form><?php endif ?>
</section>
