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

echo Memulai Frontend (port 3000)...
start "Frontend - Server Access Portal" cmd /c "cd /d %~dp0 && npm run dev"

echo.
echo ============================================
echo  Buka browser → http://localhost:3000
echo ============================================
echo.
echo Login:
echo   Admin: admin@portal.local / admin123
echo   Staff: staff@portal.local / staff123
echo.
echo Tutup window ini setelah kedua terminal muncul.
echo.
timeout /t 5
