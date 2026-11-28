/**
 * app.js — titik masuk dashboard: muat data, pilih kecamatan, tampilkan semua zona.
 */
import { CONFIG } from './config.js';
import { kategoriTHI } from './thi.js';
import { muatSemua, gabungSlot, slotTerdekat, ringkasanHariIni, jam, angka } from './data.js';
import { KATEGORI } from './thi.js';
import {
  isiPilihanKecamatan, isiWaktuPembaruan, isiKartuUtama, isiPenjelasan, isiPeringatan, isiPrakiraanJam, ikonSVG,
  waktuPrakiraan,
} from './render.js';
import { renderTren } from './chart.js';
import { buatPeta } from './map.js';

const KUNCI_SIMPAN = 'thi-bandung:kecamatan';
let DATA = null;
let kodeAktif = null;
let PETA = null; // null bila peta gagal dimuat — dashboard tetap berjalan tanpa peta

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
  isiPrakiraanJam(document.getElementById('prakiraan-jam'), slots, slot, nowMs, CONFIG.JAM_TREN_DEPAN);
  isiPenjelasan(slot, ringkasanHariIni(slots, nowMs));
  perbaruiPeta(nowMs, slot);
  renderTren(document.getElementById('grafik-tren'), document.getElementById('tabel-tren'), slots, nowMs,
    { jamLalu: CONFIG.JAM_TREN_LALU, jamDepan: CONFIG.JAM_TREN_DEPAN });

  const kec = DATA.latest.kecamatan[kodeAktif];
  document.getElementById('nama-kecamatan').textContent = `Kecamatan ${kec.nama}`;
  document.getElementById('cakupan-kecamatan').textContent =
    `Rata-rata prakiraan ${kec.kelurahan_ok} dari ${kec.jumlah_kelurahan} kelurahan`;

  // Kotak ajakan formulir hanya tampil bila FORM_URL diisi di config.js
  const href = tautanFormulir(slot);
  document.querySelector('.zona-ajakan').hidden = !href;
  if (href) document.getElementById('tombol-formulir').href = href;

  const pesan = [];
  if (DATA.meta.contoh) pesan.push('Ini DATA CONTOH untuk uji tampilan, bukan data BMKG. Data asli muncul setelah pipeline berjalan.');
  // BMKG merilis prakiraan dua kali sehari; prakiraan yang lebih tua dari batas ini dianggap tertunda
  const umurJam = (nowMs - waktuPrakiraan(DATA.meta)) / 3600e3;
  if (umurJam > CONFIG.JAM_DATA_USANG) pesan.push(`Prakiraan BMKG terakhir dibuat ${Math.floor(umurJam)} jam lalu. Pembaruan berikutnya mungkin tertunda, jadi nilai yang tampil bisa kurang terkini.`);
  if (kec.kelurahan_ok < kec.jumlah_kelurahan) pesan.push(`Sebagian data kelurahan di kecamatan ini tidak tersedia pada pembaruan terakhir.`);
  isiPeringatan(pesan);
}

/** Warnai peta dengan THI saat ini di setiap kecamatan. */
function perbaruiPeta(nowMs, slotAktif) {
  if (!PETA) return;
  const nilai = new Map();
  for (const kode of Object.keys(DATA.latest.kecamatan)) {
    const s = slotTerdekat(gabungSlot(kode, DATA), nowMs);
    if (s) nilai.set(kode, s);
  }
  PETA.perbarui(nilai, kodeAktif);
  document.getElementById('keterangan-peta').textContent = slotAktif
    ? `THI prakiraan pukul ${jam(slotAktif.ms)} WIB di setiap kecamatan. Ketuk titik kecamatan untuk melihat rinciannya.`
    : 'Ketuk titik kecamatan untuk melihat rinciannya.';
}

function isiLegendaPeta() {
  const ul = document.getElementById('legenda-peta');
  for (const k of KATEGORI) {
    const li = document.createElement('li');
    li.dataset.kategori = k.id;
    li.innerHTML = `<span class="penanda">${ikonSVG(k.id, 12)}</span>`;
    li.append(document.createTextNode(`${k.label} (${k.rentang})`));
    ul.appendChild(li);
  }
}

async function siapkanPeta() {
  try {
    const res = await fetch('geo/kecamatan-bandung.geojson');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const geojson = await res.json();
    PETA = buatPeta(document.getElementById('peta'), geojson, {
      onPilih: (kode) => {
        if (!DATA.latest.kecamatan[kode]) return;
        document.getElementById('pilih-kecamatan').value = kode;
        gantiKecamatan(kode);
        // di ponsel, bawa pengguna ke rincian kecamatan yang baru dipilih
        if (innerWidth < 960) document.getElementById('kartu-utama').scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    });
    isiLegendaPeta();
  } catch (e) {
    console.error('Peta tidak dapat dimuat:', e);
    document.querySelector('.zona-peta').hidden = true;
  }
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
  await siapkanPeta();
  tampilkan();
  document.body.classList.remove('memuat');

  // Gambar ulang grafik saat ukuran layar berubah
  let jeda;
  addEventListener('resize', () => {
    clearTimeout(jeda);
    jeda = setTimeout(() => { PETA?.ukurUlang(); tampilkan(); }, 200);
  });
  // Perbarui slot terdekat tiap 10 menit, muat ulang data tiap 60 menit
  setInterval(tampilkan, 10 * 60e3);
  setInterval(async () => {
    try { DATA = await muatSemua(); isiWaktuPembaruan(DATA.meta); tampilkan(); } catch { /* coba lagi nanti */ }
  }, 60 * 60e3);
}

mulai();
