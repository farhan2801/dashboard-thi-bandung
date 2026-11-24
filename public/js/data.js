/**
 * data.js — memuat file JSON hasil pipeline dan menyiapkan data untuk tampilan.
 * Browser TIDAK pernah memanggil API BMKG langsung (API tidak mengizinkan CORS);
 * semua data berasal dari folder data/ yang ditulis pipeline.
 */

async function muatJson(url, wajib = true) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) {
    if (wajib) throw new Error(`Gagal memuat ${url} (HTTP ${res.status})`);
    return null;
  }
  return res.json();
}

export async function muatSemua() {
  const [latest, meta, recent] = await Promise.all([
    muatJson('data/latest.json'),
    muatJson('data/meta.json'),
    muatJson('data/history/recent.json', false), // boleh belum ada di hari pertama
  ]);
  return { latest, meta, recent };
}

/** Gabungkan riwayat 48 jam + prakiraan terbaru untuk satu kecamatan, urut waktu. */
export function gabungSlot(kode, { latest, recent }) {
  const peta = new Map();
  const riwayat = recent?.kecamatan?.[kode] ?? {};
  for (const [time, v] of Object.entries(riwayat)) peta.set(time, { time, ...v, sumber: 'riwayat' });
  for (const s of latest?.kecamatan?.[kode]?.slots ?? []) peta.set(s.time, { ...s, sumber: 'prakiraan' });
  return [...peta.values()]
    .map((s) => ({ ...s, ms: Date.parse(s.time) }))
    .filter((s) => Number.isFinite(s.ms) && Number.isFinite(s.thi))
    .sort((a, b) => a.ms - b.ms);
}

/** Slot dengan waktu paling dekat ke saat ini. */
export function slotTerdekat(slots, nowMs = Date.now()) {
  let terbaik = null;
  for (const s of slots) if (!terbaik || Math.abs(s.ms - nowMs) < Math.abs(terbaik.ms - nowMs)) terbaik = s;
  return terbaik;
}

// ---------- waktu dalam WIB ----------
const TZ = 'Asia/Jakarta';
const fmtJam = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const fmtTanggal = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fmtHariSingkat = new Intl.DateTimeFormat('id-ID', { timeZone: TZ, weekday: 'short', day: 'numeric' });
const fmtKunciHari = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

export const jam = (ms) => fmtJam.format(ms).replace(':', '.');
export const tanggal = (ms) => fmtTanggal.format(ms);
export const hariSingkat = (ms) => fmtHariSingkat.format(ms);
export const kunciHari = (ms) => fmtKunciHari.format(ms); // "2026-12-01"
export const jamWIB = (ms) => Number(fmtJam.format(ms).slice(0, 2));

/** Ringkasan hari ini (WIB): rata-rata THI dan THI tertinggi beserta jamnya. */
export function ringkasanHariIni(slots, nowMs = Date.now()) {
  const hariIni = kunciHari(nowMs);
  const xs = slots.filter((s) => kunciHari(s.ms) === hariIni);
  if (xs.length === 0) return null;
  const rata = xs.reduce((a, s) => a + s.thi, 0) / xs.length;
  const maks = xs.reduce((a, s) => (s.thi > a.thi ? s : a));
  return { rata: Math.round(rata * 10) / 10, maks, jumlahSlot: xs.length };
}

/** Format angka gaya Indonesia: 25.0 → "25,0". */
export const angka = (x, d = 1) =>
  Number.isFinite(x) ? x.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
