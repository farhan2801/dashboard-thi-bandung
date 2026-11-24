/**
 * aggregate.mjs — menggabungkan prakiraan kelurahan menjadi nilai per kecamatan.
 *
 * Untuk setiap kecamatan dan setiap slot waktu:
 *   - suhu & kelembapan = rata-rata seluruh kelurahan yang berhasil diambil
 *   - THI dihitung dari rata-rata tersebut (agar angka T, RH, dan THI yang tampil konsisten)
 *   - kondisi cuaca & arah angin = nilai yang paling sering muncul (modus)
 *   - kecepatan angin = rata-rata
 */
import { hitungTHI, kategoriTHI, bulat1 } from '../public/js/thi.js';

const rata = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function modus(xs) {
  const hitung = new Map();
  for (const x of xs) if (x != null && x !== '') hitung.set(x, (hitung.get(x) ?? 0) + 1);
  let terbaik = null, n = 0;
  for (const [x, c] of hitung) if (c > n) [terbaik, n] = [x, c];
  return terbaik;
}

/**
 * @param wilayah   isi config/wilayah.json
 * @param hasil     keluaran ambilSemua(): [{kode, ok, slots}]
 * @returns { kecamatan: { [kode]: {nama, jumlah_kelurahan, kelurahan_ok, slots:[...] } }, analysis_date }
 */
export function agregasi(wilayah, hasil) {
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
      for (const s of r.slots) {
        if (!perWaktu.has(s.time)) perWaktu.set(s.time, []);
        perWaktu.get(s.time).push(s);
        if (s.analysis_date) semuaAnalysis.push(s.analysis_date);
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
      });

    kecamatan[kec.kode] = {
      nama: kec.nama,
      jumlah_kelurahan: kec.kelurahan.length,
      kelurahan_ok: ok,
      slots,
    };
  }

  semuaAnalysis.sort();
  return { kecamatan, analysis_date: semuaAnalysis.at(-1) ?? null };
}
