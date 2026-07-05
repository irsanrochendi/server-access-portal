@echo off
chcp 65001 >nul
title Server Access Portal AST

echo ============================================
echo  Server Access Portal AST
echo ============================================
echo.

cd /d "%~dp0"

REM Cek apakah dependencies sudah diinstall
if not exist "node_modules" (
    echo [ERROR] Dependencies belum diinstall.
    echo Jalankan INSTALL.bat terlebih dahulu.
    pause
    exit /b 1
)
if not exist "backend\node_modules" (
    echo [ERROR] Backend dependencies belum diinstall.
    echo Jalankan INSTALL.bat terlebih dahulu.
    pause
    exit /b 1
)

echo Memulai Backend (port 4000)...
start "Backend - Server Access Portal" cmd /c "cd /d %~dp0backend && node server.js && pause"

echo Memulai Frontend (port 80)...
start "Frontend - Server Access Portal" cmd /c "cd /d %~dp0 && npm run dev -- --port 80 --host"

echo.
echo ============================================
echo  Server berjalan!
echo ============================================
echo.
timeout /t 3 >nul

echo Membuka browser...
start http://localhost:80

echo Tutup window ini setelah kedua terminal muncul.
echo.
timeout /t 5
