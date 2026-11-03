<?php
declare(strict_types=1);
require dirname(__DIR__) . '/backend/bootstrap.php';

try {
    $assetPath = Fleet\Validation::text($_GET, 'asset', 180);
    if ($assetPath !== '' && (str_starts_with($assetPath, 'css/') || str_starts_with($assetPath, 'js/') || $assetPath === 'dh-logo.png')) {
        Fleet\Files::asset($assetPath);
    }
    try {
        $db = Fleet\Database::connect($config);
        $db->query('SELECT 1 FROM app_settings LIMIT 1');
    } catch (PDOException $error) {
        error_log($error->getMessage());
        http_response_code(503);
        render('error', ['title' => 'Database belum siap', 'message' => 'Nyalakan MySQL di Laragon, lalu jalankan install.bat dari folder proyek. Jika koneksi berbeda, salin backend/config/local.example.php menjadi local.php dan sesuaikan isinya.', 'user' => null]);
        exit;
    }
    (new Fleet\Controller($db, $config))->run();
} catch (Fleet\HttpException $error) {
    http_response_code($error->status);
    render('error', ['title' => 'Permintaan belum dapat diproses', 'message' => $error->getMessage(), 'user' => $user ?? null]);
} catch (PDOException $error) {
    error_log($error->getMessage());
    $duplicate = ($error->errorInfo[1] ?? 0) === 1062;
    http_response_code($duplicate ? 409 : 500);
    render('error', ['title' => $duplicate ? 'Data sudah tersedia' : 'Penyimpanan gagal', 'message' => $duplicate ? 'Kombinasi site, tanggal, shift, unit, dan NIK sudah ada, atau NIK Master Operator sudah digunakan pada site tersebut. Kembali ke formulir dan periksa data.' : 'Data belum tersimpan. Periksa MySQL dan storage/logs/php.log, lalu coba lagi.', 'user' => null]);
} catch (Throwable $error) {
    error_log((string) $error);
    http_response_code(500);
    render('error', ['title' => 'Terjadi kesalahan', 'message' => 'Permintaan belum selesai. Periksa storage/logs/php.log untuk detail lalu coba lagi.', 'user' => null]);
}
