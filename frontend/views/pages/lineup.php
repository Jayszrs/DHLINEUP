<?php
$mine = count(array_filter($rows, static fn($r) => $r['mine'] === 'Ya'));
$ftw = count(array_filter($rows, static fn($r) => $r['ftw'] === 'Ya'));
$needs = count(array_filter($rows, static fn($r) => status_of($r)[0] !== 'SESUAI'));
?>
<section>
<form method="get" action="index.php" id="lineup-filters">
    <input type="hidden" name="page" value="lineup">
    <div class="orange-panel">
        <h1>Line Up Operator</h1><p class="filter-intro">Penugasan operator dan pengecekan Mine Dispatch / FTW.</p>
        <div class="orange-controls">
            <label class="select-box"><span class="field-caption">District</span><span class="select-wrap"><select name="site"><?php options(Fleet\Validation::SITES, $filters['site']) ?></select></span></label>
            <label class="select-box"><span class="field-caption">Tanggal</span><span class="date-wrap"><input name="work_date" type="date" value="<?= e($filters['work_date']) ?>"></span></label>
            <label class="select-box"><span class="field-caption">Shift</span><span class="select-wrap"><select name="shift"><?php options(['All' => 'Semua shift', 'D' => 'D - Day', 'N' => 'N - Night', 'Belum ditentukan' => 'Belum ditentukan'], $filters['shift']) ?></select></span></label>
            <label class="select-box"><span class="field-caption">Jenis</span><span class="select-wrap"><select name="type_category"><?php options(['All' => 'Semua type', 'Production' => 'Production', 'Support' => 'Support', 'Belum diklasifikasi' => 'Belum diklasifikasi'], $filters['type_category']) ?></select></span></label>
            <button class="btn show-button" type="submit">Tampilkan</button>
            <a class="btn export-button" href="<?= e(url('export', $filters)) ?>">Ekspor Excel</a>
            <a class="btn reset-button" href="<?= e(url('lineup')) ?>">Reset</a>
        </div>
        <div class="orange-summary"><span>Timezone: <b>WIB</b></span><span>Date: <b><?= $filters['work_date'] ? e(date_id($filters['work_date'])) : 'Semua tanggal' ?></b></span><span>District: <b><?= e($filters['site']) ?></b></span><span>Total: <b><?= count($rows) ?></b></span><span>Mine: <b><?= $mine ?></b></span><span>FTW: <b><?= $ftw ?></b></span><span>Perlu cek: <b><?= $needs ?></b></span></div>
    </div>
    <div class="list-toolbar"><div class="search-field"><input name="search" aria-label="Cari unit atau operator" placeholder="Cari unit, operator, NIK, atau catatan..." value="<?= e($filters['search']) ?>"><button class="search-submit" type="submit">Cari</button></div><div class="toolbar-actions"><span><?= count($rows) ?> dari <?= $total ?> entri</span><a class="subtle-button" href="<?= e(url('import')) ?>">Impor Excel / CSV</a><a class="subtle-button" href="<?= e(url('export', $filters + ['format' => 'csv'])) ?>">CSV</a></div></div>
</form>
<div class="table-outer"><div class="table-scroll"><table class="data-table"><caption class="sr-only">Line Up Operator hasil filter</caption><thead><tr><?php foreach (['TANGGAL', 'UNIT', 'JENIS', 'OPERATOR / NIK', 'MINE', 'FTW', 'STATUS', 'AKSI'] as $heading): ?><th scope="col"><?= $heading ?></th><?php endforeach ?></tr></thead><tbody>
<?php foreach ($rows as $row): ?>
<tr><td class="date-cell"><?= e(date_id($row['work_date'], true)) ?></td><td><strong class="unit-label"><?= e($row['unit']) ?></strong></td><td><?= e($row['equipment'] ?: '-') ?></td><td><span class="operator-name"><?= e($row['operator_name'] ?: 'Belum diisi') ?></span><small>NIK <?= e($row['nik'] ?: '-') ?></small></td><td><?php chip($row['mine']) ?></td><td><?php chip($row['ftw']) ?></td><td><?php status_pill($row) ?></td><td><a class="table-action" href="<?= e(url('detail', ['id' => $row['id']])) ?>">Periksa ›</a></td></tr>
<?php endforeach ?>
</tbody></table>
<?php if (!$rows): ?><div class="empty-state"><h3>Tidak ada data yang sesuai</h3><p>Ubah district, tanggal, shift, type, atau kata pencarian. Gunakan Input Line Up untuk menambahkan catatan.</p><a class="subtle-button" href="<?= e(url('lineup')) ?>">Reset filter</a></div><?php endif ?>
</div></div>
<p class="table-footnote"><?= count($rows) ?> penugasan • FTW dinilai terpisah dari Mine Dispatch • Ekspor mengikuti filter yang sudah diterapkan.</p>
</section>
