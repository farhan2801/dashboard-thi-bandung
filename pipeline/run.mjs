/**
 * run.mjs — titik masuk pipeline: ambil → agregasi → riwayat → tulis JSON.
 * Jalankan: npm run update-data   (dijalankan otomatis oleh GitHub Actions tiap 3 jam)
 *
 * Keluaran (folder public/data):
 *   latest.json          prakiraan terbaru 30 kecamatan
 *   meta.json            waktu pembaruan, status, kelurahan yang gagal
 *   history/YYYY-MM.json riwayat per bulan (arsip untuk evaluasi); history/index.json daftar bulan
 *   history/recent.json  riwayat 48 jam terakhir (yang dimuat dashboard)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ambilSemua } from './fetch-bmkg.mjs';
import { agregasi } from './aggregate.mjs';
import { perbaruiRiwayat, tulisRiwayatTerkini } from './history.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_DATA = path.join(ROOT, 'public', 'data');
const DIR_RIWAYAT = path.join(DIR_DATA, 'history');

export async function jalankan({ fetchFn = fetch, jedaMs, log = console.log } = {}) {
  const wilayah = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'wilayah.json'), 'utf8'));
  const daftar = wilayah.kecamatan.flatMap((k) => k.kelurahan.map((kel) => kel.kode));

  log(`Mengambil prakiraan BMKG untuk ${daftar.length} kelurahan...`);
  const hasil = await ambilSemua(daftar, { fetchFn, jedaMs, log });
  const gagal = hasil.filter((r) => !r.ok);
  log(`Berhasil ${hasil.length - gagal.length}/${hasil.length} kelurahan.`);

  if (gagal.length === hasil.length) {
    // Jangan menimpa data lama. Exit code ≠ 0 membuat workflow GitHub berwarna merah.
    throw new Error('Semua permintaan ke BMKG gagal; data lama dipertahankan.');
  }

  const agregat = agregasi(wilayah, hasil);

  // Data contoh (bawaan repositori) dihapus pada pengambilan sungguhan pertama,
  // supaya riwayat tidak tercampur dengan data contoh.
  const metaLama = (() => { try { return JSON.parse(fs.readFileSync(path.join(DIR_DATA, 'meta.json'), 'utf8')); } catch { return {}; } })();
  if (metaLama.contoh) {
    fs.rmSync(DIR_RIWAYAT, { recursive: true, force: true });
    log('Data contoh dihapus.');
  }

  fs.mkdirSync(DIR_DATA, { recursive: true });
  const sekarang = new Date().toISOString();
  fs.writeFileSync(path.join(DIR_DATA, 'latest.json'), JSON.stringify({
    generated_at: sekarang,
    analysis_date: agregat.analysis_date,
    kecamatan: agregat.kecamatan,
  }));

  const bulan = perbaruiRiwayat(DIR_RIWAYAT, agregat);
  tulisRiwayatTerkini(DIR_RIWAYAT);

  fs.writeFileSync(path.join(DIR_DATA, 'meta.json'), JSON.stringify({
    contoh: false,
    generated_at: sekarang,
    analysis_date: agregat.analysis_date,
    kelurahan_total: hasil.length,
    kelurahan_ok: hasil.length - gagal.length,
    kecamatan_ok: Object.keys(agregat.kecamatan).length,
    gagal: gagal.map((r) => ({ kode: r.kode, error: r.error })),
    riwayat_bulan: bulan,
    sumber: 'BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)',
  }, null, 2));

  log(`Selesai. ${Object.keys(agregat.kecamatan).length} kecamatan ditulis ke public/data.`);
  return agregat;
}

// Dijalankan langsung dari terminal
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  jalankan().catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  });
}
