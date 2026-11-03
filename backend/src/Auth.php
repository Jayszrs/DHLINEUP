<?php
declare(strict_types=1);
namespace Fleet;

use PDO;

final class Auth
{
    public function __construct(private readonly PDO $db) {}

    public function user(): ?array
    {
        if (empty($_SESSION['user_id'])) {
            return null;
        }
        if (time() - ($_SESSION['last_activity'] ?? 0) > 28800) {
            $this->logout();
            return null;
        }
        $s = $this->db->prepare('SELECT id, name, username FROM users WHERE id=?');
        $s->execute([$_SESSION['user_id']]);
        $_SESSION['last_activity'] = time();
        return $s->fetch() ?: null;
    }

    public function needsSetup(): bool
    {
        return (int) $this->db->query('SELECT COUNT(*) FROM users')->fetchColumn() === 0;
    }

    public function setup(array $input): void
    {
        if (!in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) {
            throw new HttpException(403, 'Buat akun pertama dari browser di laptop server (localhost).');
        }
        $name = Validation::text($input, 'name', 120, true);
        $username = Validation::text($input, 'username', 80, true);
        $password = Validation::text($input, 'password', 128, true);
        if (!preg_match('/^[a-zA-Z0-9_.-]{3,80}$/', $username) || strlen($password) < 10) {
            throw new HttpException(422, 'Username minimal 3 karakter (huruf/angka/titik/garis). Password minimal 10 karakter.');
        }
        if ($password !== ($input['password_confirmation'] ?? '')) {
            throw new HttpException(422, 'Konfirmasi password tidak cocok.');
        }
        $this->db->beginTransaction();
        try {
            $this->db->query("SELECT setting_value FROM app_settings WHERE setting_key='bootstrap' FOR UPDATE");
            if (!$this->needsSetup()) {
                throw new HttpException(409, 'Akun pertama sudah dibuat. Silakan login.');
            }
            $s = $this->db->prepare('INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)');
            $s->execute([$name, $username, password_hash($password, PASSWORD_DEFAULT)]);
            $id = (int) $this->db->lastInsertId();
            (new Repository($this->db, $id))->audit('setup', 'user', (string) $id);
            $this->db->commit();
        } catch (\Throwable $e) {
            $this->db->rollBack();
            throw $e;
        }
        $this->establish($id);
    }

    public function login(array $input): void
    {
        $username = Validation::text($input, 'username', 80, true);
        $password = Validation::text($input, 'password', 128, true);
        // Per-IP lock juga membatasi percobaan dengan username yang terus diganti.
        $key = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'local');
        $s = $this->db->prepare('SELECT * FROM login_attempts WHERE attempt_key=?');
        $s->execute([$key]);
        $attempt = $s->fetch();
        if ($attempt && $attempt['attempts'] >= 5 && strtotime($attempt['last_attempt']) > time() - 900) {
            throw new HttpException(429, 'Terlalu banyak percobaan login. Tunggu 15 menit.');
        }
        $s = $this->db->prepare('SELECT * FROM users WHERE username=?');
        $s->execute([$username]);
        $user = $s->fetch();
        $hash = $user['password_hash'] ?? '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.';
        $valid = password_verify($password, $hash);
        if (!$user || !$valid) {
            $s = $this->db->prepare('INSERT INTO login_attempts (attempt_key, attempts, last_attempt) VALUES (?,1,NOW()) ON DUPLICATE KEY UPDATE attempts=IF(last_attempt < DATE_SUB(NOW(), INTERVAL 15 MINUTE),1,attempts+1), last_attempt=NOW()');
            $s->execute([$key]);
            throw new HttpException(422, 'Username atau password tidak cocok.');
        }
        $this->db->prepare('DELETE FROM login_attempts WHERE attempt_key=?')->execute([$key]);
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $this->db->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
        }
        $this->establish((int) $user['id']);
        (new Repository($this->db, (int) $user['id']))->audit('login', 'user', (string) $user['id']);
    }

    private function establish(int $id): void
    {
        session_regenerate_id(true);
        $_SESSION = ['user_id' => $id, 'last_activity' => time(), 'csrf' => bin2hex(random_bytes(32))];
    }

    public function logout(): void
    {
        $_SESSION = [];
        session_regenerate_id(true);
    }
}
