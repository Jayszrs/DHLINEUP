<?php
declare(strict_types=1);
namespace Fleet;

use ZipArchive;

final class Spreadsheet
{
    private const MAX_ROWS = 5000;
    public const LINEUP_HEADERS = ['Tanggal', 'Site', 'Shift', 'Type', 'Kode Alat', 'Jenis Alat', 'Nama Operator', 'NIK Operator', 'DH Line Up', 'Mine Dispatch', 'FTW Terisi', 'Status Sumber', 'Catatan'];

    public static function exportRows(array $rows, bool $operators = false): array
    {
        $fields = $operators ? ['site', 'name', 'nik', 'unit', 'equipment', 'last_date'] : ['work_date', 'site', 'shift', 'type_category', 'unit', 'equipment', 'operator_name', 'nik', 'dh', 'mine', 'ftw', 'source_status', 'note'];
        $output = [$operators ? ['Site', 'Nama Operator', 'NIK', 'Unit Terakhir', 'Jenis Alat', 'Tanggal Terakhir'] : self::LINEUP_HEADERS];
        foreach ($rows as $row) {
            $output[] = array_map(static fn($key) => (string) ($row[$key] ?? ''), $fields);
        }
        return $output;
    }

    public static function writeXlsx(array $rows, string $path): void
    {
        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Tidak dapat membuat file Excel.');
        }
        $parts = [
            '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
            '_rels/.rels' => '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
            'xl/workbook.xml' => '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Line Up" sheetId="1" r:id="rId1"/></sheets></workbook>',
            'xl/_rels/workbook.xml.rels' => '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        ];
        $xml = '<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="13" width="22" customWidth="1"/></cols><sheetData>';
        foreach ($rows as $i => $row) {
            $xml .= '<row r="' . ($i + 1) . '">';
            foreach (array_values($row) as $j => $value) {
                $text = preg_replace('/[^\x09\x0A\x0D\x20-\x{D7FF}\x{E000}-\x{FFFD}\x{10000}-\x{10FFFF}]/u', '', (string) $value) ?? '';
                $xml .= '<c r="' . self::column($j) . ($i + 1) . '" t="inlineStr"><is><t xml:space="preserve">' . htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</t></is></c>';
            }
            $xml .= '</row>';
        }
        $xml .= '</sheetData><autoFilter ref="A1:' . self::column(count($rows[0]) - 1) . count($rows) . '"/></worksheet>';
        $parts['xl/worksheets/sheet1.xml'] = $xml;
        foreach ($parts as $name => $content) {
            $zip->addFromString($name, $content);
        }
        if (!$zip->close()) {
            throw new \RuntimeException('Gagal menyelesaikan file Excel.');
        }
    }

    private static function column(int $index): string
    {
        $name = '';
        for ($index++; $index > 0; $index = intdiv($index - 1, 26)) {
            $name = chr(65 + ($index - 1) % 26) . $name;
        }
        return $name;
    }

    public static function read(string $path, string $extension): array
    {
        if (!in_array($extension, ['csv', 'xlsx'], true)) {
            throw new HttpException(422, 'Format yang didukung: XLSX dan CSV. Simpan ulang file XLS lama menjadi XLSX melalui Excel.');
        }
        return $extension === 'xlsx' ? self::readXlsx($path) : self::readCsv($path);
    }

    private static function readCsv(string $path): array
    {
        $handle = fopen($path, 'rb');
        if (!$handle) {
            throw new HttpException(422, 'File CSV tidak dapat dibaca.');
        }
        try {
            $first = fgets($handle) ?: '';
            $delimiter = ',';
            foreach ([';', "\t"] as $candidate) {
                if (count(str_getcsv($first, $candidate)) > count(str_getcsv($first, $delimiter))) {
                    $delimiter = $candidate;
                }
            }
            rewind($handle);
            $rows = [];
            while (($row = fgetcsv($handle, 0, $delimiter)) !== false) {
                $rows[] = array_map(static function ($value) {
                    $text = (string) $value;
                    return mb_check_encoding($text, 'UTF-8') ? $text : mb_convert_encoding($text, 'UTF-8', 'Windows-1252');
                }, $row);
                if (count($rows) > self::MAX_ROWS + 30 || count($row) > 100) {
                    throw new HttpException(422, 'Maksimal 5.000 baris data dan 100 kolom per impor.');
                }
            }
            return ['rows' => $rows, 'date1904' => false];
        } finally {
            fclose($handle);
        }
    }

    private static function xml(ZipArchive $zip, string $name): \SimpleXMLElement
    {
        $info = $zip->statName($name);
        if (!$info || $info['size'] > 20 * 1024 * 1024) {
            throw new HttpException(422, 'Struktur XLSX tidak valid atau lembar terlalu besar.');
        }
        $raw = $zip->getFromName($name);
        if ($raw === false || preg_match('/<!DOCTYPE|<!ENTITY/i', $raw)) {
            throw new HttpException(422, 'XML pada XLSX tidak valid.');
        }
        $old = libxml_use_internal_errors(true);
        try {
            $xml = simplexml_load_string($raw, \SimpleXMLElement::class, LIBXML_NONET | LIBXML_COMPACT);
            if ($xml === false) {
                throw new HttpException(422, 'XML pada XLSX rusak.');
            }
            return $xml;
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($old);
        }
    }

    private static function texts(\SimpleXMLElement $node): string
    {
        $texts = $node->xpath('.//*[local-name()="t"]') ?: [];
        return implode('', array_map(static fn($text) => (string) $text, $texts));
    }

    private static function readXlsx(string $path): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::RDONLY) !== true) {
            throw new HttpException(422, 'File XLSX tidak valid.');
        }
        try {
            if ($zip->numFiles > 3000) {
                throw new HttpException(422, 'File XLSX terlalu kompleks. Ekspor hanya sheet Line Up.');
            }
            $total = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $total += $zip->statIndex($i)['size'];
            }
            if ($total > 100 * 1024 * 1024) {
                throw new HttpException(422, 'Ukuran isi XLSX melebihi 100 MB.');
            }
            $workbook = self::xml($zip, 'xl/workbook.xml');
            $sheets = $workbook->xpath('//*[local-name()="sheet"]') ?: [];
            $sheet = $sheets[0] ?? null;
            foreach ($sheets as $candidate) {
                if (preg_match('/line/i', (string) $candidate['name'])) {
                    $sheet = $candidate;
                    break;
                }
            }
            if (!$sheet) {
                throw new HttpException(422, 'Sheet tidak ditemukan pada XLSX.');
            }
            $attrs = $sheet->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships');
            $relationshipId = (string) $attrs['id'];
            $rels = self::xml($zip, 'xl/_rels/workbook.xml.rels');
            $sheetPath = '';
            foreach ($rels->xpath('//*[local-name()="Relationship"]') ?: [] as $rel) {
                if ((string) $rel['Id'] === $relationshipId && (string) $rel['TargetMode'] !== 'External') {
                    $target = (string) $rel['Target'];
                    $sheetPath = str_starts_with($target, '/') ? ltrim($target, '/') : 'xl/' . $target;
                }
            }
            if (!preg_match('~^xl/worksheets/[a-zA-Z0-9_.-]+\.xml$~', $sheetPath)) {
                throw new HttpException(422, 'Lokasi sheet XLSX tidak didukung.');
            }
            $shared = [];
            if ($zip->locateName('xl/sharedStrings.xml') !== false) {
                foreach (self::xml($zip, 'xl/sharedStrings.xml')->xpath('//*[local-name()="si"]') ?: [] as $si) {
                    $shared[] = self::texts($si);
                }
            }
            $rows = [];
            $sheetXml = self::xml($zip, $sheetPath);
            foreach ($sheetXml->xpath('//*[local-name()="sheetData"]/*[local-name()="row"]') ?: [] as $row) {
                $cells = [];
                foreach ($row->xpath('./*[local-name()="c"]') ?: [] as $cell) {
                    preg_match('/^([A-Z]+)/', (string) $cell['r'], $match);
                    $column = 0;
                    foreach (str_split($match[1] ?? 'A') as $letter) {
                        $column = $column * 26 + ord($letter) - 64;
                    }
                    if ($column > 100) {
                        throw new HttpException(422, 'Maksimal 100 kolom per impor.');
                    }
                    $v = $cell->xpath('./*[local-name()="v"]');
                    $value = (string) ($v[0] ?? '');
                    if ((string) $cell['t'] === 's') {
                        $value = $shared[(int) $value] ?? '';
                    } elseif ((string) $cell['t'] === 'inlineStr') {
                        $value = self::texts($cell);
                    }
                    $cells[max(0, $column - 1)] = $value;
                }
                $rows[] = $cells;
                if (count($rows) > self::MAX_ROWS + 30) {
                    throw new HttpException(422, 'Maksimal 5.000 baris data per impor.');
                }
            }
            $properties = $workbook->xpath('//*[local-name()="workbookPr"]');
            $date1904 = isset($properties[0]) && in_array((string) $properties[0]['date1904'], ['1', 'true'], true);
            return compact('rows', 'date1904');
        } finally {
            $zip->close();
        }
    }

    private static function normalize(string $text): string
    {
        return preg_replace('/[^\pL\pN]/u', '', mb_strtolower($text)) ?? '';
    }

    public static function lineups(array $document): array
    {
        $aliases = [
            'work_date' => ['Tanggal', 'Date', 'work_date'], 'site' => ['Site', 'District'],
            'unit' => ['Kode Alat', 'Unit', 'kode_alat'], 'equipment' => ['Jenis Alat', 'equipment'],
            'operator_name' => ['Nama Operator', 'Operator', 'operator_name'], 'nik' => ['NIK Operator', 'NIK'],
            'shift' => ['Shift'], 'type_category' => ['Type', 'Kategori', 'type_category'],
            'dh' => ['DH Line Up', 'Terdata di DH Line Up', 'dh_line_up'],
            'mine' => ['Mine Dispatch', 'Terdata di Mine Dispatch?', 'mine_dispatch'],
            'ftw' => ['FTW Terisi', 'FTW Terisi?', 'ftw_terisi'],
            'source_status' => ['Status Sumber', 'Status Verifikasi'], 'note' => ['Catatan', 'Note'],
        ];
        $lookup = [];
        foreach ($aliases as $field => $names) {
            foreach ($names as $name) {
                $lookup[self::normalize($name)] = $field;
            }
        }
        $mapping = [];
        $output = [];
        foreach ($document['rows'] as $i => $cells) {
            if (!$mapping) {
                $candidate = [];
                foreach ($cells as $index => $header) {
                    $field = $lookup[self::normalize((string) $header)] ?? null;
                    if ($field) {
                        $candidate[$index] = $field;
                    }
                }
                if (in_array('unit', $candidate, true) && in_array('work_date', $candidate, true)) {
                    $mapping = $candidate;
                } elseif ($i >= 29) {
                    break;
                }
                continue;
            }
            if (!array_filter($cells, static fn($v) => trim((string) $v) !== '')) {
                continue;
            }
            if (count($output) >= self::MAX_ROWS) {
                throw new HttpException(422, 'Maksimal 5.000 baris data per impor.');
            }
            $row = [];
            foreach ($mapping as $index => $field) {
                $row[$field] = trim((string) ($cells[$index] ?? ''));
            }
            foreach (['site' => 'BCP', 'shift' => 'Belum ditentukan', 'type_category' => 'Belum diklasifikasi'] as $field => $default) {
                if (($row[$field] ?? '') === '') {
                    $row[$field] = $default;
                }
            }
            foreach (['dh', 'mine', 'ftw'] as $field) {
                $raw = mb_strtolower($row[$field] ?? '');
                $row[$field] = match ($raw) {
                    'ya', 'yes' => 'Ya', 'tidak', 'no' => 'Tidak', '', 'belum dicek' => 'Belum dicek',
                    default => throw new HttpException(422, 'Baris ' . ($i + 1) . ': status ' . $field . ' harus Ya, Tidak, atau Belum dicek.'),
                };
            }
            $date = $row['work_date'] ?? '';
            if (preg_match('/^\d+(\.\d+)?$/', $date) && (float) $date > 0 && (float) $date < 3000000) {
                $base = !empty($document['date1904']) ? '1904-01-01' : '1899-12-30';
                $row['work_date'] = (new \DateTimeImmutable($base))->modify('+' . (int) $date . ' days')->format('Y-m-d');
            } elseif (preg_match('~^(\d{2})/(\d{2})/(\d{4})$~', $date, $m)) {
                $row['work_date'] = $m[3] . '-' . $m[2] . '-' . $m[1];
            }
            try {
                $output[] = Validation::lineup($row) + ['source' => 'Impor XLSX/CSV'];
            } catch (HttpException $error) {
                throw new HttpException(422, 'Baris ' . ($i + 1) . ': ' . $error->getMessage());
            }
        }
        if (!$mapping || !$output) {
            throw new HttpException(422, 'Tidak ada data valid. Gunakan template dengan kolom Tanggal dan Kode Alat.');
        }
        return $output;
    }
}
