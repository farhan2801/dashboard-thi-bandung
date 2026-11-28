/**
 * config.js — pengaturan yang boleh diubah tim tanpa menyentuh kode lain.
 */
export const CONFIG = {
  // Kecamatan yang tampil pertama kali bila pengguna belum pernah memilih.
  KECAMATAN_BAWAAN: '32.73.19', // Sumur Bandung (pusat kota)

  // Tautan formulir umpan balik. Kosongkan → kotak ajakan di akhir halaman disembunyikan.
  // Catatan: prefill otomatis (FORM_ENTRY) hanya andal bila memakai tautan Google Form asli
  // (docs.google.com/forms/…/viewform); tautan pendek bit.ly bisa membuang isian tersebut.
  FORM_URL: 'https://bit.ly/FeedbackSiNyaman',

  // (Opsional) ID isian Google Form untuk prefill otomatis, format "entry.123456789".
  // Cara mendapatkannya: Google Form → ⋮ → "Dapatkan link yang telah diisi otomatis".
  // Isian ini membantu evaluasi (subbab 3.6 & 5.4): asal kunjungan dan kategori THI
  // yang sedang dilihat responden saat mengisi formulir.
  FORM_ENTRY: {
    sumber: '',    // diisi dari parameter ?utm_source= di tautan Instagram tiap anggota
    kecamatan: '', // nama kecamatan yang sedang dipilih
    thi: '',       // contoh: "25,0 – Agak nyaman (prakiraan 13.00 WIB)"
  },

  // Rentang grafik tren: berapa jam riwayat yang ditampilkan sebelum "sekarang".
  JAM_TREN_LALU: 24,
  // Batas jam prakiraan ke depan yang ditampilkan di grafik.
  JAM_TREN_DEPAN: 48,

  // Peringatan muncul bila prakiraan BMKG yang tampil lebih tua dari ini (jam).
  // BMKG merilis prakiraan pukul 07.00 & 19.00 WIB dan baru tersedia beberapa jam kemudian,
  // jadi umur 12–18 jam masih normal.
  JAM_DATA_USANG: 20,
};
