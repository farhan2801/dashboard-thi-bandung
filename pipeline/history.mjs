/**
 * history.mjs — menyimpan riwayat nilai per slot, dipecah per bulan.
 *
 * Aturan: setiap slot dari prakiraan terbaru ditulis (upsert) ke riwayat.
 * API BMKG hanya memberi slot yang belum lewat, sehingga slot yang sudah lewat
 * otomatis "membeku" pada prakiraan terakhir sebelum waktunya tiba.
 *
 * Struktur file public/data/history/YYYY-MM.json:
 * { "bulan": "2026-12", "kecamatan": { "32.73.02": { "2026-12-01T10:00:00+07:00": {t,hu,thi,kategori,cuaca,ws,wd} } } }
 */
import fs from 'node:fs';
import path from 'node:path';

const bulanDari = (iso) => iso.slice(0, 7); // waktu sudah dalam WIB → bulan lokal

function bacaJson(file, bawaan) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return bawaan; }
}

/** Gabungkan agregat ke file riwayat. Mengembalikan daftar bulan yang tersedia. */
export function perbaruiRiwayat(dirRiwayat, agregat) {
  fs.mkdirSync(dirRiwayat, { recursive: true });
  const perBulan = new Map();

  for (const [kode, kec] of Object.entries(agregat.kecamatan)) {
    for (const s of kec.slots) {
      const bulan = bulanDari(s.time);
      if (!perBulan.has(bulan)) {
        perBulan.set(bulan, bacaJson(path.join(dirRiwayat, `${bulan}.json`), { bulan, kecamatan: {} }));
      }
      const data = perBulan.get(bulan);
      data.kecamatan[kode] ??= {};
      const { time, ...nilai } = s;
      delete nilai.n;
      data.kecamatan[kode][time] = nilai;
    }
  }

  for (const [bulan, data] of perBulan) {
    for (const kode of Object.keys(data.kecamatan)) {
      // urutkan slot berdasarkan waktu agar file rapi dan mudah dibaca
      data.kecamatan[kode] = Object.fromEntries(
        Object.entries(data.kecamatan[kode]).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    fs.writeFileSync(path.join(dirRiwayat, `${bulan}.json`), JSON.stringify(data));
  }

  const bulanTersedia = fs.readdirSync(dirRiwayat)
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .map((f) => f.slice(0, 7))
    .sort();
  fs.writeFileSync(path.join(dirRiwayat, 'index.json'), JSON.stringify({ bulan: bulanTersedia }, null, 2));
  return bulanTersedia;
}

/**
 * Tulis history/recent.json: riwayat JAM_TERKINI jam terakhir untuk semua kecamatan.
 * Dashboard hanya memuat file kecil ini (bukan file bulanan yang besar),
 * supaya halaman tetap cepat dibuka di ponsel.
 */
export const JAM_TERKINI = 48;

export function tulisRiwayatTerkini(dirRiwayat, sekarangMs = Date.now()) {
  const batas = sekarangMs - JAM_TERKINI * 3600e3;
  const bulanFiles = fs.readdirSync(dirRiwayat).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort().slice(-2);
  const kecamatan = {};
  for (const f of bulanFiles) {
    const data = bacaJson(path.join(dirRiwayat, f), { kecamatan: {} });
    for (const [kode, slots] of Object.entries(data.kecamatan)) {
      for (const [time, nilai] of Object.entries(slots)) {
        const ms = Date.parse(time);
        if (ms >= batas && ms <= sekarangMs) (kecamatan[kode] ??= {})[time] = nilai;
      }
    }
  }
  fs.writeFileSync(path.join(dirRiwayat, 'recent.json'),
    JSON.stringify({ jam: JAM_TERKINI, dibuat: new Date(sekarangMs).toISOString(), kecamatan }));
}
