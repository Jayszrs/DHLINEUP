<?php
declare(strict_types=1);

$local = is_file(__DIR__ . '/local.php') ? require __DIR__ . '/local.php' : [];
$settings = array_replace([
    'db_host' => '127.0.0.1',
    'db_port' => '3306',
    'db_name' => 'dh_fleetsync',
    'db_user' => 'root',
    'db_password' => '',
    'timezone' => 'Asia/Jakarta',
    'setup_token_hash' => '',
    'allow_local_setup' => true,
], $local);
foreach (['db_host' => 'DH_DB_HOST', 'db_port' => 'DH_DB_PORT', 'db_name' => 'DH_DB_DATABASE', 'db_user' => 'DH_DB_USERNAME', 'db_password' => 'DH_DB_PASSWORD'] as $key => $env) {
    if (getenv($env) !== false) {
        $settings[$key] = getenv($env);
    }
}
return $settings;
