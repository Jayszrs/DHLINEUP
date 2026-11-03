<?php
declare(strict_types=1);
namespace Fleet;

use PDO;

final class Database
{
    public static function connect(array $config, bool $withDatabase = true): PDO
    {
        foreach (['db_name', 'db_host', 'db_port'] as $key) {
            if (!preg_match('/^[a-zA-Z0-9_.:-]+$/', (string) $config[$key])) {
                throw new \RuntimeException('Konfigurasi database tidak valid: ' . $key);
            }
        }
        $dsn = 'mysql:host=' . $config['db_host'] . ';port=' . $config['db_port'] . ';charset=utf8mb4';
        if ($withDatabase) {
            $dsn .= ';dbname=' . $config['db_name'];
        }
        $pdo = new PDO($dsn, $config['db_user'], $config['db_password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec("SET time_zone = '+07:00'");
        return $pdo;
    }
}
