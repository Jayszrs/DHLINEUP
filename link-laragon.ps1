$ErrorActionPreference = 'Stop'
$taskProjectPath = (Resolve-Path -LiteralPath $PSScriptRoot).Path
$taskLaragonWww = 'C:\laragon\www'
$taskLinkPath = Join-Path $taskLaragonWww 'dhlineup'
if (-not (Test-Path -LiteralPath $taskLaragonWww -PathType Container)) {
    throw 'Folder C:\laragon\www tidak ditemukan. Sesuaikan taskLaragonWww dengan lokasi Laragon.'
}
if (Test-Path -LiteralPath $taskLinkPath) {
    $taskExistingLink = Get-Item -LiteralPath $taskLinkPath
    if ($taskExistingLink.LinkType -ne 'Junction' -or $taskExistingLink.Target -notcontains $taskProjectPath) {
        throw "Folder $taskLinkPath sudah tersedia dengan target berbeda. Tidak ada file yang diubah."
    }
    Write-Output 'Junction Laragon sudah sesuai.'
} else {
    New-Item -ItemType Junction -Path $taskLinkPath -Target $taskProjectPath | Out-Null
    Write-Output "Junction dibuat: $taskLinkPath -> $taskProjectPath"
}
Write-Output 'Nyalakan Laragon Start All, jalankan install.bat, lalu buka http://localhost/dhlineup/'
