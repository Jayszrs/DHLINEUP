<?php
declare(strict_types=1);
namespace Fleet;

use PDO;

final class Repository
{
    public function __construct(public readonly PDO $db, private readonly ?int $userId = null) {}

    public function audit(string $action, string $type, string $id, array $details = []): void
    {
        $s = $this->db->prepare('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)');
        $s->execute([$this->userId, $action, $type, $id, json_encode($details, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
    }

    public function lineups(array $filters = []): array
    {
        $where = [];
        $params = [];
        foreach (['site', 'work_date', 'shift', 'type_category'] as $column) {
            if (!empty($filters[$column]) && $filters[$column] !== 'All') {
                $where[] = '`' . $column . '` = ?';
                $params[] = $filters[$column];
            }
        }
        if (!empty($filters['search'])) {
            $where[] = "CONCAT_WS(' ', unit, equipment, operator_name, nik, note, work_date) LIKE ?";
            $params[] = '%' . $filters['search'] . '%';
        }
        $s = $this->db->prepare('SELECT * FROM lineups' . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY work_date, unit, id');
        $s->execute($params);
        return $s->fetchAll();
    }

    public function lineup(string $id): array
    {
        $s = $this->db->prepare('SELECT * FROM lineups WHERE id = ?');
        $s->execute([$id]);
        return $s->fetch() ?: throw new HttpException(404, 'Data Line Up tidak ditemukan.');
    }

    public function operators(array $filters = []): array
    {
        $s = $this->db->prepare("SELECT * FROM operators WHERE site = ? AND CONCAT_WS(' ', name, nik, unit, equipment) LIKE ? ORDER BY name, id");
        $s->execute([$filters['site'] ?? 'BCP', '%' . ($filters['search'] ?? '') . '%']);
        return $s->fetchAll();
    }

    public function operator(int $id): array
    {
        $s = $this->db->prepare('SELECT * FROM operators WHERE id = ?');
        $s->execute([$id]);
        return $s->fetch() ?: throw new HttpException(404, 'Master Operator tidak ditemukan.');
    }

    private function syncOperator(array $row): void
    {
        if ($row['nik'] === '') {
            return;
        }
        // Identitas pada Line Up adalah snapshot historis; master mengikuti penugasan terbaru.
        $s = $this->db->prepare("INSERT INTO operators (site, nik, name, unit, equipment, last_date) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            name = IF(last_date IS NULL OR last_date <= VALUES(last_date), VALUES(name), name),
            unit = IF(last_date IS NULL OR last_date <= VALUES(last_date), VALUES(unit), unit),
            equipment = IF(last_date IS NULL OR last_date <= VALUES(last_date), VALUES(equipment), equipment),
            version = version + 1,
            last_date = GREATEST(COALESCE(last_date, '1900-01-01'), VALUES(last_date))");
        $s->execute([$row['site'], $row['nik'], $row['operator_name'], $row['unit'], $row['equipment'], $row['work_date']]);
    }

    public function insertLineup(array $row, ?string $id = null): string
    {
        $id ??= 'php-' . bin2hex(random_bytes(12));
        $row += ['proof_ftw' => '', 'proof_mine' => '', 'source' => 'Input PHP', 'source_row' => null];
        $columns = ['site', 'work_date', 'shift', 'type_category', 'unit', 'equipment', 'operator_name', 'nik', 'dh', 'mine', 'ftw', 'source_status', 'note', 'proof_ftw', 'proof_mine', 'source', 'source_row'];
        $s = $this->db->prepare('INSERT INTO lineups (id, ' . implode(', ', $columns) . ') VALUES (' . implode(',', array_fill(0, count($columns) + 1, '?')) . ')');
        $s->execute([$id, ...array_map(static fn($key) => $row[$key], $columns)]);
        $this->syncOperator($row);
        $this->audit('create', 'lineup', $id, ['unit' => $row['unit'], 'date' => $row['work_date']]);
        return $id;
    }

    public function updateLineup(string $id, int $version, array $row): void
    {
        $allowed = ['site', 'work_date', 'shift', 'type_category', 'unit', 'equipment', 'operator_name', 'nik', 'dh', 'mine', 'ftw', 'source_status', 'note', 'proof_ftw', 'proof_mine'];
        $row = array_intersect_key($row, array_flip($allowed));
        $set = implode(', ', array_map(static fn($key) => '`' . $key . '` = ?', array_keys($row)));
        $s = $this->db->prepare('UPDATE lineups SET ' . $set . ', version = version + 1 WHERE id = ? AND version = ?');
        $s->execute([...array_values($row), $id, $version]);
        if ($s->rowCount() !== 1) {
            throw new HttpException(409, 'Data sudah berubah atau dihapus pengguna lain. Buka ulang formulir sebelum menyimpan.');
        }
        $this->syncOperator($row);
        $this->audit('update', 'lineup', $id, ['unit' => $row['unit'], 'version' => $version + 1]);
    }

    public function deleteLineup(string $id, int $version): void
    {
        $s = $this->db->prepare('DELETE FROM lineups WHERE id = ? AND version = ?');
        $s->execute([$id, $version]);
        if ($s->rowCount() !== 1) {
            throw new HttpException(409, 'Data sudah berubah. Muat ulang sebelum menghapus.');
        }
        $this->audit('delete', 'lineup', $id);
    }

    public function saveOperator(array $row, ?int $id, int $version): int
    {
        if ($id) {
            $s = $this->db->prepare('UPDATE operators SET site=?, name=?, nik=?, unit=?, equipment=?, last_date=?, version=version+1 WHERE id=? AND version=?');
            $s->execute([...array_values($row), $id, $version]);
            if ($s->rowCount() !== 1) {
                throw new HttpException(409, 'Profil sudah berubah. Muat ulang formulir.');
            }
        } else {
            $s = $this->db->prepare('INSERT INTO operators (site, name, nik, unit, equipment, last_date) VALUES (?, ?, ?, ?, ?, ?)');
            $s->execute(array_values($row));
            $id = (int) $this->db->lastInsertId();
        }
        $this->audit('save', 'operator', (string) $id, ['nik' => $row['nik']]);
        return $id;
    }

    public function deleteOperator(int $id, int $version): void
    {
        $row = $this->operator($id);
        $s = $this->db->prepare('SELECT COUNT(*) FROM lineups WHERE site=? AND nik=?');
        $s->execute([$row['site'], $row['nik']]);
        if ((int) $s->fetchColumn() > 0) {
            throw new HttpException(409, 'Operator masih memiliki riwayat Line Up dan tidak dapat dihapus.');
        }
        $s = $this->db->prepare('DELETE FROM operators WHERE id=? AND version=?');
        $s->execute([$id, $version]);
        if ($s->rowCount() !== 1) {
            throw new HttpException(409, 'Profil sudah berubah. Muat ulang sebelum menghapus.');
        }
        $this->audit('delete', 'operator', (string) $id);
    }

    public function auditRows(): array
    {
        return $this->db->query('SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200')->fetchAll();
    }
}
