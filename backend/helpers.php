<?php
declare(strict_types=1);

function e(mixed $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function url(string $page = 'lineup', array $params = []): string
{
    return 'index.php?' . http_build_query(['page' => $page] + $params);
}

function asset(string $path): string
{
    return 'index.php?' . http_build_query(['asset' => $path]);
}

function redirect(string $page, array $params = []): never
{
    header('Location: ' . url($page, $params), true, 303);
    exit;
}

function flash(string $message, string $type = 'success'): void
{
    $_SESSION['flash'] = compact('message', 'type');
}

function csrf(): string
{
    return $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}

function csrf_field(): void
{
    echo '<input type="hidden" name="csrf" value="' . e(csrf()) . '">';
}

function verify_csrf(): void
{
    if (!is_string($_POST['csrf'] ?? null) || !hash_equals(csrf(), $_POST['csrf'])) {
        throw new Fleet\HttpException(419, 'Sesi formulir berakhir. Muat ulang halaman lalu coba lagi.');
    }
}

function render(string $page, array $vars = []): void
{
    extract($vars, EXTR_SKIP);
    $content = ROOT_PATH . '/frontend/views/pages/' . $page . '.php';
    require ROOT_PATH . '/frontend/views/layout.php';
}

function date_id(?string $date, bool $short = false): string
{
    if (!$date) {
        return '-';
    }
    $months = $short
        ? ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
        : ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    $d = new DateTimeImmutable($date);
    return $d->format('d') . ' ' . $months[(int) $d->format('n') - 1] . ($short ? '' : ' ' . $d->format('Y'));
}

function status_of(array $row): array
{
    if ($row['dh'] === 'Ya' && $row['mine'] === 'Ya' && $row['ftw'] === 'Ya') {
        return ['SESUAI', 'green'];
    }
    if ($row['mine'] === 'Belum dicek' || $row['ftw'] === 'Belum dicek') {
        return ['BELUM DICEK', 'amber'];
    }
    return ['TINDAK LANJUT', 'red'];
}

function chip(string $text): void
{
    $tone = ['Ya' => 'green', 'Tidak' => 'red', 'Belum dicek' => 'amber'][$text] ?? 'muted';
    echo '<span class="chip ' . $tone . '">' . e($text) . '</span>';
}

function status_pill(array $row): void
{
    [$label, $tone] = status_of($row);
    echo '<span class="status-label ' . $tone . '">' . e($label) . '</span>';
}

function options(array $values, string $selected): void
{
    foreach ($values as $key => $label) {
        $value = is_int($key) ? $label : $key;
        echo '<option value="' . e($value) . '"' . ($value === $selected ? ' selected' : '') . '>' . e($label) . '</option>';
    }
}

function evidence_url(string $path): string
{
    if (str_starts_with($path, '/assets/evidence/')) {
        return asset(substr($path, 8));
    }
    return url('media', ['id' => $path]);
}

function evidence(string $title, string $path): void
{
    echo '<div class="evidence-slot"><h4>' . e($title) . '</h4>';
    if ($path !== '') {
        $src = e(evidence_url($path));
        echo '<a class="image-click" href="' . $src . '" data-lightbox><img loading="lazy" src="' . $src . '" alt="' . e($title) . '"><span>Perbesar gambar</span></a>';
    } else {
        echo '<div class="no-evidence"><p>Belum ada gambar bukti. Tambahkan melalui Edit Line Up.</p></div>';
    }
    echo '</div>';
}
