<?php
declare(strict_types=1);
namespace Fleet;

final class Validation
{
    public const SITES = ['BCP', 'ACP', 'KCP', 'SSCP'];
    public const SHIFTS = ['Belum ditentukan', 'D', 'N'];
    public const CATEGORIES = ['Belum diklasifikasi', 'Production', 'Support'];
    public const STATUSES = ['Ya', 'Tidak', 'Belum dicek'];

    public static function text(array $input, string $key, int $max, bool $required = false): string
    {
        if (isset($input[$key]) && !is_scalar($input[$key])) {
            throw new HttpException(422, 'Nilai ' . $key . ' tidak valid.');
        }
        $value = trim((string) ($input[$key] ?? ''));
        if (($required && $value === '') || mb_strlen($value) > $max) {
            throw new HttpException(422, 'Kolom ' . $key . ' wajib sesuai format (maksimal ' . $max . ' karakter).');
        }
        return $value;
    }

    public static function choice(array $input, string $key, array $allowed, ?string $default = null): string
    {
        $value = self::text($input, $key, 80);
        if ($value === '' && $default !== null) {
            return $default;
        }
        if (!in_array($value, $allowed, true)) {
            throw new HttpException(422, 'Pilihan ' . $key . ' tidak valid.');
        }
        return $value;
    }

    public static function date(array $input, string $key, bool $required = true): ?string
    {
        $value = self::text($input, $key, 10, $required);
        if ($value === '' && !$required) {
            return null;
        }
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value);
        if (!$date || $date->format('Y-m-d') !== $value || $value < '1900-01-01') {
            throw new HttpException(422, 'Tanggal ' . $key . ' harus valid dengan format YYYY-MM-DD.');
        }
        return $value;
    }

    public static function lineup(array $input): array
    {
        $row = [
            'site' => self::choice($input, 'site', self::SITES),
            'work_date' => self::date($input, 'work_date'),
            'shift' => self::choice($input, 'shift', self::SHIFTS, 'Belum ditentukan'),
            'type_category' => self::choice($input, 'type_category', self::CATEGORIES, 'Belum diklasifikasi'),
        ];
        foreach (['unit' => 60, 'equipment' => 100, 'operator_name' => 150, 'nik' => 60, 'source_status' => 150, 'note' => 10000] as $key => $max) {
            $row[$key] = self::text($input, $key, $max, $key === 'unit');
        }
        foreach (['dh', 'mine', 'ftw'] as $key) {
            $row[$key] = self::choice($input, $key, self::STATUSES, 'Belum dicek');
        }
        $row['unit'] = mb_strtoupper($row['unit']);
        return $row;
    }

    public static function operator(array $input): array
    {
        return [
            'site' => self::choice($input, 'site', self::SITES),
            'name' => self::text($input, 'name', 150, true),
            'nik' => self::text($input, 'nik', 60, true),
            'unit' => mb_strtoupper(self::text($input, 'unit', 60)),
            'equipment' => self::text($input, 'equipment', 100),
            'last_date' => self::date($input, 'last_date', false),
        ];
    }
}
