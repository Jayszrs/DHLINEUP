<?php
declare(strict_types=1);
require dirname(__DIR__) . '/backend/bootstrap.php';
session_start();
$config['db_name'] = 'dh_fleetsync_test_' . bin2hex(random_bytes(6));
$db = Fleet\Database::connect($config, false);
$db->exec('CREATE DATABASE `' . $config['db_name'] . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$db->exec('USE `' . $config['db_name'] . '`');
$messages = [];
$check = static function (bool $valid, string $name) use (&$messages): void {
    if (!$valid) {
        throw new RuntimeException($name);
    }
    $messages[] = 'PASS: ' . $name;
};
try {
    $db->exec(file_get_contents(ROOT_PATH . '/database/schema.sql'));
    $token = bin2hex(random_bytes(32));
    $_SERVER['REMOTE_ADDR'] = '203.0.113.10';
    $auth = new Fleet\Auth($db, hash('sha256', $token));
    $input = ['name' => 'Uji Aktivasi', 'username' => 'uji_aktivasi', 'password' => 'ActivationTest-2026', 'password_confirmation' => 'ActivationTest-2026'];
    $check($auth->requiresActivation(), 'remote setup requires activation');
    foreach (['', 'incorrect-code'] as $invalid) {
        $status = 0;
        try {
            $auth->setup($input + ['activation_code' => $invalid]);
        } catch (Fleet\HttpException $error) {
            $status = $error->status;
        }
        $check($status === 403 && $auth->needsSetup(), 'missing or wrong activation never creates an account');
    }
    $_SERVER['REMOTE_ADDR'] = '127.0.0.1';
    $check(!(new Fleet\Auth($db))->requiresActivation(), 'local Laragon setup still works without activation');
    $check((new Fleet\Auth($db, hash('sha256', $token), false))->requiresActivation(), 'hosting can require activation even behind a local proxy');
    $_SERVER['REMOTE_ADDR'] = '203.0.113.10';
    $auth->setup($input + ['activation_code' => $token]);
    $check(!$auth->needsSetup() && (int) $db->query('SELECT COUNT(*) FROM users')->fetchColumn() === 1, 'valid activation creates exactly one account');
    $status = 0;
    try {
        $auth->setup($input + ['activation_code' => $token]);
    } catch (Fleet\HttpException $error) {
        $status = $error->status;
    }
    $check($status === 409, 'activation cannot create a second account');
    $check(!str_contains(json_encode($db->query('SELECT * FROM audit_logs')->fetchAll()), $token), 'activation code is absent from audit logs');
    $zip = new ZipArchive();
    if ($zip->open(ROOT_PATH . '/dist/infinityfree/htdocs.zip') !== true) {
        throw new RuntimeException('Buat paket terlebih dahulu dengan backend/cli/package-infinityfree.php.');
    }
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        if (preg_match('~/(evidence|reference|seed|cli)/|activation-code|lineup\.json|local\.example\.php~', $name)) {
            // local.example.php hanya template tanpa data atau password pengguna.
            if (!str_ends_with($name, 'local.example.php')) {
                throw new RuntimeException('File yang tidak boleh diunggah terdeteksi: ' . $name);
            }
        }
    }
    $zip->close();
    $check(true, 'deployment archive excludes source records, evidence, CLI tools and activation code');
    echo implode(PHP_EOL, $messages) . PHP_EOL . count($messages) . ' activation/deployment checks passed.' . PHP_EOL;
} finally {
    if (preg_match('/^dh_fleetsync_test_[a-f0-9]+$/', $config['db_name'])) {
        $db->exec('DROP DATABASE `' . $config['db_name'] . '`');
    }
}
