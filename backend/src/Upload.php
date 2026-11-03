<?php
declare(strict_types=1);
namespace Fleet;

final class Upload
{
    public static function image(string $field): ?string
    {
        $file = $_FILES[$field] ?? null;
        if (!$file || $file['error'] === UPLOAD_ERR_NO_FILE) {
            return null;
        }
        if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] > 5 * 1024 * 1024) {
            throw new HttpException(422, 'Unggah gambar gagal. Maksimal 5 MB per gambar; periksa upload_max_filesize PHP.');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$mime] ?? null;
        $size = @getimagesize($file['tmp_name']);
        if (!$ext || !$size || $size[0] * $size[1] > 24000000) {
            throw new HttpException(422, 'Bukti harus JPG, PNG, atau WebP valid dengan maksimal 24 megapiksel.');
        }
        $name = bin2hex(random_bytes(24)) . '.' . $ext;
        if (!move_uploaded_file($file['tmp_name'], ROOT_PATH . '/storage/uploads/' . $name)) {
            throw new \RuntimeException('Folder storage/uploads tidak dapat ditulis.');
        }
        return $name;
    }

    public static function removeNew(array $names): void
    {
        foreach ($names as $name) {
            if (preg_match('/^[a-f0-9]{48}\.(jpg|png|webp)$/', $name)) {
                @unlink(ROOT_PATH . '/storage/uploads/' . $name);
            }
        }
    }
}
