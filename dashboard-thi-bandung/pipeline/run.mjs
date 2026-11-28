/**
 * run.mjs — titik masuk pipeline: cek → ambil → agregasi → riwayat → tulis JSON.
 * Jalankan: npm run update-data            (otomatis oleh GitHub Actions setiap jam)
 *           npm run update-data -- --paksa (ambil ulang walau prakiraan BMKG belum berubah)
 *
 * Pembaruan mengikuti BMKG: setiap jam pipeline hanya mengecek beberapa kelurahan.
 * Proses lengkap (151 kelurahan) dijalankan hanya bila BMKG sudah merilis prakiraan baru
 * (analysis_date berubah), atau bila pembaruan sebelumnya belum lengkap.
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
import { ambilSemua, ambilKelurahan } from './fetch-bmkg.mjs';
import { agregasi } from './aggregate.mjs';
import { perbaruiRiwayat, tulisRiwayatTerkini } from './history.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_DATA = path.join(ROOT, 'public', 'data');
// Naikkan angka ini bila cara pengolahan berubah sehingga riwayat lama tidak sebanding lagi.
const VERSI_DATA = 2;

const bacaMeta = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')); } catch { return {}; } };

/**
 * Cek cepat: ambil prakiraan 3 kelurahan dari kecamatan berbeda (awal, tengah, akhir daftar)
 * dan kembalikan analysis_date terbaru yang dilaporkan BMKG (null bila semua gagal).
 */
export async function cekPrakiraanBMKG(wilayah, { fetchFn = fetch, log = console.log } = {}) {
  const kec = wilayah.kecamatan;
  const sampel = [kec[0], kec[Math.floor(kec.length / 2)], kec.at(-1)].map((k) => k.kelurahan[0].kode);
  const tanggal = [];
  for (const kode of sampel) {
    const r = await ambilKelurahan(kode, fetchFn);
    for (const s of r.slots) if (s.analysis_date) tanggal.push(s.analysis_date);
  }
  tanggal.sort();
  const terbaru = tanggal.at(-1) ?? null;
  log(`Cek BMKG: prakiraan terbaru ${terbaru ?? '(tidak dapat dicek)'}.`);
  return terbaru;
}

export async function jalankan({ fetchFn = fetch, jedaMs, log = console.log, paksa = false, dirData = DIR_DATA } = {}) {
  const dirRiwayat = path.join(dirData, 'history');
  const wilayah = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'wilayah.json'), 'utf8'));
  const daftar = wilayah.kecamatan.flatMap((k) => k.kelurahan.map((kel) => kel.kode));
  const metaLama = bacaMeta(dirData);

  // Lewati bila BMKG belum merilis prakiraan baru dan data sebelumnya sudah lengkap & sebanding.
  const dataLamaLayak = !metaLama.contoh && (metaLama.versi_data ?? 1) >= VERSI_DATA &&
    Boolean(metaLama.analysis_date) && (metaLama.gagal ?? []).length === 0;
  if (!paksa && dataLamaLayak) {
    const terbaru = await cekPrakiraanBMKG(wilayah, { fetchFn, log });
    if (terbaru && terbaru <= metaLama.analysis_date) {
      log(`Prakiraan BMKG belum berubah (${metaLama.analysis_date}). Data tidak diperbarui.`);
      return { dilewati: true, analysis_date: metaLama.analysis_date };
    }
  }

  log(`Mengambil prakiraan BMKG untuk ${daftar.length} kelurahan...`);
  const hasil = await ambilSemua(daftar, { fetchFn, jedaMs, log });
  const gagal = hasil.filter((r) => !r.ok);
  log(`Berhasil ${hasil.length - gagal.length}/${hasil.length} kelurahan.`);

  if (gagal.length === hasil.length) {
    // Jangan menimpa data lama. Exit code ≠ 0 membuat workflow GitHub berwarna merah.
    throw new Error('Semua permintaan ke BMKG gagal; data lama dipertahankan.');
  }

  const agregat = agregasi(wilayah, hasil);

  // Riwayat dihapus bila berasal dari data contoh atau dari versi pipeline lama
  // (versi 1 belum menyelaraskan jam slot antarkelurahan), supaya tidak tercampur.
  if (metaLama.contoh || (metaLama.versi_data ?? 1) < VERSI_DATA) {
    fs.rmSync(dirRiwayat, { recursive: true, force: true });
    log('Riwayat lama (data contoh / versi pipeline lama) dihapus.');
  }

  fs.mkdirSync(dirData, { recursive: true });
  const sekarang = new Date().toISOString();
  fs.writeFileSync(path.join(dirData, 'latest.json'), JSON.stringify({
    generated_at: sekarang,
    analysis_date: agregat.analysis_date,
    kecamatan: agregat.kecamatan,
  }));

  const bulan = perbaruiRiwayat(dirRiwayat, agregat);
  tulisRiwayatTerkini(dirRiwayat);

  fs.writeFileSync(path.join(dirData, 'meta.json'), JSON.stringify({
    contoh: false,
    versi_data: VERSI_DATA,
    kisi_jam_wib: [0, 1, 2].map((j) => agregat.kisi_jam + j * 3).map((j) => `${String(j).padStart(2, '0')}.00`).join(', ') + ', …',
    generated_at: sekarang,
    analysis_date: agregat.analysis_date,
    kelurahan_total: hasil.length,
    kelurahan_ok: hasil.length - gagal.length,
    kecamatan_ok: Object.keys(agregat.kecamatan).length,
    gagal: gagal.map((r) => ({ kode: r.kode, error: r.error })),
    riwayat_bulan: bulan,
    sumber: 'BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)',
  }, null, 2));

  log(`Selesai. Prakiraan BMKG ${agregat.analysis_date}; ${Object.keys(agregat.kecamatan).length} kecamatan ditulis.`);
  return { dilewati: false, ...agregat };
}

// Dijalankan langsung dari terminal
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const paksa = process.argv.includes('--paksa') || process.env.PAKSA === '1';
  jalankan({ paksa }).catch((e) => {
    console.error('GAGAL:', e.message);
    process.exit(1);
  });
}
