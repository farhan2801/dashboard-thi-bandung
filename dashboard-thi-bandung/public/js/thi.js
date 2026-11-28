/**
 * thi.js — rumus THI dan kategori kenyamanan.
 * Modul ini DIPAKAI BERSAMA oleh pipeline (Node.js) dan dashboard (browser),
 * sehingga rumus dan ambang batas hanya didefinisikan di satu tempat.
 *
 * Rumus : Nieuwolt (1977) — THI = 0,8·T + (RH·T)/500
 * Kategori: klasifikasi BMKG (@infobmkg); ambang 21–24 / >27 sesuai
 *           Wati & Fatkhuroyan (2017), Jurnal Ilmu Lingkungan 15(1): 57–63.
 */

export const KATEGORI = [
  {
    id: 'dingin',
    label: 'Dingin',
    rentang: '< 21',
    batasAtas: 21, // eksklusif
    arti: 'Udara terasa dingin bagi sebagian besar orang.',
    saran: 'Kenakan pakaian hangat bila perlu, terutama pagi dan malam.',
  },
  {
    id: 'nyaman',
    label: 'Nyaman',
    rentang: '21–24',
    batasAtas: 24, // inklusif
    arti: 'Kondisi dirasakan nyaman oleh sebagian besar orang.',
    saran: 'Aktivitas luar ruangan umumnya nyaman dilakukan.',
  },
  {
    id: 'agak-nyaman',
    label: 'Agak nyaman',
    rentang: '> 24–27',
    batasAtas: 27, // inklusif
    arti: 'Sebagian orang mulai merasa gerah.',
    saran: 'Perbanyak minum dan istirahat di tempat teduh.',
  },
  {
    id: 'tidak-nyaman',
    label: 'Tidak nyaman',
    rentang: '> 27',
    batasAtas: Infinity,
    arti: 'Kebanyakan orang merasa tidak nyaman karena panas dan lembap.',
    saran: 'Kurangi aktivitas berat di luar ruangan; perhatikan kelompok rentan.',
  },
];

/** Bulatkan ke satu desimal (aman dari galat floating point seperti 24.95 → 24.9). */
export function bulat1(x) {
  return Math.round((x + Number.EPSILON) * 10) / 10;
}

/** Hitung THI (°C) dari suhu T (°C) dan kelembapan relatif RH (%), dibulatkan 1 desimal. */
export function hitungTHI(t, rh) {
  if (!Number.isFinite(t) || !Number.isFinite(rh)) return null;
  return bulat1(0.8 * t + (rh * t) / 500);
}

/** Kembalikan objek kategori untuk nilai THI. */
export function kategoriTHI(thi) {
  if (!Number.isFinite(thi)) return null;
  if (thi < 21) return KATEGORI[0];
  if (thi <= 24) return KATEGORI[1];
  if (thi <= 27) return KATEGORI[2];
  return KATEGORI[3];
}
