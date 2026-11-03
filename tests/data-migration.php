<?php
declare(strict_types=1);
require dirname(__DIR__) . '/backend/bootstrap.php';
$manifestPaths = glob(ROOT_PATH . '/dist/infinityfree/local-data-*/manifest.json');
usort($manifestPaths, static fn($a, $b) => filemtime($b) <=> filemtime($a));
if (!$manifestPaths) {
    throw new RuntimeException('Jalankan backend/cli/export-local-data.php dahulu.');
}
$folder = dirname($manifestPaths[0]);
$manifest = json_decode(file_get_contents($folder . '/manifest.json'), true, 512, JSON_THROW_ON_ERROR);
$config['db_name'] = 'dh_fleetsync_test_' . bin2hex(random_bytes(6));
$db = Fleet\Database::connect($config, false);
$db->exec('CREATE DATABASE `' . $config['db_name'] . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$db->exec('USE `' . $config['db_name'] . '`');
$checks = 0;
$check = static function (bool $result, string $message) use (&$checks): void {
    if (!$result) {
        throw new RuntimeException($message);
    }
    echo 'PASS: ' . $message . PHP_EOL;
    $checks++;
};
try {
    $db->exec(file_get_contents(ROOT_PATH . '/database/schema.sql'));
    $passwordHash = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);
    $db->prepare('INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)')->execute(['Existing Online Owner', 'online_owner', $passwordHash]);
    $repo = new Fleet\Repository($db, 1);
    $repo->audit('setup', 'user', '1');
    $sql = file_get_contents($folder . '/local-data.sql');
    $db->exec($sql);
    foreach (['lineups', 'operators', 'audit_logs'] as $table) {
        $expected = $manifest['counts'][$table] + ($table === 'audit_logs' ? 1 : 0);
        $check((int) $db->query('SELECT COUNT(*) FROM ' . $table)->fetchColumn() === $expected, $table . ' migrated with existing records preserved');
    }
    $check((int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn() === 1 && $db->query('SELECT password_hash FROM users WHERE id=1')->fetchColumn() === $passwordHash, 'online account and password remain unchanged');
    $db->exec($sql);
    $check((int) $db->query('SELECT COUNT(*) FROM audit_logs')->fetchColumn() === $manifest['counts']['audit_logs'] + 1, 'repeat import never duplicates historical audit records');
    $check((int) $db->query('SELECT COUNT(*) FROM lineups')->fetchColumn() === $manifest['counts']['lineups'], 'repeat import never duplicates lineups');
    $first = $db->query('SELECT id FROM lineups LIMIT 1')->fetchColumn();
    $db->prepare('UPDATE lineups SET note=? WHERE id=?')->execute(['Existing online edit', $first]);
    $db->exec($sql);
    $s = $db->prepare('SELECT note FROM lineups WHERE id=?');
    $s->execute([$first]);
    $check($s->fetchColumn() === 'Existing online edit', 'reimport preserves online edits');
    $check(!preg_match('/\b(DROP|TRUNCATE|DELETE|password_hash|login_attempts)\b/i', preg_replace('/^--.*$/m', '', $sql)), 'migration SQL excludes deletions, credentials and login locks');
    $zip = new ZipArchive();
    $zip->open($folder . '/local-images.zip');
    $check($zip->numFiles === $manifest['counts']['images'], 'all expected image files included');
    foreach ($manifest['asset_sha256'] as $name => $hash) {
        if (hash('sha256', $zip->getFromName($name)) !== $hash) {
            throw new RuntimeException('Image checksum mismatch.');
        }
    }
    $zip->close();
    $check(true, 'all image checksums match local originals');
    echo $checks . ' migration checks passed on an isolated test database.' . PHP_EOL;
} finally {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    if (preg_match('/^dh_fleetsync_test_[a-f0-9]+$/', $config['db_name'])) {
        $db->exec('DROP DATABASE `' . $config['db_name'] . '`');
    }
}
