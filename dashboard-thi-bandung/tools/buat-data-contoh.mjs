/**
 * buat-data-contoh.mjs — membuat DATA CONTOH (bukan data BMKG) agar tampilan dashboard
 * bisa dicoba sebelum pipeline pertama kali berjalan.
 *
 *   node tools/buat-data-contoh.mjs
 *
 * meta.json ditandai "contoh": true → dashboard menampilkan pita peringatan,
 * dan pipeline otomatis menghapus data contoh pada pengambilan sungguhan pertama.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { agregasi } from '../pipeline/aggregate.mjs';
import { perbaruiRiwayat, tulisRiwayatTerkini } from '../pipeline/history.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR_DATA = path.join(ROOT, 'public', 'data');
const wilayah = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'wilayah.json'), 'utf8'));

// Pembangkit acak sederhana yang bisa diulang (hasil sama setiap dijalankan).
let benih = 7;
const acak = () => ((benih = (benih * 16807) % 2147483647) / 2147483647);

const pad = (n) => String(n).padStart(2, '0');
function isoWIB(d) {
  const w = new Date(d.getTime() + 7 * 3600e3); // geser ke WIB lalu baca sebagai UTC
  return `${w.getUTCFullYear()}-${pad(w.getUTCMonth() + 1)}-${pad(w.getUTCDate())}T${pad(w.getUTCHours())}:00:00+07:00`;
}

// Slot 3-jaman WIB dari 2 hari lalu sampai ±2,5 hari ke depan.
const sekarang = Date.now();
const awal = Math.floor((sekarang + 7 * 3600e3) / 10800e3) * 10800e3 - 7 * 3600e3 - 48 * 3600e3;
const waktu = [];
for (let t = awal; t <= sekarang + 60 * 3600e3; t += 10800e3) waktu.push(new Date(t));

const CUACA = ['Cerah', 'Cerah Berawan', 'Berawan', 'Hujan Ringan'];
const hasil = [];
wilayah.kecamatan.forEach((kec, iKec) => {
  const geserKec = (iKec % 7) * 0.25 - 0.6; // variasi antarkecamatan
  for (const kel of kec.kelurahan) {
    const geserKel = (acak() - 0.5) * 0.8;
    const slots = waktu.map((d) => {
      const jam = Number(isoWIB(d).slice(11, 13));
      const siang = Math.sin(((jam - 8) / 24) * 2 * Math.PI); // puncak ±14.00
      const t = Math.round(23 + 5.5 * siang + geserKec + geserKel + (acak() - 0.5));
      const hu = Math.round(Math.min(97, Math.max(45, 76 - 18 * siang + (acak() - 0.5) * 8)));
      return {
        time: isoWIB(d), t, hu,
        cuaca: CUACA[Math.min(3, Math.floor(acak() * 3 + (jam >= 14 && jam <= 17 ? 1 : 0)))],
        ws: Math.round(acak() * 10 + 2), wd: ['SE', 'S', 'E', 'NW'][Math.floor(acak() * 4)],
        analysis_date: new Date(sekarang).toISOString().slice(0, 13) + ':00:00',
      };
    });
    hasil.push({ kode: kel.kode, ok: true, slots });
  }
});

const agregat = agregasi(wilayah, hasil);
fs.rmSync(path.join(DIR_DATA, 'history'), { recursive: true, force: true });
const bulan = perbaruiRiwayat(path.join(DIR_DATA, 'history'), agregat);
tulisRiwayatTerkini(path.join(DIR_DATA, 'history'), sekarang);

// latest.json hanya berisi slot yang belum lewat (seperti API BMKG sungguhan)
const batas = sekarang - 90 * 60e3;
for (const k of Object.values(agregat.kecamatan)) k.slots = k.slots.filter((s) => Date.parse(s.time) >= batas);

const kini = new Date(sekarang).toISOString();
fs.writeFileSync(path.join(DIR_DATA, 'latest.json'),
  JSON.stringify({ generated_at: kini, analysis_date: agregat.analysis_date, kecamatan: agregat.kecamatan }));
fs.writeFileSync(path.join(DIR_DATA, 'meta.json'), JSON.stringify({
  contoh: true, generated_at: kini, analysis_date: agregat.analysis_date,
  kelurahan_total: hasil.length, kelurahan_ok: hasil.length, kecamatan_ok: 30, gagal: [],
  riwayat_bulan: bulan, sumber: 'DATA CONTOH — bukan data BMKG',
}, null, 2));
console.log('Data contoh dibuat di public/data (bukan data BMKG).');
