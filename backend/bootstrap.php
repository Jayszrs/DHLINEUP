<?php
declare(strict_types=1);

define('ROOT_PATH', dirname(__DIR__));
spl_autoload_register(static function (string $class): void {
    if (str_starts_with($class, 'Fleet\\')) {
        $path = __DIR__ . '/src/' . substr($class, 6) . '.php';
        if (is_file($path)) {
            require $path;
        }
    }
});
$config = require __DIR__ . '/config/app.php';
date_default_timezone_set($config['timezone']);
require __DIR__ . '/helpers.php';
ini_set('display_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', ROOT_PATH . '/storage/logs/php.log');

if (PHP_SAPI !== 'cli') {
    session_name('dh_fleetsync');
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params([
        'httponly' => true,
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'samesite' => 'Lax',
        'path' => rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'])), '/') . '/',
    ]);
    session_start();
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header("Content-Security-Policy: default-src 'self'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    header('Cache-Control: no-store');
}
