<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require dirname(__DIR__) . '/bootstrap.php';

// Snapshot data operasional saja; kredensial dan konfigurasi hosting tetap terpisah.
$db = Fleet\Database::connect($config);
$db->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
$db->beginTransaction();
try {
    $lineups = $db->query('SELECT * FROM lineups ORDER BY id')->fetchAll();
    $operators = $db->query('SELECT * FROM operators ORDER BY site, nik')->fetchAll();
    $audits = $db->query('SELECT a.*, u.username AS local_username FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id')->fetchAll();
    $db->commit();
} catch (Throwable $error) {
    $db->rollBack();
    throw $error;
}
$snapshot = ['lineups' => $lineups, 'operators' => $operators, 'audit_logs' => $audits];
$digest = hash('sha256', json_encode($snapshot, JSON_THROW_ON_ERROR));
$migrationKey = 'migration_local_' . substr($digest, 0, 40);
$out = ROOT_PATH . '/dist/infinityfree/local-data-' . substr($digest, 0, 12);
if (!is_dir($out)) {
    mkdir($out, 0700, true);
}
if (!is_file(ROOT_PATH . '/dist/.htaccess')) {
    file_put_contents(ROOT_PATH . '/dist/.htaccess', "Require all denied\n");
}
$literal = static fn(mixed $value): string => $value === null ? 'NULL' : ((string) $value === '' ? "''" : 'CONVERT(0x' . bin2hex((string) $value) . ' USING utf8mb4) COLLATE utf8mb4_unicode_ci');
$sql = [
    '-- DH FleetSync: local business data migration; no credentials or DROP/TRUNCATE/DELETE.',
    'SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;',
    "SET time_zone = '+07:00';",
    'START TRANSACTION;',
    'SET @dh_import_local = (SELECT COUNT(*) = 0 FROM app_settings WHERE setting_key = ' . $literal($migrationKey) . ');',
];
foreach (['operators' => $operators, 'lineups' => $lineups] as $table => $rows) {
    foreach ($rows as $row) {
        if ($table === 'operators') {
            unset($row['id']);
        }
        $columns = implode(', ', array_map(static fn($key) => '`' . $key . '`', array_keys($row)));
        $sql[] = 'INSERT INTO `' . $table . '` (' . $columns . ') SELECT ' . implode(', ', array_map($literal, array_values($row))) . ' WHERE @dh_import_local = 1 ON DUPLICATE KEY UPDATE `id` = `id`;';
    }
}
foreach ($audits as $audit) {
    $user = $audit['local_username'] !== null ? '(SELECT id FROM users WHERE username = ' . $literal($audit['local_username']) . ' LIMIT 1)' : 'NULL';
    $details = json_decode($audit['details'], true, 512, JSON_THROW_ON_ERROR);
    $details['_migration_source'] = 'local_laragon';
    $details['_local_audit_id'] = (int) $audit['id'];
    if ($audit['local_username'] !== null) {
        $details['_local_username'] = $audit['local_username'];
    }
    $values = [$user, $literal($audit['action']), $literal($audit['entity_type']), $literal($audit['entity_id']), $literal(json_encode($details, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)), $literal($audit['created_at'])];
    $sql[] = 'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, created_at) SELECT ' . implode(', ', $values) . ' WHERE @dh_import_local = 1;';
}
$sql[] = 'INSERT INTO app_settings (setting_key, setting_value) SELECT ' . $literal($migrationKey) . ', ' . $literal($digest) . ' WHERE @dh_import_local = 1;';
$sql[] = 'COMMIT;';
file_put_contents($out . '/local-data.sql', implode(PHP_EOL, $sql) . PHP_EOL, LOCK_EX);

$assets = [];
foreach (['frontend/assets/evidence', 'frontend/assets/reference', 'storage/uploads'] as $directory) {
    foreach (new DirectoryIterator(ROOT_PATH . '/' . $directory) as $file) {
        if ($file->isFile() && preg_match('/\.(png|jpg|jpeg|webp)$/i', $file->getFilename())) {
            $relative = $directory . '/' . $file->getFilename();
            $assets[$relative] = hash_file('sha256', $file->getPathname());
        }
    }
}
foreach ($lineups as $row) {
    foreach (['proof_ftw', 'proof_mine'] as $field) {
        $proof = $row[$field];
        if ($proof === '') {
            continue;
        }
        $relative = str_starts_with($proof, '/assets/evidence/') ? 'frontend' . $proof : 'storage/uploads/' . $proof;
        if (!array_key_exists($relative, $assets)) {
            throw new RuntimeException('File bukti yang dirujuk database tidak ditemukan. Migrasi belum siap.');
        }
    }
}
$zip = new ZipArchive();
if ($zip->open($out . '/local-images.zip', ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    throw new RuntimeException('Paket gambar gagal dibuat.');
}
foreach ($assets as $relative => $hash) {
    $zip->addFile(ROOT_PATH . '/' . $relative, $relative);
}
$zip->close();
$counts = ['lineups' => count($lineups), 'operators' => count($operators), 'audit_logs' => count($audits), 'images' => count($assets)];
file_put_contents($out . '/manifest.json', json_encode(['counts' => $counts, 'snapshot_sha256' => $digest, 'migration_key' => $migrationKey, 'asset_sha256' => $assets, 'credentials_included' => false, 'preserves_online_records' => true], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
echo json_encode(['output_directory' => $out, 'counts' => $counts, 'migration_key' => $migrationKey], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL;
