@echo off
chcp 65001 >nul
cd /d "%~dp0"

set "APP_TITLE=QR-Shroud"
title %APP_TITLE%

echo ========================================================
echo   %APP_TITLE%
echo ========================================================
echo.
echo [*] Ouverture automatique de index.html dans le navigateur...
start "" "%~dp0index.html"
exit /b 0
