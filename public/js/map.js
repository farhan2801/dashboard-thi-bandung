/**
 * map.js — peta titik kecamatan Kota Bandung (Leaflet).
 *  - satu titik di tengah setiap kecamatan, diwarnai sesuai kategori THI saat ini
 *    dan berisi ikon kategori (warna tidak pernah menjadi satu-satunya penanda)
 *  - sorot titik → nama kecamatan + THI; klik/ketuk → kecamatan dipilih dan panel informasi berganti
 *  - kecamatan yang dipilih ditandai titik besar berlabel nama + nilai THI
 *
 * Titik tengah: public/geo/kecamatan-bandung.geojson
 * (dari cahyadsn/wilayah_boundaries, MIT License; kode Kemendagri).
 * Library: Leaflet 1.9.4 (public/vendor/leaflet, BSD-2-Clause), dimuat sebagai variabel global L.
 */
import { kategoriTHI } from './thi.js';
import { angka } from './data.js';
import { ikonSVG } from './render.js';

function htmlTitik(nama, slot, aktif) {
  const k = slot ? kategoriTHI(slot.thi) : null;
  const kelas = `titik-kec ${k ? `titik-${k.id}` : 'titik-kosong'}${aktif ? ' aktif' : ''}`;
  const ikon = k ? ikonSVG(k.id, aktif ? 14 : 11) : '';
  const label = aktif ? `<span class="label-titik"><b>${nama}</b> ${slot ? angka(slot.thi) : '–'}</span>` : '';
  return `<span class="${kelas}">${ikon}</span>${label}`;
}

function teksTooltip(nama, slot) {
  if (!slot) return `${nama}: data belum tersedia`;
  return `${nama} · THI ${angka(slot.thi)} (${kategoriTHI(slot.thi).label})`;
}

export function buatPeta(elemen, geojson, { onPilih }) {
  const L = window.L;
  if (!L) throw new Error('Leaflet belum dimuat');

  const peta = L.map(elemen, {
    scrollWheelZoom: false,      // gulir halaman tidak "terjebak" di peta
    dragging: !L.Browser.mobile, // di ponsel: satu jari menggulir halaman, dua jari memperbesar peta
    tap: false,
    minZoom: 11,
    maxZoom: 16,
    zoomSnap: 0.25,
  });

  // Peta dasar OpenStreetMap (tanpa API key). Warnanya dipudarkan lewat CSS (.peta-dasar)
  // agar titik kategori menonjol; di mode gelap peta dibalik menjadi gelap.
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    className: 'peta-dasar',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(peta);

  const titik = new Map(); // kode → { marker, nama }
  for (const f of geojson.features) {
    const { kode, nama, lat, lon } = f.properties;
    const marker = L.marker([lat, lon], {
      icon: L.divIcon({ className: 'wadah-titik', html: htmlTitik(nama, null, false), iconSize: [0, 0] }),
      title: `Kecamatan ${nama}`,
      keyboard: true,
      riseOnHover: true,
    });
    marker.bindTooltip(nama, { direction: 'top', offset: [0, -10], opacity: 0.95 });
    marker.on('click', () => onPilih(kode));
    marker.addTo(peta);
    titik.set(kode, { marker, nama });
  }

  const batas = L.latLngBounds([...titik.values()].map(({ marker }) => marker.getLatLng()));
  const sempit = innerWidth < 640;
  peta.fitBounds(batas, { padding: sempit ? [14, 14] : [28, 28] });
  peta.setMaxBounds(batas.pad(0.8));

  /**
   * @param nilai     Map kode → slot terdekat (punya .thi)
   * @param kodeAktif kecamatan yang sedang dipilih
   */
  function perbarui(nilai, kodeAktif) {
    for (const [kode, { marker, nama }] of titik) {
      const aktif = kode === kodeAktif;
      const slot = nilai.get(kode);
      marker.setIcon(L.divIcon({ className: 'wadah-titik', html: htmlTitik(nama, slot, aktif), iconSize: [0, 0] }));
      marker.setZIndexOffset(aktif ? 1000 : 0);
      marker.setTooltipContent(teksTooltip(nama, slot));
      if (aktif) marker.closeTooltip();
    }
  }

  return { perbarui, ukurUlang: () => peta.invalidateSize() };
}
