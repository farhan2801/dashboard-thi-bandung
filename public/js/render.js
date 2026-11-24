/**
 * render.js — mengisi zona-zona dashboard (lihat index.html).
 * Semua teks dimasukkan dengan textContent (bukan innerHTML) agar aman.
 */
import { KATEGORI, kategoriTHI } from './thi.js';
import { jam, tanggal, angka } from './data.js';

const $ = (id) => document.getElementById(id);

// Ikon per kategori (warna tidak pernah menjadi satu-satunya penanda)
const IKON = {
  'dingin': '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 7l2.5-2.5M9.5 19.5 12 17l2.5 2.5"/>',
  'nyaman': '<circle cx="12" cy="12" r="9"/><path d="M8.5 14a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  'agak-nyaman': '<path d="M12 3.5c3 4 6 7.2 6 10.5a6 6 0 0 1-12 0c0-3.3 3-6.5 6-10.5z"/>',
  'tidak-nyaman': '<path d="M12 3.5 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17h.01"/>',
};
export function ikonSVG(id, ukuran = 20) {
  return `<svg class="ikon" width="${ukuran}" height="${ukuran}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKON[id]}</svg>`;
}

/** Zona 1 — kepala: daftar kecamatan + waktu pembaruan. */
export function isiPilihanKecamatan(latest, kodeTerpilih) {
  const sel = $('pilih-kecamatan');
  sel.replaceChildren();
  const daftar = Object.entries(latest.kecamatan).sort(([, a], [, b]) => a.nama.localeCompare(b.nama, 'id'));
  for (const [kode, k] of daftar) {
    const opt = document.createElement('option');
    opt.value = kode;
    opt.textContent = k.nama;
    opt.selected = kode === kodeTerpilih;
    sel.appendChild(opt);
  }
}

export function isiWaktuPembaruan(meta) {
  const ms = Date.parse(meta.generated_at);
  $('waktu-pembaruan').textContent = Number.isFinite(ms)
    ? `Data diperbarui ${tanggal(ms)}, ${jam(ms)} WIB`
    : 'Waktu pembaruan tidak diketahui';
}

/** Zona 2 & 3 — kartu utama dan kartu pendukung. */
export function isiKartuUtama(slot, nowMs) {
  const kartu = $('kartu-utama');
  if (!slot) {
    kartu.dataset.kategori = '';
    $('thi-nilai').textContent = '–';
    $('thi-kategori').textContent = 'Data belum tersedia';
    $('thi-slot').textContent = '';
    for (const id of ['nilai-suhu', 'nilai-kelembapan', 'nilai-cuaca', 'nilai-angin']) $(id).textContent = '–';
    return;
  }
  const k = kategoriTHI(slot.thi);
  kartu.dataset.kategori = k.id;
  $('thi-nilai').textContent = angka(slot.thi);
  const badge = $('thi-kategori');
  badge.innerHTML = ikonSVG(k.id, 18);
  badge.append(document.createTextNode(k.label));
  const selisihMenit = Math.round((slot.ms - nowMs) / 60000);
  const keterangan = Math.abs(selisihMenit) <= 90 ? 'slot prakiraan terdekat' : 'slot prakiraan terdekat yang tersedia';
  $('thi-slot').textContent = `${keterangan}: ${tanggal(slot.ms)}, pukul ${jam(slot.ms)} WIB`;

  $('nilai-suhu').textContent = `${angka(slot.t)} °C`;
  $('nilai-kelembapan').textContent = `${angka(slot.hu, 0)}%`;
  $('nilai-cuaca').textContent = slot.cuaca ?? '–';
  $('nilai-angin').textContent = Number.isFinite(slot.ws)
    ? `Angin ${angka(slot.ws, 0)} km/jam${slot.wd ? ` dari ${slot.wd}` : ''}` : '';
}

/** Zona 5 — arti kategori, saran, ringkasan hari ini, dan legenda kategori. */
export function isiPenjelasan(slot, ringkasan) {
  const k = slot ? kategoriTHI(slot.thi) : null;
  $('arti-kategori').textContent = k ? `${k.label}: ${k.arti}` : 'Belum ada data untuk ditafsirkan.';
  $('saran-kategori').textContent = k ? `Saran: ${k.saran}` : '';

  const r = $('ringkasan-hari');
  if (!ringkasan) {
    r.textContent = 'Ringkasan hari ini belum tersedia.';
  } else {
    const km = kategoriTHI(ringkasan.maks.thi);
    r.textContent = `Hari ini: rata-rata THI ${angka(ringkasan.rata)}, tertinggi ${angka(ringkasan.maks.thi)} ` +
      `(${km.label.toLowerCase()}) sekitar pukul ${jam(ringkasan.maks.ms)} WIB.`;
    if (ringkasan.jumlahSlot < 8) r.textContent += ` Dihitung dari ${ringkasan.jumlahSlot} slot yang tersedia.`;
  }

  const ul = $('legenda-kategori');
  if (ul.childElementCount === 0) {
    for (const kat of KATEGORI) {
      const li = document.createElement('li');
      li.dataset.kategori = kat.id;
      li.innerHTML = `<span class="penanda">${ikonSVG(kat.id, 16)}</span>`;
      const teks = document.createElement('span');
      const b = document.createElement('strong');
      b.textContent = `${kat.label} (THI ${kat.rentang} °C)`;
      teks.append(b, document.createElement('br'), document.createTextNode(`${kat.arti} ${kat.saran}`));
      li.appendChild(teks);
      ul.appendChild(li);
    }
  }
  for (const li of ul.children) li.classList.toggle('aktif', li.dataset.kategori === k?.id);
}

/** Pita peringatan: data contoh, data usang, atau kecamatan sebagian gagal. */
export function isiPeringatan(pesan) {
  const box = $('peringatan');
  box.hidden = pesan.length === 0;
  box.replaceChildren();
  for (const p of pesan) { const el = document.createElement('p'); el.textContent = p; box.appendChild(el); }
}
