<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require dirname(__DIR__) . '/bootstrap.php';

try {
    foreach (['pdo_mysql', 'mbstring', 'fileinfo', 'zip', 'simplexml'] as $extension) {
        if (!extension_loaded($extension)) {
            throw new RuntimeException('Aktifkan ekstensi PHP: ' . $extension);
        }
    }
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $config['db_name'])) {
        throw new RuntimeException('Nama database hanya boleh huruf, angka, dan underscore.');
    }
    $db = Fleet\Database::connect($config, false);
    $db->exec('CREATE DATABASE IF NOT EXISTS `' . $config['db_name'] . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    $db->exec('USE `' . $config['db_name'] . '`');
    $db->exec(file_get_contents(ROOT_PATH . '/database/schema.sql'));
    $repo = new Fleet\Repository($db);
    $db->beginTransaction();
    $s = $db->query("SELECT setting_value FROM app_settings WHERE setting_key='bootstrap' FOR UPDATE");
    $seeded = $db->query("SELECT setting_value FROM app_settings WHERE setting_key='seed_v1'")->fetchColumn();
    $count = 0;
    if (!$seeded) {
        $rows = json_decode(file_get_contents(ROOT_PATH . '/database/seed/lineup.json'), true, 512, JSON_THROW_ON_ERROR);
        foreach ($rows as $source) {
            $exists = $db->prepare('SELECT COUNT(*) FROM lineups WHERE id=?');
            $exists->execute([$source['id']]);
            if ($exists->fetchColumn()) {
                continue;
            }
            $row = Fleet\Validation::lineup([
                'work_date' => $source['date'], 'type_category' => $source['typeCategory'],
                'operator_name' => $source['operator'], 'source_status' => $source['sourceStatus'],
            ] + $source);
            $repo->insertLineup($row + ['proof_ftw' => $source['proofFTW'], 'proof_mine' => $source['proofMine'], 'source' => $source['source'], 'source_row' => $source['sourceRow']], $source['id']);
            $count++;
        }
        $db->exec("INSERT INTO app_settings (setting_key, setting_value) VALUES ('seed_v1', '1')");
    }
    $db->commit();
    echo "Database {$config['db_name']} siap. {$count} data awal ditambahkan.\n";
    echo "Buka aplikasi, lalu buat akun pertama di halaman setup. Installer aman dijalankan ulang tanpa reset data.\n";
} catch (Throwable $error) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    fwrite(STDERR, 'Instalasi gagal: ' . $error->getMessage() . "\n");
    exit(1);
}
