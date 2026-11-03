<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
require dirname(__DIR__) . '/bootstrap.php';

$output = ROOT_PATH . '/dist/infinityfree';
$site = $output . '/site';
$options = getopt('', ['domain:', 'update']);
$updating = array_key_exists('update', $options);
$domain = (string) ($options['domain'] ?? '');
if ($domain !== '' && !preg_match('/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/', $domain)) {
    throw new RuntimeException('Domain deployment tidak valid.');
}
if (!is_dir($output) && !mkdir($output, 0700, true)) {
    throw new RuntimeException('Tidak dapat membuat folder paket deployment.');
}
if (!is_file(ROOT_PATH . '/dist/.htaccess')) {
    file_put_contents(ROOT_PATH . '/dist/.htaccess', "Require all denied\n");
}
$tokenPath = $output . '/activation-code.txt';
if (!is_file($tokenPath)) {
    file_put_contents($tokenPath, bin2hex(random_bytes(32)) . PHP_EOL, LOCK_EX);
}
$activation = trim(file_get_contents($tokenPath));
if (!preg_match('/^[a-f0-9]{64}$/', $activation)) {
    throw new RuntimeException('File kode aktivasi lokal tidak valid.');
}
$allowed = ['index.php', '.htaccess', 'backend/bootstrap.php', 'backend/helpers.php', 'backend/.htaccess', 'backend/config/app.php', 'backend/config/local.example.php', 'frontend/.htaccess', 'frontend/assets/dh-logo.png', 'storage/.htaccess', 'storage/uploads/.gitkeep', 'storage/logs/.gitkeep'];
foreach (['backend/src', 'frontend/views', 'frontend/assets/css', 'frontend/assets/js', 'public'] as $directory) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(ROOT_PATH . '/' . $directory, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        if ($file->isFile()) {
            $relative = str_replace('\\', '/', substr($file->getPathname(), strlen(ROOT_PATH) + 1));
            if (in_array(pathinfo($relative, PATHINFO_EXTENSION), ['php', 'css', 'js', 'ini'], true) || basename($relative) === '.htaccess') {
                $allowed[] = $relative;
            }
        }
    }
}
sort($allowed);
foreach ($allowed as $relative) {
    $destination = $site . '/' . $relative;
    if (!is_dir(dirname($destination))) {
        mkdir(dirname($destination), 0700, true);
    }
    copy(ROOT_PATH . '/' . $relative, $destination);
}
if ($domain !== '') {
    $rules = file_get_contents($site . '/.htaccess');
    $rules = str_replace('RewriteEngine On', 'RewriteEngine On' . "\n    RewriteCond %{HTTPS} !=on\n    RewriteRule ^ https://" . $domain . '%{REQUEST_URI} [R=301,L]', $rules);
    file_put_contents($site . '/.htaccess', $rules);
}
$localFile = $site . '/backend/config/local.php';
$hosting = is_file($localFile) ? require $localFile : [
    'db_host' => 'sql301.infinityfree.com',
    'db_name' => 'if0_43345481_fleetsync',
    'db_user' => 'if0_43345481',
    'db_password' => '',
];
$hosting['setup_token_hash'] = hash('sha256', $activation);
$hosting['allow_local_setup'] = false;
file_put_contents($localFile, "<?php\nreturn " . var_export($hosting, true) . ";\n", LOCK_EX);
$allowed[] = 'backend/config/local.php';

// Schema saja: tidak ada nama, NIK, akun lokal, maupun referensi bukti sumber.
file_put_contents($output . '/database-empty.sql', file_get_contents(ROOT_PATH . '/database/schema.sql') . "\nINSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('seed_v1', '1');\n");
$zipPath = $output . ($updating ? '/htdocs-update.zip' : '/htdocs.zip');
if ($updating) {
    $allowed = array_values(array_filter($allowed, static fn($path) => $path !== 'backend/config/local.php'));
}
$zip = new ZipArchive();
if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    throw new RuntimeException('Gagal membuat ZIP deployment.');
}
foreach ($allowed as $relative) {
    if (str_contains($relative, '/evidence/') || str_contains($relative, '/reference/') || str_contains($relative, '/seed/')) {
        throw new RuntimeException('Data sumber terdeteksi pada daftar paket.');
    }
    $zip->addFile($site . '/' . $relative, $relative);
}
$zip->close();
file_put_contents($output . '/manifest.json', json_encode([
    'mode' => 'empty-database',
    'https_domain' => $domain,
    'preserves_remote_database_credentials' => $updating,
    'files' => $allowed,
    'source_lineups_included' => 0,
    'source_operator_records_included' => 0,
    'source_evidence_images_included' => 0,
    'activation_code_included_in_zip' => false,
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . PHP_EOL);
echo 'Paket aplikasi: ' . $zipPath . PHP_EOL;
echo 'SQL kosong: ' . $output . '/database-empty.sql' . PHP_EOL;
echo 'Kode aktivasi pemilik disimpan lokal di dist/infinityfree/activation-code.txt. Jangan upload file kode tersebut.' . PHP_EOL;
echo 'Konfigurasi database hosting: dist/infinityfree/site/backend/config/local.php (isi password hosting sebelum upload).' . PHP_EOL;
echo count($allowed) . ' file aplikasi; 0 data operator dan 0 bukti sumber disertakan.' . PHP_EOL;
