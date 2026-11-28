/**
 * render.js — mengisi zona-zona dashboard (lihat index.html).
 * Semua teks dimasukkan dengan textContent (bukan innerHTML) agar aman.
 */
import { KATEGORI, kategoriTHI } from './thi.js';
import { jam, tanggal, angka, kunciHari, jamWIB } from './data.js';

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

// Ikon kondisi cuaca BMKG (dipilih dari kata kunci deskripsi cuaca)
const AWAN = 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.2 9.1 4.5 4.5 0 0 0 7 18z';
const AWAN_ATAS = 'M7 14h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.2 5.1 4.5 4.5 0 0 0 7 14z';
const IKON_CUACA = {
  cerah: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  malam: '<path d="M19.5 14.5A8 8 0 1 1 9.5 4.5a6.3 6.3 0 0 0 10 10z"/>',
  'cerah-berawan': '<circle cx="8" cy="8" r="3"/><path d="M8 2.5v1.2M2.5 8h1.2M4.1 4.1l.9.9M11.9 4.1l-.9.9"/><path d="M9 20h8a3.5 3.5 0 0 0 .4-6.97A5 5 0 0 0 8.3 12.2 3.9 3.9 0 0 0 9 20z"/>',
  'malam-berawan': '<path d="M12.5 8.5A4.5 4.5 0 1 1 6 3.2a3.6 3.6 0 0 0 6.5 5.3z"/><path d="M9 20h8a3.5 3.5 0 0 0 .4-6.97A5 5 0 0 0 8.3 12.2 3.9 3.9 0 0 0 9 20z"/>',
  berawan: `<path d="${AWAN}"/>`,
  hujan: `<path d="${AWAN_ATAS}"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>`,
  petir: `<path d="${AWAN_ATAS}"/><path d="M12.5 15 10 19h3l-2.5 4"/>`,
  kabut: '<path d="M4 8h16M3 12h18M5 16h14M8 20h8"/>',
};
export function jenisCuaca(deskripsi, ms) {
  const d = String(deskripsi ?? '').toLowerCase();
  const malam = Number.isFinite(ms) && (jamWIB(ms) >= 18 || jamWIB(ms) < 6);
  if (d.includes('petir')) return 'petir';
  if (d.includes('hujan')) return 'hujan';
  if (d.includes('kabut') || d.includes('asap') || d.includes('kabur')) return 'kabut';
  if (d.includes('cerah berawan')) return malam ? 'malam-berawan' : 'cerah-berawan';
  if (d.includes('cerah')) return malam ? 'malam' : 'cerah';
  return 'berawan';
}
export function ikonCuaca(deskripsi, ms, ukuran = 28) {
  return `<svg class="ikon-cuaca" width="${ukuran}" height="${ukuran}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IKON_CUACA[jenisCuaca(deskripsi, ms)]}</svg>`;
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
    ? `Diperbarui ${tanggal(ms)}, ${jam(ms)} WIB`
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
  const cuaca = $('nilai-cuaca');
  cuaca.innerHTML = ikonCuaca(slot.cuaca, slot.ms, 26);
  cuaca.append(document.createTextNode(slot.cuaca ?? '–'));
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

/** Label hari relatif terhadap hari ini (WIB): "Hari ini", "Besok", "Lusa", atau nama hari. */
function labelHari(ms, nowMs) {
  const selisih = Math.round((Date.parse(kunciHari(ms)) - Date.parse(kunciHari(nowMs))) / 864e5);
  if (selisih === 0) return 'Hari ini';
  if (selisih === 1) return 'Besok';
  if (selisih === 2) return 'Lusa';
  return tanggal(ms).split(',')[0];
}

/**
 * Zona prakiraan — kotak per slot 3 jam, mulai dari slot terdekat sampai jamDepan ke depan.
 * Setiap kotak: hari, jam, ikon + kondisi cuaca, suhu, kelembapan, THI + kategori.
 */
export function isiPrakiraanJam(wadah, slots, slotSekarang, nowMs, jamDepan = 48) {
  wadah.replaceChildren();
  if (!slotSekarang) return;
  const xs = slots.filter((s) => s.ms >= slotSekarang.ms && s.ms <= nowMs + jamDepan * 3600e3);
  let hariSebelumnya = null;
  for (const s of xs) {
    const k = kategoriTHI(s.thi);
    const hari = kunciHari(s.ms);
    const li = document.createElement('li');
    li.className = 'jam-kartu';
    li.dataset.kategori = k.id;
    if (s === slotSekarang) li.classList.add('sekarang');

    const pHari = document.createElement('p');
    pHari.className = 'jam-hari';
    pHari.textContent = s === slotSekarang ? 'Sekarang' : (hari !== hariSebelumnya ? labelHari(s.ms, nowMs) : '\u00a0');
    hariSebelumnya = hari;

    const pJam = document.createElement('p');
    pJam.className = 'jam-waktu';
    pJam.textContent = jam(s.ms);

    const ikon = document.createElement('span');
    ikon.className = 'jam-ikon';
    ikon.innerHTML = ikonCuaca(s.cuaca, s.ms, 30);

    const pCuaca = document.createElement('p');
    pCuaca.className = 'jam-cuaca';
    pCuaca.textContent = s.cuaca ?? '–';

    const pSuhu = document.createElement('p');
    pSuhu.className = 'jam-suhu';
    pSuhu.textContent = `${angka(s.t, 0)}°C`;

    const pRh = document.createElement('p');
    pRh.className = 'jam-rh';
    pRh.textContent = `RH ${angka(s.hu, 0)}%`;

    const pThi = document.createElement('p');
    pThi.className = 'jam-thi';
    pThi.innerHTML = ikonSVG(k.id, 13);
    pThi.append(document.createTextNode(`${angka(s.thi)} · ${k.label}`));

    li.append(pHari, pJam, ikon, pCuaca, pSuhu, pRh, pThi);
    li.title = `${tanggal(s.ms)}, ${jam(s.ms)} WIB — THI ${angka(s.thi)} (${k.label})`;
    wadah.appendChild(li);
  }
}
