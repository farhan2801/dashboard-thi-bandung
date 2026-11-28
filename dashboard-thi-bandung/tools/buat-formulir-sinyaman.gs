/**
 * buat-formulir-sinyaman.gs — membuat Google Form umpan balik SiNyaman secara otomatis.
 *
 * Isi formulir mengikuti proposal revisi Kelompok 7:
 *   subbab 3.6 (mekanisme feedback), 3.7 (indikator keberhasilan), 5.3 & Tabel 5.1 (rancangan pertanyaan).
 *
 * CARA PAKAI
 *   1. Buka https://script.google.com → New project.
 *   2. Hapus isi editor, tempel seluruh isi file ini, lalu Save (ikon disket).
 *   3. Pilih fungsi "buatFormulirSiNyaman" di bilah atas → klik Run.
 *   4. Izinkan akses (Review permissions → pilih akun → Advanced → Go to … → Allow).
 *   5. Buka "Execution log": salin tautan formulir dan potongan kode CONFIG untuk dashboard.
 *
 * Hasil: satu Google Form + satu Google Sheet berisi respons (tersimpan di Google Drive Anda).
 */

const SKALA_SETUJU = { bawah: 'Sangat tidak setuju', atas: 'Sangat setuju' };

function buatFormulirSiNyaman() {
  const form = FormApp.create('Umpan Balik SiNyaman — Sistem Informasi Kenyamanan Termal Kota Bandung');

  form.setDescription(
    'Terima kasih sudah mencoba SiNyaman, dashboard prakiraan kenyamanan termal (Temperature Humidity Index/THI) ' +
    'untuk 30 kecamatan di Kota Bandung berbasis data prakiraan cuaca BMKG.\n\n' +
    'Formulir ini berisi 16 pertanyaan singkat dan dapat diselesaikan dalam sekitar 3 menit. ' +
    'Pengisian bersifat anonim: kami tidak meminta nama, email, atau nomor telepon. ' +
    'Jawaban hanya digunakan untuk evaluasi kegiatan diseminasi mata kuliah di Program Studi Meteorologi ITB ' +
    'dan disajikan dalam bentuk rekap, bukan per orang.\n\n' +
    'Kelompok 7 · Program Studi Meteorologi, Institut Teknologi Bandung'
  );
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false); // tidak mewajibkan login Google
  form.setProgressBar(true);
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage(
    'Terima kasih! Jawaban Anda sudah tersimpan dan sangat membantu evaluasi SiNyaman. ' +
    'Silakan bagikan dashboard ini kepada teman atau keluarga di Bandung agar mereka juga bisa mengecek kenyamanan udara sebelum beraktivitas.'
  );

  // ---------- Persetujuan ----------
  form.addMultipleChoiceItem()
    .setTitle('Persetujuan pengisian')
    .setHelpText(
      'Dengan memilih jawaban di bawah, Anda menyatakan bersedia mengisi formulir ini secara sukarela ' +
      'dan mengizinkan jawaban Anda digunakan secara anonim untuk evaluasi kegiatan.'
    )
    .setChoiceValues(['Ya, saya bersedia'])
    .setRequired(true);

  // ---------- Bagian A · Profil ----------
  form.addPageBreakItem()
    .setTitle('Bagian A · Profil singkat')
    .setHelpText('Dua pertanyaan untuk mengetahui sebaran responden. Tidak ada data identitas yang diminta.');

  form.addMultipleChoiceItem()
    .setTitle('A1. Di mana Anda berdomisili?')
    .setChoiceValues(['Kota Bandung', 'Kabupaten Bandung', 'Kabupaten Bandung Barat', 'Kota Cimahi'])
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('A2. Berapa rentang usia Anda?')
    .setChoiceValues(['Di bawah 18 tahun', '18–24 tahun', '25–34 tahun', '35–44 tahun', '45–54 tahun', '55 tahun ke atas'])
    .setRequired(true);

  // ---------- Bagian B · Akses ----------
  form.addPageBreakItem()
    .setTitle('Bagian B · Cara Anda mengakses dashboard');

  form.addMultipleChoiceItem()
    .setTitle('B1. Dari mana Anda mengetahui dashboard ini?')
    .setChoiceValues(['Instagram Story anggota tim', 'Dibagikan teman atau keluarga'])
    .showOtherOption(true)
    .setRequired(true);

  form.addMultipleChoiceItem()
    .setTitle('B2. Perangkat apa yang Anda pakai untuk membuka dashboard?')
    .setChoiceValues(['Ponsel', 'Komputer atau laptop', 'Tablet'])
    .setRequired(true);

  // ---------- Bagian C · Tampilan & persepsi ----------
  form.addPageBreakItem()
    .setTitle('Bagian C · Tampilan dashboard dan sensasi termal Anda')
    .setHelpText('Untuk pertanyaan C1–C4, pilih 1 (sangat tidak setuju) sampai 5 (sangat setuju).');

  const skala = (judul) => form.addScaleItem()
    .setTitle(judul)
    .setBounds(1, 5)
    .setLabels(SKALA_SETUJU.bawah, SKALA_SETUJU.atas)
    .setRequired(true);

  skala('C1. Tampilan dashboard mudah dipahami.');
  skala('C2. Angka THI dan kategorinya mudah dibaca.');
  skala('C3. Penjelasan arti setiap kategori sudah jelas.');
  skala('C4. Dashboard cepat dibuka dan mudah dipakai.');

  form.addMultipleChoiceItem()
    .setTitle('C5. Bagaimana sensasi termal (rasa panas atau dingin) yang Anda rasakan saat ini di lokasi Anda?')
    .setHelpText('Jawab sesuai yang Anda rasakan sekarang, tanpa melihat angka di dashboard. Tidak ada jawaban benar atau salah.')
    .setChoiceValues([
      '−3 · Sangat dingin',
      '−2 · Dingin',
      '−1 · Agak dingin',
      '0 · Netral (tidak panas, tidak dingin)',
      '+1 · Agak panas',
      '+2 · Panas',
      '+3 · Sangat panas',
    ])
    .setRequired(true);

  // ---------- Bagian D · Pemahaman ----------
  form.addPageBreakItem()
    .setTitle('Bagian D · Pemahaman')
    .setHelpText('Satu pertanyaan singkat untuk mengetahui apakah informasi di dashboard mudah dipahami.');

  form.addMultipleChoiceItem()
    .setTitle('D1. Jika dashboard menampilkan kategori "Tidak nyaman", apa arti yang paling tepat?')
    .setChoiceValues([
      'Udara terasa sangat dingin sehingga perlu pakaian tebal',
      'Kebanyakan orang merasa tidak nyaman karena udara panas dan lembap',
      'Akan turun hujan lebat disertai petir',
      'Kualitas udara buruk karena polusi',
    ])
    .setRequired(true);

  // ---------- Bagian E · Manfaat ----------
  form.addPageBreakItem()
    .setTitle('Bagian E · Manfaat informasi')
    .setHelpText('Untuk pertanyaan E1 dan E3, pilih 1 (sangat tidak setuju) sampai 5 (sangat setuju).');

  skala('E1. Informasi ini membantu saya memahami kenyamanan cuaca di Bandung.');

  form.addMultipleChoiceItem()
    .setTitle('E2. Apakah Anda akan memakai informasi ini untuk merencanakan aktivitas?')
    .setHelpText('Misalnya menentukan waktu berolahraga, bepergian, atau beraktivitas di luar ruangan.')
    .setChoiceValues(['Ya', 'Mungkin', 'Tidak'])
    .setRequired(true);

  skala('E3. Setelah melihat dashboard, saya menjadi lebih sadar akan kenyamanan termal di sekitar saya.');

  form.addMultipleChoiceItem()
    .setTitle('E4. Apakah Anda akan membagikan dashboard ini kepada orang lain?')
    .setChoiceValues(['Ya', 'Tidak'])
    .setRequired(true);

  // ---------- Bagian F · Masukan ----------
  form.addPageBreakItem()
    .setTitle('Bagian F · Masukan untuk pengembangan')
    .setHelpText('Dua pertanyaan terakhir bersifat opsional, tetapi sangat membantu kami memperbaiki dashboard.');

  form.addParagraphTextItem()
    .setTitle('F1. Informasi apa lagi yang ingin Anda lihat di dashboard?')
    .setRequired(false);

  form.addParagraphTextItem()
    .setTitle('F2. Kritik dan saran lain untuk dashboard.')
    .setRequired(false);

  // ---------- Informasi teknis (terisi otomatis dari dashboard) ----------
  form.addSectionHeaderItem()
    .setTitle('Informasi teknis (terisi otomatis)')
    .setHelpText(
      'Tiga isian di bawah ini terisi otomatis jika Anda membuka formulir melalui tombol di dashboard SiNyaman. ' +
      'Biarkan apa adanya. Jika kosong, Anda boleh melewatinya.'
    );

  const itemSumber = form.addTextItem()
    .setTitle('Kode tautan')
    .setHelpText('Penanda tautan yang Anda klik (dipakai untuk rekap jangkauan).')
    .setRequired(false);

  const itemKecamatan = form.addTextItem()
    .setTitle('Kecamatan yang dilihat di dashboard')
    .setRequired(false);

  const itemThi = form.addTextItem()
    .setTitle('THI dan kategori yang tampil di dashboard')
    .setRequired(false);

  // ---------- Spreadsheet respons ----------
  const ss = SpreadsheetApp.create('Respons Umpan Balik SiNyaman');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // ---------- ID isian untuk prefill dari dashboard ----------
  const contoh = form.createResponse()
    .withItemResponse(itemSumber.createResponse('ISI_SUMBER'))
    .withItemResponse(itemKecamatan.createResponse('ISI_KECAMATAN'))
    .withItemResponse(itemThi.createResponse('ISI_THI'))
    .toPrefilledUrl();
  const idDari = (penanda) => {
    const m = contoh.match(new RegExp('(entry\\.\\d+)=' + penanda));
    return m ? m[1] : '';
  };

  const config =
    "  FORM_URL: '" + form.getPublishedUrl() + "',\n" +
    '  FORM_ENTRY: {\n' +
    "    sumber: '" + idDari('ISI_SUMBER') + "',\n" +
    "    kecamatan: '" + idDari('ISI_KECAMATAN') + "',\n" +
    "    thi: '" + idDari('ISI_THI') + "',\n" +
    '  },';

  Logger.log('Formulir siap diisi : ' + form.getPublishedUrl());
  Logger.log('Halaman edit formulir: ' + form.getEditUrl());
  Logger.log('Spreadsheet respons  : ' + ss.getUrl());
  Logger.log('\nSalin baris berikut ke public/js/config.js (gantikan FORM_URL dan FORM_ENTRY yang lama):\n\n' + config);
}
