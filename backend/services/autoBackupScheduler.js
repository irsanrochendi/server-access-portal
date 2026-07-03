/**
 * Auto-backup scheduler — berjalan di background server process.
 * Mengecek setiap menit apakah sudah waktunya backup berdasarkan konfigurasi.
 */

let intervalId = null;

export function startAutoBackup() {
  if (intervalId) return; // sudah running

  console.log('⏰ Auto-backup scheduler started (check every 60s)');

  intervalId = setInterval(() => {
    checkAndRun();
  }, 60_000); // cek setiap 60 detik

  // Jalanin langsung setelah start (kalau waktunya tepat)
  setTimeout(() => checkAndRun(), 5_000);
}

export function stopAutoBackup() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('⏰ Auto-backup scheduler stopped');
  }
}

function checkAndRun() {
  // Dynamic import biar tidak cyclic dan bisa reload settings tiap kali
  import('../services/backup.js').then(({
    getBackupSettings,
    runBackup,
    listBackups,
    cleanOldBackups,
  }) => {
    const settings = getBackupSettings();
    if (!settings.autoEnabled) return;

    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Cek frekuensi
    let shouldRun = false;

    if (settings.frequency === 'hourly') {
      // Backup tiap jam pas menit 0
      shouldRun = now.getMinutes() === 0;
    } else if (settings.frequency === 'daily') {
      // Backup sekali sehari di jam yang ditentukan
      shouldRun = currentTime === settings.time;
    } else if (settings.frequency === 'weekly') {
      // Backup setiap hari Minggu jam yang ditentukan
      shouldRun = now.getDay() === 0 && currentTime === settings.time;
    }

    if (shouldRun) {
      // Cek apakah sudah backup dalam rentang ini (biar tidak duplikat)
      const backups = listBackups();
      const lastBackup = backups.length > 0 ? new Date(backups[0].createdAt) : null;
      const label = settings.frequency;

      if (lastBackup) {
        const diffMs = now - lastBackup;
        const minInterval = settings.frequency === 'hourly' ? 60 * 60 * 1000 : 6 * 60 * 60 * 1000; // 1 jam / 6 jam
        if (diffMs < minInterval) return; // sudah backup baru
      }

      console.log(`⏰ Auto-backup running (${label})...`);
      try {
        runBackup(label);
        cleanOldBackups(settings.retentionDays);
      } catch (err) {
        console.error('Auto-backup gagal:', err);
      }
    }
  }).catch(err => {
    console.error('Auto-backup scheduler error:', err);
  });
}
