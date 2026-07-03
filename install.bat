@echo off
chcp 65001 >nul
title Install Server Access Portal AST

echo ============================================
echo  Server Access Portal AST — Installer
echo ============================================
echo.

REM Cek Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js tidak ditemukan!
    echo Silakan install Node.js dari https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js %node_version% terdeteksi

REM Install frontend
echo.
echo [1/3] Install frontend dependencies...
cd /d "%~dp0"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Gagal install frontend
    pause
    exit /b 1
)

REM Install backend
echo.
echo [2/3] Install backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Gagal install backend
    pause
    exit /b 1
)

REM Setup database (hanya jika belum ada)
echo.
echo [3/3] Setup database...
if not exist portal.db (
    node seed.js
    echo [OK] Database dibuat
) else (
    echo [OK] Database sudah ada (skip seed)
)

echo.
echo ============================================
echo  INSTALASI SELESAI!
echo ============================================
echo.
echo Jalankan START.bat untuk memulai server.
echo.
pause
