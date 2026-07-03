# Server Access Portal AST — Setup & Rollback Guide

Panduan instalasi di PC/Laptop Windows yang benar-benar fresh (baru install Windows).

---

## Prasyarat

### 1. Install Node.js 20+ (wajib)

Download dan install dari: https://nodejs.org

Pilih versi **LTS** (20.x atau 22.x). Centang "Automatically install the necessary tools" saat instalasi.

**Verifikasi:**
```cmd
node --version   → v22.x.x
npm --version    → v10.x.x
```

### 2. Install Git (opsional, untuk clone repo)

Download dari: https://git-scm.com/download/win

Kalau tidak install Git, bisa download ZIP dari GitHub.

---

## Cara 1: Clone via Git (rekomendasi)

```cmd
cd C:\Users\%USERNAME%
git clone git@github.com:irsanrochendi/server-access-portal.git
cd server-access-portal
```

> Kalau SSH belum disetup, pakai HTTPS:
> ```
> git clone https://github.com/irsanrochendi/server-access-portal.git
> ```

## Cara 2: Download ZIP

1. Buka https://github.com/irsanrochendi/server-access-portal
2. Klik tombol hijau **Code** → **Download ZIP**
3. Extract ke folder, misal `C:\Users\%USERNAME%\server-access-portal`

---

## Instalasi

### Otomatis (double-click)

```
Double-click: install.bat
```

### Manual

```cmd
cd server-access-portal

REM 1. Install dependencies frontend
npm install

REM 2. Install dependencies backend
cd backend
npm install

REM 3. Setup database (sekali saja)
node seed.js
```

Database `portal.db` akan dibuat di folder `backend/`. Isinya: 2 user default + settings. **Tidak ada server demo.**

---

## Menjalankan

### Otomatis (double-click)

```
Double-click: start.bat
```
Akan membuka 2 terminal: backend (port 4000) dan frontend (port 3000).

### Manual

**Terminal 1 — Backend:**
```cmd
cd backend
node server.js
```

**Terminal 2 — Frontend:**
```cmd
npm run dev
```

### Akses

Buka browser → **http://localhost:3000**

| User | Email | Password |
|---|---|---|
| Admin | admin@portal.local | admin123 |
| Staff | staff@portal.local | staff123 |

---

## Membawa Data dari Laptop Lain

Copy file `backend/portal.db` dari laptop lama ke laptop baru (folder yang sama).

---

## Rollback & Backup

### Lapisan Backup

| # | Apa | Lokasi | Cara Rollback |
|---|---|---|---|
| 1 | **GitHub** (source code) | `github.com/irsanrochendi/server-access-portal` | `git revert HEAD` |
| 2 | **Database** (data user/server) | `backend/portal.db.backup` | Copy manual |
| 3 | **Git commit history** | Setiap perubahan ada commit message | `git log --oneline` |

### Rollback Kode ke Commit Sebelumnya

```cmd
cd C:\Users\%USERNAME%\server-access-portal
git log --oneline -5   REM lihat 5 commit terakhir
git revert HEAD --no-edit   REM undo commit terbaru
git push   REM push undo ke GitHub
```

> `git revert` membuat commit BARU yang membalikkan perubahan. History tetap utuh.
> Kalau mau hard reset: `git reset --hard HEAD~1` (hati-hati — menghancurkan commit terakhir).

### Rollback ke Commit Tertentu

```cmd
git log --oneline
REM Copy commit hash yang diinginkan, contoh: abc1234
git revert abc1234..HEAD --no-edit   REM undo dari commit itu sampai sekarang
git push
```

### Rollback Database (Data Server & User)

```cmd
cd backend

REM 1. Stop backend dulu (Ctrl+C di terminal backend)

REM 2. Copy backup → database utama
copy portal.db.backup portal.db /Y

REM 3. Start backend lagi
node server.js
```

> Jika `portal.db.backup` tidak ada, database akan dibuat ulang oleh `node seed.js` (hanya user & settings dasar, tanpa data server).

### Manual Backup Database Sebelum Perubahan Besar

```cmd
cd backend
copy portal.db portal.db.manual.%DATE:~-10,2%%DATE:~-7,2%%DATE:~-4,4%.backup
REM Contoh: portal.db.manual.01072026.backup
```

### Reset Total ke Kondisi Awal

```cmd
REM Hapus database
del backend\portal.db /F

REM Seed ulang (user + settings dasar saja)
cd backend
node seed.js
node seed-extra.js   REM server milik Anda

REM Start ulang
node server.js

REM AD Users harus di-re-sync dari UI (klik Sync AD di halaman Users)
```

### Remote Lain / PC Lain — Cara Pull

```cmd
cd C:\Users\%USERNAME%\server-access-portal
git pull
cd backend
npm install

REM Kalau DB belum ada:
node seed.js
node seed-extra.js

node server.js
```

---

## Ubah Port

### Frontend (default: 3000)

Edit file `vite.config.js`:

```js
// vite.config.js
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 8080,   // ← ganti disini (contoh: 8080)
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  // ...
})
```

### Backend (default: 4000)

Edit file `backend/server.js`:

```js
const PORT = process.env.PORT || 4000;
//                            ^^^^ ganti disini (contoh: 5000)
```

Atau lewat environment variable tanpa edit file:
```cmd
set PORT=5000
node server.js
```

### Contoh: Frontend di port 80, Backend di port 3001

**vite.config.js:**
```js
port: 80,
proxy: { '/api': { target: 'http://localhost:3001' } }
```

**backend/server.js:**
```js
const PORT = process.env.PORT || 3001;
```

> Kalau ganti backend port, jangan lupa update `target` di `vite.config.js` proxy juga.

## Akses dari PC Lain di Jaringan

Frontend (`vite.config.js`) sudah listen ke `0.0.0.0` — bisa diakses dari IP lokal:
```
http://192.168.x.x:3000
```

Backend (`backend/server.js`) juga sudah listen ke `0.0.0.0`.

Untuk akses penuh:
1. Pastikan firewall Windows mengizinkan port 3000 & 4000
2. Buka `http://<IP-LAPTOP>:3000` dari PC lain di jaringan

---

### "npm is not recognized"
Node.js belum diinstall atau perlu restart terminal.

### "Cannot find module"
Jalankan `npm install` di folder root dan folder backend.

### Backend error "ECONNREFUSED"
Pastikan backend sudah dijalankan (`node server.js` di folder backend).

### Halaman login blank putih
Buka DevTools (F12) → Console → lihat error. Paling umum: backend belum jalan.
