<?php
declare(strict_types=1);
namespace Fleet;

use PDO;

/** All signed-in accounts share the same permissions for this release. */
final class Accounts
{
    public const ROLE = 'Pengelola';

    public function __construct(private readonly PDO $db, private readonly int $actor) {}

    public function all(): array
    {
        return $this->db->query('SELECT id, name, username, created_at FROM users ORDER BY created_at, id')->fetchAll();
    }

    public function saveProfile(array $input): void
    {
        [$name, $username] = $this->identity($input);
        $this->transaction(function () use ($name, $username): void {
            $this->db->prepare('UPDATE users SET name=?, username=? WHERE id=?')->execute([$name, $username, $this->actor]);
            (new Repository($this->db, $this->actor))->audit('profile_update', 'user', (string) $this->actor, ['username' => $username]);
        });
    }

    public function create(array $input): void
    {
        [$name, $username] = $this->identity($input);
        $attempt = $_SESSION['account_verification'] ?? ['count' => 0, 'time' => 0];
        if ($attempt['count'] >= 5 && $attempt['time'] > time() - 900) {
            throw new HttpException(429, 'Terlalu banyak percobaan verifikasi. Tunggu 15 menit.');
        }
        $s = $this->db->prepare('SELECT password_hash FROM users WHERE id=?');
        $s->execute([$this->actor]);
        $current = Validation::text($input, 'current_password', 128, true);
        if (!password_verify($current, (string) $s->fetchColumn())) {
            $_SESSION['account_verification'] = ['count' => $attempt['time'] > time() - 900 ? $attempt['count'] + 1 : 1, 'time' => time()];
            throw new HttpException(422, 'Password Anda belum cocok. Akun baru belum dibuat.');
        }
        unset($_SESSION['account_verification']);
        $password = Validation::text($input, 'password', 128, true);
        if (mb_strlen($password) < 10 || strlen($password) > 72) {
            throw new HttpException(422, 'Password baru minimal 10 karakter dan maksimal 72 byte.');
        }
        if ($password !== ($input['password_confirmation'] ?? '')) {
            throw new HttpException(422, 'Konfirmasi password baru tidak cocok.');
        }
        $this->transaction(function () use ($name, $username, $password): void {
            $this->db->prepare('INSERT INTO users (name, username, password_hash) VALUES (?, ?, ?)')->execute([$name, $username, password_hash($password, PASSWORD_DEFAULT)]);
            (new Repository($this->db, $this->actor))->audit('account_create', 'user', $this->db->lastInsertId(), ['username' => $username, 'role' => self::ROLE]);
        });
    }

    private function identity(array $input): array
    {
        $name = Validation::text($input, 'name', 120, true);
        $username = Validation::text($input, 'username', 80, true);
        if (!preg_match('/^[a-zA-Z0-9_.-]{3,80}$/', $username)) {
            throw new HttpException(422, 'Username 3–80 karakter: huruf, angka, titik, garis bawah, atau tanda hubung.');
        }
        return [$name, $username];
    }

    private function transaction(callable $action): void
    {
        $this->db->beginTransaction();
        try {
            $action();
            $this->db->commit();
        } catch (\Throwable $error) {
            $this->db->rollBack();
            if ($error instanceof \PDOException && ($error->errorInfo[1] ?? 0) === 1062) {
                throw new HttpException(409, 'Username sudah digunakan. Pilih username lain.');
            }
            throw $error;
        }
    }
}
