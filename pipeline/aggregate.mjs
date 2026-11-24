/**
 * aggregate.mjs — menggabungkan prakiraan kelurahan menjadi nilai per kecamatan.
 *
 * Temuan dari data BMKG: tidak semua kelurahan memakai jam slot yang sama
 * (mis. sebagian 02.00, 05.00, 08.00, … dan sebagian 01.00, 04.00, 07.00, …).
 * Karena itu, sebelum dirata-ratakan, semua kelurahan DISELARASKAN ke satu kisi waktu:
 *   1. Kisi = pola jam (jam mod 3) yang paling banyak dipakai seluruh kelurahan.
 *   2. Kelurahan yang jamnya tidak pada kisi → suhu, kelembapan, dan angin
 *      diinterpolasi linear antara dua slot terdekatnya (tanpa ekstrapolasi);
 *      kondisi cuaca & arah angin diambil dari slot terdekat.
 *
 * Lalu untuk setiap kecamatan dan setiap slot kisi:
 *   - suhu & kelembapan = rata-rata seluruh kelurahan yang punya nilai di slot itu
 *   - THI dihitung dari rata-rata tersebut (agar angka T, RH, dan THI yang tampil konsisten)
 *   - kondisi cuaca & arah angin = nilai yang paling sering muncul (modus)
 *   - kecepatan angin = rata-rata
 */
import { hitungTHI, kategoriTHI, bulat1 } from '../public/js/thi.js';

const JAM_MS = 3600e3;
const LANGKAH_MS = 3 * JAM_MS;
const rata = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function modus(xs) {
  const hitung = new Map();
  for (const x of xs) if (x != null && x !== '') hitung.set(x, (hitung.get(x) ?? 0) + 1);
  let terbaik = null, n = 0;
  for (const [x, c] of hitung) if (c > n) [terbaik, n] = [x, c];
  return terbaik;
}

/** Jam WIB dari string "YYYY-MM-DDTHH:00:00+07:00". */
const jamWIB = (iso) => Number(iso.slice(11, 13));
const pad = (n) => String(n).padStart(2, '0');

/** ms epoch → "YYYY-MM-DDTHH:00:00+07:00" (WIB). */
export function isoWIB(ms) {
  const d = new Date(ms + 7 * JAM_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00:00+07:00`;
}

/** Pola jam (0, 1, atau 2 = jam mod 3) yang paling banyak dipakai. */
export function tentukanKisi(hasil) {
  const hitung = [0, 0, 0];
  for (const r of hasil) if (r.ok) for (const s of r.slots) hitung[jamWIB(s.time) % 3]++;
  return hitung.indexOf(Math.max(...hitung));
}

const interp = (a, b, f) => (Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * f : null);

/** Selaraskan slot satu kelurahan ke kisi; mengembalikan Map(time → slot). */
export function selaraskan(slots, kisi) {
  const xs = slots
    .map((s) => ({ ...s, ms: Date.parse(s.time) }))
    .filter((s) => Number.isFinite(s.ms))
    .sort((a, b) => a.ms - b.ms);
  const hasil = new Map();
  if (xs.length === 0) return hasil;

  // slot pertama pada kisi yang ≥ slot pertama kelurahan ini
  let t = xs[0].ms;
  while (jamWIB(isoWIB(t)) % 3 !== kisi) t += JAM_MS;

  let i = 0;
  for (; t <= xs.at(-1).ms; t += LANGKAH_MS) {
    while (i < xs.length - 1 && xs[i + 1].ms <= t) i++;
    const a = xs[i];
    let nilai;
    if (a.ms === t) {
      nilai = a;
    } else {
      const b = xs[i + 1];
      if (!b || b.ms - a.ms > 2 * LANGKAH_MS) continue; // celah terlalu lebar → lewati
      const f = (t - a.ms) / (b.ms - a.ms);
      const dekat = f < 0.5 ? a : b;
      nilai = {
        t: interp(a.t, b.t, f),
        hu: interp(a.hu, b.hu, f),
        ws: interp(a.ws, b.ws, f),
        cuaca: dekat.cuaca,
        wd: dekat.wd,
        analysis_date: a.analysis_date,
      };
    }
    const time = isoWIB(t);
    hasil.set(time, { ...nilai, time });
  }
  return hasil;
}

/**
 * @param wilayah   isi config/wilayah.json
 * @param hasil     keluaran ambilSemua(): [{kode, ok, slots}]
 * @returns { kecamatan: { [kode]: {nama, jumlah_kelurahan, kelurahan_ok, slots:[...] } }, analysis_date, kisi_jam }
 */
export function agregasi(wilayah, hasil) {
  const kisi = tentukanKisi(hasil);
  const perKode = new Map(hasil.map((r) => [r.kode, r]));
  const kecamatan = {};
  const semuaAnalysis = [];

  for (const kec of wilayah.kecamatan) {
    const perWaktu = new Map();
    let ok = 0;
    for (const kel of kec.kelurahan) {
      const r = perKode.get(kel.kode);
      if (!r?.ok) continue;
      ok++;
      for (const s of r.slots) if (s.analysis_date) semuaAnalysis.push(s.analysis_date);
      for (const [time, s] of selaraskan(r.slots, kisi)) {
        if (!perWaktu.has(time)) perWaktu.set(time, []);
        perWaktu.get(time).push(s);
      }
    }
    if (ok === 0) continue; // kecamatan tanpa data sama sekali dilewati

    const slots = [...perWaktu.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, xs]) => {
        const t = bulat1(rata(xs.map((x) => x.t)));
        const hu = bulat1(rata(xs.map((x) => x.hu)));
        const thi = hitungTHI(t, hu);
        const ws = xs.filter((x) => Number.isFinite(x.ws));
        return {
          time,
          t,
          hu,
          thi,
          kategori: kategoriTHI(thi).id,
          cuaca: modus(xs.map((x) => x.cuaca)),
          ws: ws.length ? bulat1(rata(ws.map((x) => x.ws))) : null,
          wd: modus(xs.map((x) => x.wd)),
          n: xs.length,
        };
      })
      // slot di tepi rentang yang hanya dimiliki sebagian kecil kelurahan dibuang,
      // supaya rata-rata kecamatan tidak bergantung pada satu-dua kelurahan saja
      .filter((s) => s.n >= Math.ceil(ok / 2));

    kecamatan[kec.kode] = {
      nama: kec.nama,
      jumlah_kelurahan: kec.kelurahan.length,
      kelurahan_ok: ok,
      slots,
    };
  }

  semuaAnalysis.sort();
  return { kecamatan, analysis_date: semuaAnalysis.at(-1) ?? null, kisi_jam: kisi };
}
