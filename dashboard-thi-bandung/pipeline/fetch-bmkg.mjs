/**
 * fetch-bmkg.mjs — mengambil prakiraan cuaca BMKG per kelurahan (adm4).
 * Batas BMKG: 60 permintaan/menit/IP → dijeda 1,1 detik antarpermintaan.
 * Sumber data: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika).
 */

export const API_URL = 'https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=';
const JEDA_MS = 1100;
const PERCOBAAN = 3; // 1 kali + 2 kali ulang
const TIMEOUT_MS = 20000;

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

/** "2026-11-24 13:00:00" (WIB) → "2026-11-24T13:00:00+07:00" */
export function keIsoWIB(localDatetime) {
  if (!localDatetime) return null;
  return String(localDatetime).trim().replace(' ', 'T') + '+07:00';
}

/** Cari semua slot prakiraan (objek yang punya t dan hu) di JSON bersarang BMKG. */
export function ratakanSlot(obj, hasil = []) {
  if (Array.isArray(obj)) {
    for (const v of obj) ratakanSlot(v, hasil);
  } else if (obj && typeof obj === 'object') {
    if ('t' in obj && 'hu' in obj) hasil.push(obj);
    else for (const v of Object.values(obj)) ratakanSlot(v, hasil);
  }
  return hasil;
}

/** Ubah JSON mentah BMKG menjadi daftar slot yang rapi. */
export function parseRespons(json) {
  return ratakanSlot(json)
    .map((s) => ({
      time: keIsoWIB(s.local_datetime),
      t: Number(s.t),
      hu: Number(s.hu),
      cuaca: s.weather_desc ?? null,
      ws: s.ws != null ? Number(s.ws) : null,
      wd: s.wd ?? null,
      analysis_date: s.analysis_date ?? null,
    }))
    .filter((s) => s.time && Number.isFinite(s.t) && Number.isFinite(s.hu));
}

/** Ambil satu kelurahan, dengan percobaan ulang. */
export async function ambilKelurahan(kode, fetchFn = fetch) {
  let errorTerakhir = '';
  for (let i = 1; i <= PERCOBAAN; i++) {
    try {
      const res = await fetchFn(API_URL + kode, {
        headers: { 'User-Agent': 'dashboard-thi-bandung (ITB Meteorologi, Kelompok 7)' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const slots = parseRespons(await res.json());
      if (slots.length === 0) throw new Error('data kosong');
      return { kode, ok: true, slots };
    } catch (e) {
      errorTerakhir = e?.message ?? String(e);
      if (i < PERCOBAAN) await tidur(2000 * i);
    }
  }
  return { kode, ok: false, slots: [], error: errorTerakhir };
}

/** Ambil semua kelurahan secara berurutan dengan jeda. */
export async function ambilSemua(daftarKode, { fetchFn = fetch, jedaMs = JEDA_MS, log = console.log } = {}) {
  const hasil = [];
  for (const [i, kode] of daftarKode.entries()) {
    const r = await ambilKelurahan(kode, fetchFn);
    hasil.push(r);
    log(`[${String(i + 1).padStart(3)}/${daftarKode.length}] ${r.ok ? 'OK   ' : 'GAGAL'} ${kode}` +
        (r.ok ? ` (${r.slots.length} slot)` : ` — ${r.error}`));
    if (i < daftarKode.length - 1) await tidur(jedaMs);
  }
  return hasil;
}
