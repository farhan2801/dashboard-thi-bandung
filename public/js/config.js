/**
 * config.js — pengaturan yang boleh diubah tim tanpa menyentuh kode lain.
 */
export const CONFIG = {
  // Kecamatan yang tampil pertama kali bila pengguna belum pernah memilih.
  KECAMATAN_BAWAAN: '32.73.19', // Sumur Bandung (pusat kota)

  // Tautan Google Form umpan balik. Kosongkan → tombol formulir disembunyikan.
  FORM_URL: '',

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

  // Data dianggap usang bila pembaruan terakhir lebih lama dari ini (jam).
  JAM_DATA_USANG: 12,
};
