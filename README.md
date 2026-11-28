# Dashboard Indeks Kenyamanan Kota Bandung

Dashboard prakiraan kenyamanan termal (Temperature Humidity Index, THI) untuk 30 kecamatan di Kota Bandung,
berbasis data prakiraan cuaca BMKG. Proyek mata kuliah Diseminasi Meteorologi, Kelompok 7, Meteorologi ITB.

**Sumber data: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika).**

---

## Cara kerja

```
API BMKG ──► Pipeline Node.js ──► public/data/*.json ──► Cloudflare Pages ──► Browser pengguna
 (151 kelurahan)  (GitHub Actions,     (disimpan di repo)     (hosting statis)     (HTML/CSS/JS)
                   tiap 3 jam)
```

1. **Pipeline** (`pipeline/`) dijalankan otomatis oleh GitHub Actions tiap 3 jam. Pipeline mengambil prakiraan
   151 kelurahan dari BMKG, merata-ratakan suhu dan kelembapan per kecamatan, menghitung THI, lalu menulis file JSON.
2. **Data** (`public/data/`) disimpan di repositori, sehingga riwayat terkumpul otomatis.
3. **Frontend** (`public/`) adalah halaman statis yang hanya membaca file JSON tersebut.
   Browser tidak memanggil API BMKG langsung, karena API BMKG tidak mengizinkan akses dari browser (CORS).

## Struktur folder

| Lokasi | Isi |
|---|---|
| `.github/workflows/update-data.yml` | Jadwal otomatis: uji → ambil data → simpan ke repo |
| `pipeline/run.mjs` | Titik masuk pipeline |
| `pipeline/fetch-bmkg.mjs` | Ambil data per kelurahan (jeda 1,1 detik, coba ulang 2 kali) |
| `pipeline/aggregate.mjs` | Rata-rata per kecamatan per slot 3 jam, lalu hitung THI |
| `pipeline/history.mjs` | Simpan riwayat bulanan + `recent.json` (48 jam terakhir) |
| `config/wilayah.json` | 30 kecamatan & 151 kelurahan (kode adm4) |
| `public/index.html` | Halaman dashboard: peta, kartu THI, prakiraan per 3 jam, grafik tren, penjelasan |
| `public/css/style.css` | Tampilan mobile-first, mode terang & gelap |
| `public/js/thi.js` | **Rumus THI & kategori** — dipakai bersama oleh pipeline dan browser |
| `public/js/config.js` | **Pengaturan yang boleh diubah tim** (tautan formulir, kecamatan awal) |
| `public/js/data.js` | Memuat JSON, memilih slot terdekat, ringkasan harian |
| `public/js/render.js` | Mengisi isi tiap zona |
| `public/js/chart.js` | Grafik tren THI (SVG, tanpa library) + tabel data |
| `public/js/map.js` | Peta titik kecamatan (Leaflet); klik titik untuk memilih kecamatan |
| `public/geo/kecamatan-bandung.geojson` | Titik tengah 30 kecamatan (cahyadsn/wilayah_boundaries, MIT) |
| `public/vendor/leaflet/` | Library peta Leaflet 1.9.4 (disimpan di proyek, tanpa CDN) |
| `public/js/app.js` | Titik masuk dashboard |
| `public/data/` | Ditulis otomatis oleh pipeline — **jangan diedit manual** |
| `tests/` | Kasus uji rumus THI dan pipeline |
| `tools/buat-data-contoh.mjs` | Membuat data contoh untuk uji tampilan |
| `tools/uji_akses_bmkg.py` | Skrip uji akses API BMKG (Python) |

## Metode

- **THI** = 0,8 × T + (RH × T) / 500, dibulatkan 1 desimal (Nieuwolt, 1977).
- **Per kecamatan**: suhu dan kelembapan dirata-ratakan dari semua kelurahan, lalu THI dihitung dari rata-rata itu.
  Kondisi cuaca dan arah angin memakai nilai yang paling sering muncul.
- **Kategori** (klasifikasi BMKG; Wati & Fatkhuroyan, 2017):

  | Kategori | THI (°C) |
  |---|---|
  | Dingin | < 21 |
  | Nyaman | 21–24 |
  | Agak nyaman | > 24–27 |
  | Tidak nyaman | > 27 |

- **Riwayat**: setiap slot ditimpa dengan prakiraan terbaru selama belum lewat. Setelah lewat, slot itu
  "membeku" pada prakiraan terakhir sebelum waktunya.

---

## Menyiapkan di GitHub (sekali saja)

1. Buka folder ini di VS Code (**File → Open Folder**).
2. Masuk ke GitHub dari VS Code (ikon akun di kiri bawah → **Sign in with GitHub**).
3. Klik ikon **Source Control** di sidebar kiri → **Publish to GitHub** → pilih Public atau Private.
4. Di halaman repositori GitHub: **Settings → Actions → General → Workflow permissions**
   → pilih **Read and write permissions** → **Save**.
5. Buka tab **Actions** → pilih **Update data BMKG** → **Run workflow**.
   Tunggu ±4 menit. Centang hijau berarti BMKG bisa diakses dari server GitHub, dan data contoh
   sudah otomatis diganti data BMKG asli. Sejak itu pipeline berjalan sendiri tiap 3 jam.

> Kalau langkah 5 gagal karena BMKG menolak akses dari server GitHub, pipeline yang sama bisa
> dijalankan dari laptop (lihat bagian berikut), lalu hasilnya di-commit lewat VS Code.

## Alur kerja sehari-hari

- Sebelum mulai bekerja: **Source Control → Sync Changes**, supaya data terbaru dari pipeline ikut terunduh.
- Setelah mengubah kode: tulis pesan singkat → **Commit** → **Sync Changes**.

## Menjalankan di laptop

Butuh **Node.js 20 atau lebih baru** (unduh dari nodejs.org, pilih versi LTS). Jalankan di terminal VS Code:

```bash
npm test               # uji rumus THI dan pipeline
npm run update-data    # ambil data BMKG asli ke public/data (±3 menit)
node tools/buat-data-contoh.mjs   # atau: buat data contoh untuk uji tampilan
```

Untuk melihat dashboard, halaman harus dibuka lewat server lokal (bukan klik dua kali file HTML):

- Pasang ekstensi **Live Server** di VS Code → klik kanan `public/index.html` → **Open with Live Server**, atau
- jalankan `npx serve public` lalu buka alamat yang muncul.

## Pengaturan (`public/js/config.js`)

| Pengaturan | Fungsi |
|---|---|
| `KECAMATAN_BAWAAN` | Kecamatan yang tampil pertama kali |
| `FORM_URL` | Tautan Google Form. Kosong → tombol formulir disembunyikan |
| `FORM_ENTRY` | ID isian Google Form untuk prefill otomatis (asal kunjungan, kecamatan, kategori THI) |
| `JAM_TREN_LALU`, `JAM_TREN_DEPAN` | Rentang grafik tren |
| `JAM_DATA_USANG` | Batas jam sebelum muncul peringatan "data belum diperbarui" |

**Tautan per anggota (untuk Instagram Story):** tambahkan `utm_source`, misalnya
`https://<alamat-dashboard>/?utm_source=farhan`. Kalau `FORM_ENTRY.sumber` diisi, nilai ini
ikut terisi otomatis di formulir, sehingga respons bisa dikaitkan dengan anggota yang membagikan.
Tautan juga bisa diarahkan ke kecamatan tertentu: `?kec=32.73.02&utm_source=farhan`.

## Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| Workflow merah, log "Semua permintaan ke BMKG gagal" | BMKG down atau menolak server GitHub. Data lama aman. Coba **Run workflow** lagi nanti, atau jalankan dari laptop. |
| Workflow merah di langkah "Simpan data" | Izin belum diatur (lihat langkah 4 penyiapan). |
| Pita kuning "DATA CONTOH" di dashboard | Pipeline belum pernah berhasil berjalan. |
| Pita kuning "Data belum diperbarui sejak … jam" | Cek tab Actions: kemungkinan beberapa jadwal gagal berturut-turut. |
| Halaman kosong saat dibuka langsung dari file | Gunakan Live Server / `npx serve public` (modul JavaScript butuh server). |

## Batasan

Nilai adalah prakiraan BMKG, bukan pengukuran langsung. THI tidak memperhitungkan angin, radiasi matahari,
aktivitas, maupun kondisi individu. Dashboard ini bukan peringatan resmi dan bukan diagnosis kesehatan.
Riwayat baru terkumpul sejak pipeline pertama kali berjalan.
