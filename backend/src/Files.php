<?php
declare(strict_types=1);
namespace Fleet;

final class Files
{
    public static function asset(string $name): never
    {
        if (!preg_match('~^(dh-logo\.png|css/(source|app)\.css|js/(app|theme)\.js|fonts/tt-firs-neue-bold\.ttf|evidence/[A-Za-z0-9_]+\.png|reference/[A-Za-z0-9_]+\.png)$~', $name)) {
            throw new HttpException(404, 'Aset tidak ditemukan.');
        }
        $path = ROOT_PATH . '/frontend/assets/' . $name;
        if (!is_file($path)) {
            throw new HttpException(404, 'Aset tidak ditemukan.');
        }
        $ext = pathinfo($path, PATHINFO_EXTENSION);
        self::send($path, ['css' => 'text/css; charset=UTF-8', 'js' => 'text/javascript; charset=UTF-8', 'png' => 'image/png', 'ttf' => 'font/ttf'][$ext]);
    }

    public static function media(string $id): never
    {
        if (!preg_match('/^[a-f0-9]{48}\.(jpg|png|webp)$/', $id)) {
            throw new HttpException(404, 'Gambar tidak ditemukan.');
        }
        $path = ROOT_PATH . '/storage/uploads/' . $id;
        if (!is_file($path)) {
            throw new HttpException(404, 'Gambar tidak ditemukan.');
        }
        self::send($path, (new \finfo(FILEINFO_MIME_TYPE))->file($path));
    }

    private static function send(string $path, string $mime): never
    {
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($path));
        session_write_close();
        readfile($path);
        exit;
    }
}
