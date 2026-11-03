<?php
$total = count($rows);
$yes = static fn(array $items, string $field): int => count(array_filter($items, static fn($r) => $r[$field] === 'Ya'));
$reference = $rows ? max(array_column($rows, 'work_date')) : date('Y-m-d');
$end = new DateTimeImmutable($reference);
$week = $end->modify('monday this week')->format('Y-m-d');
$periods = [
    ['DAILY', date_id($reference, true), array_filter($rows, static fn($r) => $r['work_date'] === $reference)],
    ['WTD', date_id($week, true) . ' - ' . date_id($reference, true), array_filter($rows, static fn($r) => $r['work_date'] >= $week && $r['work_date'] <= $reference)],
    ['MTD', $end->format('m/Y'), array_filter($rows, static fn($r) => substr($r['work_date'], 0, 7) === substr($reference, 0, 7))],
    ['YTD', $end->format('Y'), array_filter($rows, static fn($r) => substr($r['work_date'], 0, 4) === substr($reference, 0, 4))],
];
$daily = [];
for ($i = 7; $i >= 0; $i--) {
    $day = $end->modify('-' . $i . ' days')->format('Y-m-d');
    $daily[$day] = count(array_filter($rows, static fn($r) => $r['work_date'] === $day));
}
$max = max(1, ...array_values($daily));
$statusCounts = ['SESUAI' => 0, 'BELUM DICEK' => 0, 'TINDAK LANJUT' => 0];
foreach ($rows as $r) { $statusCounts[status_of($r)[0]]++; }
?>
<section>
<div class="page-title dashboard-title"><div><h2>Dashboard operasional</h2><p>Monitoring Line Up, Mine Dispatch, dan FTW • <?= e($filters['site']) ?></p></div><a class="btn primary" href="<?= e(url('lineup', ['site' => $filters['site']])) ?>">Lihat Line Up ›</a></div>
<form method="get" action="index.php" class="dashboard-filter"><input type="hidden" name="page" value="dashboard"><label class="site-filter">District<select name="site"><?php options(Fleet\Validation::SITES, $filters['site']) ?></select></label><button class="subtle-button" type="submit">Tampilkan</button><span class="muted"><?= $rows ? 'Acuan periode: data terakhir ' . e(date_id($reference)) : 'Belum ada catatan pada district ini.' ?></span></form>
<div class="kpi-grid"><?php foreach ([['TOTAL LINE UP', $total, 'Seluruh catatan district', 'orange'], ['MINE TERDETEKSI', $yes($rows, 'mine'), ($total ? round($yes($rows, 'mine') / $total * 100) : 0) . '% dari total', 'green'], ['BELUM DI MINE', count(array_filter($rows, static fn($r) => $r['mine'] === 'Tidak')), 'Status Mine: Tidak', 'red'], ['FTW TERISI', $yes($rows, 'ftw'), $total - $yes($rows, 'ftw') . ' belum terkonfirmasi Ya', 'amber']] as [$name, $n, $help, $tone]): ?><article class="kpi <?= $tone ?>"><span><?= $name ?></span><strong><?= $n ?></strong><small><?= e($help) ?></small></article><?php endforeach ?></div>
<div class="section-title"><strong>RINGKASAN PERIODE</strong><small>Jumlah penugasan, bukan jam produksi.</small></div>
<div class="period-grid"><?php foreach ($periods as $i => [$name, $period, $items]): ?><div class="period"><div class="period-head <?= $i ? 'secondary' : '' ?>"><?= $name ?><span><?= e($period) ?></span></div><div class="period-body"><strong><?= count($items) ?> entri</strong><div class="progress-info">Mine Dispatch <b><?= $yes($items, 'mine') ?>/<?= count($items) ?></b></div><div class="progress-bar"><div style="width:<?= count($items) ? $yes($items, 'mine') / count($items) * 100 : 0 ?>%"></div></div><div class="progress-info">FTW terisi <b class="amber-text"><?= $yes($items, 'ftw') ?>/<?= count($items) ?></b></div></div></div><?php endforeach ?></div>
<div class="dashboard-lower"><div class="panel trend-panel"><h3>Tren Line Up harian</h3><p>8 hari sampai tanggal data terakhir. Pilih batang untuk melihat catatan.</p><div class="trend-bars"><?php foreach ($daily as $day => $count): ?><a class="trend-item" href="<?= e(url('lineup', ['site' => $filters['site'], 'work_date' => $day])) ?>" aria-label="<?= e(date_id($day) . ': ' . $count . ' entri') ?>"><b><?= $count ?></b><div class="trend-track"><div class="<?= $day === $reference ? 'highlight' : '' ?>" style="height:<?= $count / $max * 100 ?>%"></div></div><span><?= e(substr($day, -2)) ?></span></a><?php endforeach ?></div></div><div class="panel site-panel"><h3>Hasil pengecekan</h3><?php foreach ($statusCounts as $label => $count): ?><div class="site-row"><strong><?= $label ?></strong><span><?= $count ?> entri</span></div><?php endforeach ?><p>Mine dan FTW harus sama-sama Ya untuk hasil SESUAI.</p></div></div>
<div class="attention-panel"><div><b>Prioritas pengecekan</b><span>FTW / Mine belum sesuai</span></div><div><?php $needs = array_slice(array_values(array_filter($rows, static fn($r) => status_of($r)[0] !== 'SESUAI')), 0, 3); foreach ($needs as $row): ?><a class="subtle-button" href="<?= e(url('detail', ['id' => $row['id']])) ?>"><?= e($row['unit']) ?> ›</a><?php endforeach ?><?php if (!$needs): ?><span><?= $rows ? 'Seluruh catatan sudah sesuai.' : 'Belum ada Line Up di district ini.' ?></span><?php endif ?></div></div>
<p class="fineprint">Dashboard dihitung dari database MySQL saat halaman dibuka. Status FTW dan Mine Dispatch dinilai terpisah.</p>
</section>
