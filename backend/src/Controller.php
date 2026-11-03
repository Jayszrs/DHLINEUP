<?php
declare(strict_types=1);
namespace Fleet;

use PDO;

final class Controller
{
    private Auth $auth;
    private Repository $repo;
    private ?array $user = null;

    public function __construct(private readonly PDO $db)
    {
        $this->auth = new Auth($db);
    }

    public function run(): void
    {
        $page = Validation::text($_GET, 'page', 40) ?: 'lineup';
        $isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
        if (!in_array($_SERVER['REQUEST_METHOD'], ['GET', 'HEAD', 'POST'], true)) {
            throw new HttpException(405, 'Metode permintaan tidak didukung.');
        }
        if ($isPost) {
            verify_csrf();
        }
        $this->user = $this->auth->user();
        if ($this->auth->needsSetup()) {
            if ($page !== 'setup') {
                redirect('setup');
            }
            $this->authPage('setup', $isPost);
            return;
        }
        if ($page === 'setup') {
            redirect($this->user ? 'lineup' : 'login');
        }
        if ($page === 'login') {
            if ($this->user) {
                redirect('lineup');
            }
            $this->authPage('login', $isPost);
            return;
        }
        if (!$this->user) {
            redirect('login');
        }
        $this->repo = new Repository($this->db, (int) $this->user['id']);
        if (!empty($_GET['asset'])) {
            Files::asset(Validation::text($_GET, 'asset', 180));
        }
        if ($isPost) {
            $this->mutate($page);
            return;
        }
        $filters = $this->filters();
        switch ($page) {
            case 'lineup':
                $this->view('lineup', ['rows' => $this->repo->lineups($filters), 'filters' => $filters, 'total' => (int) $this->db->query('SELECT COUNT(*) FROM lineups')->fetchColumn()]);
                break;
            case 'dashboard':
                $this->view('dashboard', ['rows' => $this->repo->lineups(['site' => $filters['site']]), 'filters' => $filters]);
                break;
            case 'detail':
                $this->view('detail', ['row' => $this->repo->lineup(Validation::text($_GET, 'id', 80, true))]);
                break;
            case 'lineup-form':
                $id = Validation::text($_GET, 'id', 80);
                $this->view('lineup-form', ['row' => $id ? $this->repo->lineup($id) : $this->newLineup()]);
                break;
            case 'master':
                $this->view('master', ['rows' => $this->repo->operators($filters), 'filters' => $filters]);
                break;
            case 'operator-form':
                $id = (int) Validation::text($_GET, 'id', 20);
                $this->view('operator-form', ['row' => $id ? $this->repo->operator($id) : ['id' => '', 'version' => 0, 'site' => 'BCP', 'nik' => '', 'name' => '', 'unit' => '', 'equipment' => '', 'last_date' => date('Y-m-d')]]);
                break;
            case 'dokumentasi':
                $this->view('dokumentasi', ['rows' => $this->repo->lineups($filters), 'filters' => $filters]);
                break;
            case 'import':
                $this->view('import');
                break;
            case 'export':
                $this->export($filters);
                break;
            case 'audit':
                $this->view('audit', ['rows' => $this->repo->auditRows()]);
                break;
            case 'media':
                Files::media(Validation::text($_GET, 'id', 100, true));
            case 'logout':
            case 'lineup-save':
            case 'lineup-delete':
            case 'operator-save':
            case 'operator-delete':
                throw new HttpException(405, 'Aksi ini harus dikirim melalui formulir.');
            default:
                throw new HttpException(404, 'Halaman tidak ditemukan.');
        }
    }

    private function authPage(string $page, bool $isPost): void
    {
        $errorMessage = '';
        if ($isPost) {
            try {
                $page === 'setup' ? $this->auth->setup($_POST) : $this->auth->login($_POST);
                flash($page === 'setup' ? 'Akun pertama berhasil dibuat. Selamat bekerja.' : 'Login berhasil.');
                redirect('lineup');
            } catch (HttpException $error) {
                http_response_code($error->status);
                $errorMessage = $error->getMessage();
            }
        }
        render($page, ['user' => null, 'errorMessage' => $errorMessage]);
    }

    private function view(string $page, array $data = []): void
    {
        render($page, $data + ['user' => $this->user]);
    }

    private function filters(): array
    {
        return [
            'site' => Validation::choice($_GET, 'site', Validation::SITES, 'BCP'),
            'work_date' => Validation::date($_GET, 'work_date', false) ?? '',
            'shift' => Validation::choice($_GET, 'shift', ['All', ...Validation::SHIFTS], 'All'),
            'type_category' => Validation::choice($_GET, 'type_category', ['All', ...Validation::CATEGORIES], 'All'),
            'search' => Validation::text($_GET, 'search', 200),
        ];
    }

    private function newLineup(): array
    {
        return ['id' => '', 'version' => 0, 'site' => 'BCP', 'work_date' => date('Y-m-d'), 'shift' => 'Belum ditentukan', 'type_category' => 'Belum diklasifikasi', 'unit' => '', 'equipment' => '', 'operator_name' => '', 'nik' => '', 'dh' => 'Ya', 'mine' => 'Belum dicek', 'ftw' => 'Belum dicek', 'source_status' => '', 'note' => '', 'proof_ftw' => '', 'proof_mine' => ''];
    }

    private function mutate(string $page): void
    {
        if ($page === 'logout') {
            $this->repo->audit('logout', 'user', (string) $this->user['id']);
            $this->auth->logout();
            redirect('login');
        }
        if (!in_array($page, ['lineup-save', 'lineup-delete', 'operator-save', 'operator-delete', 'import'], true)) {
            throw new HttpException(405, 'Aksi formulir tidak dikenal.');
        }
        $newFiles = [];
        $this->db->beginTransaction();
        try {
            $id = Validation::text($_POST, 'id', 80);
            $version = (int) Validation::text($_POST, 'version', 12);
            $target = 'lineup';
            $params = [];
            if ($page === 'lineup-save') {
                $row = Validation::lineup($_POST);
                $old = $id ? $this->repo->lineup($id) : $this->newLineup();
                foreach (['proof_ftw', 'proof_mine'] as $field) {
                    $uploaded = Upload::image($field);
                    if ($uploaded) {
                        $newFiles[] = $uploaded;
                    }
                    $row[$field] = $uploaded ?? (!empty($_POST['remove_' . $field]) ? '' : $old[$field]);
                }
                if ($id) {
                    $this->repo->updateLineup($id, $version, $row);
                } else {
                    $id = $this->repo->insertLineup($row);
                }
                $target = 'detail';
                $params = ['id' => $id];
                $message = 'Line Up berhasil disimpan ke MySQL.';
            } elseif ($page === 'lineup-delete') {
                $this->repo->deleteLineup($id, $version);
                $message = 'Line Up dihapus. Master Operator dan file bukti arsip tetap tersedia.';
            } elseif ($page === 'operator-save') {
                $row = Validation::operator($_POST);
                $this->repo->saveOperator($row, $id ? (int) $id : null, $version);
                $target = 'master';
                $params = ['site' => $row['site']];
                $message = 'Master Operator disimpan. Riwayat Line Up tetap memakai identitas saat pencatatan.';
            } elseif ($page === 'operator-delete') {
                $this->repo->deleteOperator((int) $id, $version);
                $target = 'master';
                $message = 'Master Operator berhasil dihapus.';
            } else {
                $message = $this->import();
            }
            $this->db->commit();
            flash($message);
            redirect($target, $params);
        } catch (\Throwable $error) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            Upload::removeNew($newFiles);
            $duplicate = $error instanceof \PDOException && ($error->errorInfo[1] ?? 0) === 1062;
            if (($error instanceof HttpException || $duplicate) && in_array($page, ['lineup-save', 'operator-save', 'import'], true)) {
                http_response_code($duplicate ? 409 : $error->status);
                $errorMessage = $duplicate ? 'Data duplikat. Periksa kombinasi site, tanggal, shift, unit, dan NIK atau NIK master pada site yang sama.' : $error->getMessage();
                if ($page === 'import') {
                    $this->view('import', compact('errorMessage'));
                } else {
                    $form = $page === 'lineup-save' ? 'lineup-form' : 'operator-form';
                    $base = $page === 'lineup-save' ? ($id ? $this->repo->lineup($id) : $this->newLineup()) : ($id ? $this->repo->operator((int) $id) : ['id' => '', 'version' => 0]);
                    $safeInput = array_filter($_POST, static fn($value) => is_string($value));
                    $row = array_replace($base, array_intersect_key($safeInput, array_flip($page === 'lineup-save' ? ['site', 'work_date', 'shift', 'type_category', 'unit', 'equipment', 'operator_name', 'nik', 'dh', 'mine', 'ftw', 'source_status', 'note'] : ['site', 'name', 'nik', 'unit', 'equipment', 'last_date'])));
                    // Pertahankan versi lama supaya penyimpanan ulang konflik tidak menimpa data terbaru.
                    $row['version'] = $version;
                    $this->view($form, compact('row', 'errorMessage'));
                }
                return;
            }
            throw $error;
        }
    }

    private function import(): string
    {
        $file = $_FILES['spreadsheet'] ?? null;
        if (!$file || $file['error'] !== UPLOAD_ERR_OK || $file['size'] > 10 * 1024 * 1024) {
            throw new HttpException(422, 'Pilih file XLSX/CSV maksimal 10 MB. Periksa batas unggah PHP jika gagal.');
        }
        $document = Spreadsheet::read($file['tmp_name'], strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)));
        $rows = Spreadsheet::lineups($document);
        $inserted = $skipped = 0;
        foreach ($rows as $row) {
            try {
                $this->repo->insertLineup($row);
                $inserted++;
            } catch (\PDOException $error) {
                if (($error->errorInfo[1] ?? 0) !== 1062) {
                    throw $error;
                }
                $skipped++;
            }
        }
        $this->repo->audit('import', 'lineup', '', compact('inserted', 'skipped'));
        return "Impor selesai: {$inserted} data ditambahkan, {$skipped} duplikat dilewati.";
    }

    private function export(array $filters): never
    {
        $kind = Validation::choice($_GET, 'kind', ['lineup', 'master', 'template'], 'lineup');
        $format = Validation::choice($_GET, 'format', ['xlsx', 'csv'], 'xlsx');
        $rows = $kind === 'template' ? [Spreadsheet::LINEUP_HEADERS] : Spreadsheet::exportRows($kind === 'master' ? $this->repo->operators($filters) : $this->repo->lineups($filters), $kind === 'master');
        header('Content-Disposition: attachment; filename="DH_FleetSync_' . $kind . '.' . $format . '"');
        if ($format === 'csv') {
            header('Content-Type: text/csv; charset=UTF-8');
            echo "\xEF\xBB\xBF";
            $out = fopen('php://output', 'wb');
            foreach ($rows as $row) {
                fputcsv($out, array_map(static fn($v) => preg_match('/^[\s]*[=+@-]/u', $v) ? "'" . $v : $v, $row));
            }
            fclose($out);
        } else {
            $temp = tempnam(ROOT_PATH . '/storage/uploads', 'export-');
            try {
                Spreadsheet::writeXlsx($rows, $temp);
                header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                header('Content-Length: ' . filesize($temp));
                session_write_close();
                readfile($temp);
            } finally {
                @unlink($temp);
            }
        }
        exit;
    }
}
