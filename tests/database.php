<?php
declare(strict_types=1);
require dirname(__DIR__) . '/backend/bootstrap.php';
if (PHP_SAPI !== 'cli' || !preg_match('/^dh_fleetsync_test_[a-f0-9]+$/', $config['db_name'])) {
    fwrite(STDERR, "Test helper hanya boleh memakai database dh_fleetsync_test_<hex>.\n");
    exit(1);
}
$db = Fleet\Database::connect($config);
if (($argv[1] ?? '') === 'cleanup') {
    // Nama database dibatasi regex di atas, tidak pernah database utama.
    $db->exec('DROP DATABASE `' . $config['db_name'] . '`');
    exit;
}
$counts = [];
foreach (['lineups', 'operators', 'users', 'audit_logs'] as $table) {
    $counts[$table] = (int) $db->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn();
}
$counts['proofs'] = (int) $db->query("SELECT SUM((proof_ftw <> '') + (proof_mine <> '')) FROM lineups")->fetchColumn();
echo json_encode($counts, JSON_THROW_ON_ERROR);
