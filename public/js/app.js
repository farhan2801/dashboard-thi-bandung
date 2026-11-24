/**
 * app.js — titik masuk dashboard: muat data, pilih kecamatan, tampilkan semua zona.
 */
import { CONFIG } from './config.js';
import { kategoriTHI } from './thi.js';
import { muatSemua, gabungSlot, slotTerdekat, ringkasanHariIni, jam, angka } from './data.js';
import { isiPilihanKecamatan, isiWaktuPembaruan, isiKartuUtama, isiPenjelasan, isiPeringatan } from './render.js';
import { renderTren } from './chart.js';

const KUNCI_SIMPAN = 'thi-bandung:kecamatan';
let DATA = null;
let kodeAktif = null;

// localStorage bisa tidak tersedia (mode privat, dsb.) → selalu dibungkus try/catch
const simpan = (v) => { try { localStorage.setItem(KUNCI_SIMPAN, v); } catch { /* abaikan */ } };
const ambilSimpanan = () => { try { return localStorage.getItem(KUNCI_SIMPAN); } catch { return null; } };

function tentukanKecamatan(latest) {
  const tersedia = (k) => k && latest.kecamatan[k];
  const dariUrl = new URLSearchParams(location.search).get('kec');
  if (tersedia(dariUrl)) return dariUrl;
  if (tersedia(ambilSimpanan())) return ambilSimpanan();
  if (tersedia(CONFIG.KECAMATAN_BAWAAN)) return CONFIG.KECAMATAN_BAWAAN;
  return Object.keys(latest.kecamatan)[0];
}

function tautanFormulir(slot) {
  if (!CONFIG.FORM_URL) return null;
  const url = new URL(CONFIG.FORM_URL);
  const e = CONFIG.FORM_ENTRY;
  const utm = new URLSearchParams(location.search).get('utm_source');
  if (e.sumber && utm) url.searchParams.set(e.sumber, utm);
  if (e.kecamatan) url.searchParams.set(e.kecamatan, DATA.latest.kecamatan[kodeAktif].nama);
  if (e.thi && slot) {
    url.searchParams.set(e.thi, `${angka(slot.thi)} – ${kategoriTHI(slot.thi).label} (prakiraan ${jam(slot.ms)} WIB)`);
  }
  if (e.sumber || e.kecamatan || e.thi) url.searchParams.set('usp', 'pp_url');
  return url.toString();
}

function tampilkan() {
  const nowMs = Date.now();
  const slots = gabungSlot(kodeAktif, DATA);
  const slot = slotTerdekat(slots, nowMs);

  isiKartuUtama(slot, nowMs);
  isiPenjelasan(slot, ringkasanHariIni(slots, nowMs));
  renderTren(document.getElementById('grafik-tren'), document.getElementById('tabel-tren'), slots, nowMs,
    { jamLalu: CONFIG.JAM_TREN_LALU, jamDepan: CONFIG.JAM_TREN_DEPAN });

  const kec = DATA.latest.kecamatan[kodeAktif];
  document.getElementById('nama-kecamatan').textContent = `Kecamatan ${kec.nama}`;
  document.getElementById('cakupan-kecamatan').textContent =
    `Rata-rata prakiraan ${kec.kelurahan_ok} dari ${kec.jumlah_kelurahan} kelurahan`;

  const tombol = document.getElementById('tombol-formulir');
  const href = tautanFormulir(slot);
  tombol.hidden = !href;
  if (href) tombol.href = href;

  const pesan = [];
  if (DATA.meta.contoh) pesan.push('Ini DATA CONTOH untuk uji tampilan, bukan data BMKG. Data asli muncul setelah pipeline berjalan.');
  const umurJam = (nowMs - Date.parse(DATA.meta.generated_at)) / 3600e3;
  if (umurJam > CONFIG.JAM_DATA_USANG) pesan.push(`Data belum diperbarui sejak ${Math.floor(umurJam)} jam lalu. Nilai yang tampil mungkin sudah tidak terkini.`);
  if (kec.kelurahan_ok < kec.jumlah_kelurahan) pesan.push(`Sebagian data kelurahan di kecamatan ini tidak tersedia pada pembaruan terakhir.`);
  isiPeringatan(pesan);
}

function gantiKecamatan(kode) {
  kodeAktif = kode;
  simpan(kode);
  const url = new URL(location.href);
  url.searchParams.set('kec', kode); // parameter lain (utm_*) tetap dipertahankan
  history.replaceState(null, '', url);
  tampilkan();
}

async function mulai() {
  try {
    DATA = await muatSemua();
  } catch (e) {
    isiPeringatan(['Data tidak dapat dimuat. Coba muat ulang halaman beberapa saat lagi.']);
    console.error(e);
    return;
  }
  kodeAktif = tentukanKecamatan(DATA.latest);
  isiPilihanKecamatan(DATA.latest, kodeAktif);
  isiWaktuPembaruan(DATA.meta);
  document.getElementById('pilih-kecamatan').addEventListener('change', (ev) => gantiKecamatan(ev.target.value));
  tampilkan();
  document.body.classList.remove('memuat');

  // Gambar ulang grafik saat ukuran layar berubah
  let jeda;
  addEventListener('resize', () => { clearTimeout(jeda); jeda = setTimeout(tampilkan, 200); });
  // Perbarui slot terdekat tiap 10 menit, muat ulang data tiap 60 menit
  setInterval(tampilkan, 10 * 60e3);
  setInterval(async () => {
    try { DATA = await muatSemua(); isiWaktuPembaruan(DATA.meta); tampilkan(); } catch { /* coba lagi nanti */ }
  }, 60 * 60e3);
}

mulai();
