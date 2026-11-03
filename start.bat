@echo off
setlocal
cd /d "%~dp0"
set "DH_PHP="
if exist "C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe" set "DH_PHP=C:\laragon\bin\php\php-8.1.10-Win32-vs16-x64\php.exe"
if not defined DH_PHP for /d %%P in ("C:\laragon\bin\php\php-*") do if exist "%%~P\php.exe" set "DH_PHP=%%~P\php.exe"
if not defined DH_PHP set "DH_PHP=php"
echo DH FleetSync: http://localhost:8088
echo Biarkan jendela ini terbuka. Tekan Ctrl+C untuk menghentikan server.
"%DH_PHP%" -d upload_max_filesize=10M -d post_max_size=24M -d max_execution_time=120 -S 127.0.0.1:8088 -t public
