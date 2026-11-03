@echo off
setlocal
cd /d "%~dp0"
set "DH_PHP="
if exist "C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe" set "DH_PHP=C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe"
if not defined DH_PHP for /d %%P in ("C:\laragon\bin\php\php-*") do if exist "%%~P\php.exe" set "DH_PHP=%%~P\php.exe"
if not defined DH_PHP set "DH_PHP=php"
"%DH_PHP%" backend\cli\install.php
if errorlevel 1 (
    echo Nyalakan MySQL melalui Laragon Start All, lalu jalankan lagi.
    pause
    exit /b 1
)
echo.
echo Selanjutnya jalankan start.bat lalu buka http://localhost:8088
pause
