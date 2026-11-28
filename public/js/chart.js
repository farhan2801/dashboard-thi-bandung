/**
 * chart.js — grafik tren THI per 3 jam (SVG murni, tanpa library).
 *  - kurva halus yang warnanya berubah sesuai kategori (gradien dengan batas di 21, 24, 27 °C)
 *  - area berwarna di bawah kurva, arsiran malam hari (18.00–06.00 WIB)
 *  - garis tegas = riwayat, garis putus-putus = prakiraan; titik penuh = riwayat, berongga = prakiraan
 *  - anotasi otomatis THI tertinggi & terendah, garis vertikal "Sekarang"
 *  - nama kategori selalu tertulis (warna tidak pernah menjadi satu-satunya penanda)
 *  - hover/sentuh/panah keyboard → garis bidik + tooltip; tabel data tersedia
 */
import { KATEGORI, kategoriTHI } from './thi.js';
import { jam, hariSingkat, jamWIB, angka } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

export function renderTren(wadah, tabelBody, slots, nowMs, { jamLalu = 24, jamDepan = 48 } = {}) {
  wadah.replaceChildren();
  const data = slots.filter((s) => s.ms >= nowMs - jamLalu * 3600e3 && s.ms <= nowMs + jamDepan * 3600e3);
  isiTabel(tabelBody, data, nowMs);
  if (data.length < 2) {
    const p = document.createElement('p');
    p.className = 'kosong';
    p.textContent = 'Data tren belum cukup. Grafik akan terisi setelah beberapa kali pembaruan data.';
    wadah.appendChild(p);
    return;
  }

  const W = Math.max(300, wadah.clientWidth || 360);
  // Tinggi mengikuti wadah: 260px di ponsel, lebih tinggi di laptop (diatur lewat CSS)
  const H = Math.round(Math.min(400, Math.max(260, wadah.clientHeight || 260)));
  const lebar = W >= 560; // layar lebar: nama zona di luar area grafik (kanan)
  const m = { l: 34, r: lebar ? 98 : 12, t: 26, b: 46 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;

  const thi = data.map((d) => d.thi);
  const yMin = Math.min(19, Math.floor(Math.min(...thi)) - 1);
  const yMax = Math.max(28, Math.ceil(Math.max(...thi)) + 1);
  const x0 = data[0].ms, x1 = data.at(-1).ms;
  const sx = (ms) => m.l + ((ms - x0) / (x1 - x0)) * iw;
  const sy = (v) => m.t + (1 - (v - yMin) / (yMax - yMin)) * ih;
  const bawah = m.t + ih;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
    'aria-label': 'Grafik tren THI per 3 jam. Data lengkap tersedia di tabel di bawah grafik.' }, wadah);
  const defs = el('defs', {}, svg);
  const uid = Math.random().toString(36).slice(2, 8);

  // Gradien vertikal dengan batas tegas di 21, 24, dan 27 °C:
  // garis & area otomatis berwarna sesuai kategori pada setiap ketinggian
  const posisi = (v) => Math.min(1, Math.max(0, (yMax - v) / (yMax - yMin)));
  const ZONA = [['tidak-nyaman', 0, posisi(27)], ['agak-nyaman', posisi(27), posisi(24)],
    ['nyaman', posisi(24), posisi(21)], ['dingin', posisi(21), 1]];
  const gradien = (nama, opasitas) => {
    const g = el('linearGradient', { id: `${nama}-${uid}`, gradientUnits: 'userSpaceOnUse',
      x1: 0, x2: 0, y1: sy(yMax), y2: sy(yMin) }, defs);
    for (const [id, dari, sampai] of ZONA) {
      for (const o of [dari, sampai]) {
        el('stop', { offset: o, style: `stop-color: var(--k-${id}); stop-opacity: ${opasitas(o)}` }, g);
      }
    }
    return `url(#${nama}-${uid})`;
  };
  const warnaGaris = gradien('garis', () => 1);
  const warnaArea = gradien('area', (o) => (0.34 - 0.26 * o).toFixed(3)); // memudar ke bawah

  // Arsiran malam hari (18.00–06.00 WIB) — memperlihatkan pola siang-malam
  const HARI = 864e5, WIB = 7 * 3600e3;
  const tengahMalamPertama = Math.floor((x0 + WIB) / HARI) * HARI - WIB;
  for (let mulai = tengahMalamPertama - 6 * 3600e3; mulai < x1; mulai += HARI) {
    const a = Math.max(mulai, x0), b = Math.min(mulai + 12 * 3600e3, x1);
    if (b <= a) continue;
    el('rect', { x: sx(a), y: m.t, width: sx(b) - sx(a), height: ih, class: 'malam' }, svg);
    const tengah = (sx(a) + sx(b)) / 2;
    if (sx(b) - sx(a) > 46 && (lebar || tengah > m.l + 110)) { // layar sempit: jangan tabrak nama zona di kiri
      const t = el('text', { x: tengah, y: m.t + 12, class: 'label-malam', 'text-anchor': 'middle' }, svg);
      t.textContent = 'malam';
    }
  }

  // Garis ambang kategori + nama kategori di tepi kanan setiap zona
  for (const v of [21, 24, 27]) {
    el('line', { x1: m.l, x2: m.l + iw, y1: sy(v), y2: sy(v), class: 'ambang' }, svg);
    const t = el('text', { x: m.l - 6, y: sy(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg);
    t.textContent = v;
  }
  const tY = el('text', { x: m.l - 6, y: m.t - 10, class: 'tick', 'text-anchor': 'end' }, svg);
  tY.textContent = '°C';
  const batas = [-Infinity, 21, 24, 27, Infinity];
  const labelZona = [];
  KATEGORI.forEach((k, i) => {
    const lo = Math.max(batas[i], yMin), hi = Math.min(batas[i + 1], yMax);
    if (sy(lo) - sy(hi) < 14) return; // zona terlalu sempit untuk label
    const y = (sy(hi) + sy(lo)) / 2;
    const g = el('g', { class: 'label-zona' }, svg);
    // layar lebar: di margin kanan · layar sempit: di tepi kiri bagian dalam
    const cx = lebar ? m.l + iw + 12 : m.l + 10;
    el('circle', { cx, cy: y, r: 4, style: `fill: var(--k-${k.id})` }, g);
    const t = el('text', { x: cx + 8, y: y + 4, 'text-anchor': 'start' }, g);
    t.textContent = k.label;
    labelZona.push(g);
  });

  // Sumbu X — baris 1: jam setiap slot 3 jam BMKG · baris 2: nama hari di tengah rentang harinya
  el('line', { x1: m.l, x2: m.l + iw, y1: bawah, y2: bawah, class: 'sumbu' }, svg);
  const pxPerSlot = iw / Math.max(1, (x1 - x0) / (3 * 3600e3));
  const formatPanjang = pxPerSlot >= 40;            // cukup ruang untuk "13.00"
  const jarakMin = formatPanjang ? 38 : 22;          // label lebih rapat dari ini dilewati (tanda tetap ada)
  let xLabelTerakhir = -Infinity;
  for (const d of data) {
    const x = sx(d.ms);
    el('line', { x1: x, x2: x, y1: bawah, y2: bawah + 4, class: 'sumbu' }, svg);
    if (x - xLabelTerakhir < jarakMin) continue;
    const t = el('text', { x, y: bawah + 17, class: 'tick', 'text-anchor': 'middle' }, svg);
    t.textContent = formatPanjang ? jam(d.ms) : jam(d.ms).slice(0, 2);
    xLabelTerakhir = x;
  }
  for (let awalHari = tengahMalamPertama; awalHari < x1; awalHari += HARI) {
    if (awalHari > x0) {
      // pemisah tengah malam: di area grafik dan di baris nama hari, tidak mencoret label jam
      el('line', { x1: sx(awalHari), x2: sx(awalHari), y1: m.t, y2: bawah, class: 'grid-hari' }, svg);
      el('line', { x1: sx(awalHari), x2: sx(awalHari), y1: bawah + 23, y2: H - 2, class: 'grid-hari' }, svg);
    }
    const a = Math.max(awalHari, x0), b = Math.min(awalHari + HARI, x1);
    if (sx(b) - sx(a) < 44) continue; // potongan hari terlalu sempit untuk nama hari
    const t = el('text', { x: (sx(a) + sx(b)) / 2, y: H - 6, class: 'tick tick-hari', 'text-anchor': 'middle' }, svg);
    t.textContent = hariSingkat(a);
  }

  // Kurva halus (monoton: tidak melampaui nilai data di antara dua slot)
  const pts = data.map((d) => ({ x: sx(d.ms), y: sy(d.thi) }));
  const kemiringan = kemiringanMonoton(pts);
  const kurva = (i0, i1) => {
    let d = `M${pts[i0].x.toFixed(1)},${pts[i0].y.toFixed(1)}`;
    for (let i = i0; i < i1; i++) {
      const p = pts[i], q = pts[i + 1], h = (q.x - p.x) / 3;
      d += `C${(p.x + h).toFixed(1)},${(p.y + kemiringan[i] * h).toFixed(1)} ` +
        `${(q.x - h).toFixed(1)},${(q.y - kemiringan[i + 1] * h).toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`;
    }
    return d;
  };
  const n = pts.length;
  el('path', { d: `${kurva(0, n - 1)}L${pts[n - 1].x.toFixed(1)},${bawah}L${pts[0].x.toFixed(1)},${bawah}Z`,
    fill: warnaArea, class: 'area-thi' }, svg);

  // Garis: riwayat (tegas) dan prakiraan (putus-putus), bersambung di slot terakhir yang sudah lewat
  const iTerakhirLalu = data.findLastIndex((d) => d.ms <= nowMs); // -1 bila semua di masa depan
  if (iTerakhirLalu >= 1) el('path', { d: kurva(0, iTerakhirLalu), stroke: warnaGaris, class: 'garis' }, svg);
  if (iTerakhirLalu < n - 1) {
    el('path', { d: kurva(Math.max(0, iTerakhirLalu), n - 1), stroke: warnaGaris, class: 'garis garis-prakiraan' }, svg);
  }

  // Garis "Sekarang"
  if (nowMs >= x0 && nowMs <= x1) {
    const x = sx(nowMs);
    el('line', { x1: x, x2: x, y1: m.t, y2: bawah, class: 'sekarang' }, svg);
    const t = el('text', { x, y: m.t - 8, class: 'label-sekarang', 'text-anchor': 'middle' }, svg);
    t.textContent = 'Sekarang';
  }

  // Titik setiap slot: penuh = riwayat, berongga = prakiraan
  data.forEach((d, i) => {
    const k = kategoriTHI(d.thi);
    el('circle', { cx: pts[i].x, cy: pts[i].y, r: 3.5,
      class: d.ms > nowMs ? 'titik-data prakiraan' : 'titik-data', style: `--warna: var(--k-${k.id})` }, svg);
  });

  // Anotasi otomatis: THI tertinggi dan terendah dalam rentang grafik
  const iMaks = thi.indexOf(Math.max(...thi)), iMin = thi.indexOf(Math.min(...thi));
  if (thi[iMaks] !== thi[iMin]) {
    for (const [i, teks, dy] of [[iMaks, 'Tertinggi', -12], [iMin, 'Terendah', 20]]) {
      const d = data[i];
      const x = Math.min(Math.max(pts[i].x, m.l + 56), m.l + iw - 56);
      const t = el('text', { x, y: pts[i].y + dy, class: 'anotasi', 'text-anchor': 'middle' }, svg);
      t.textContent = `${teks} ${angka(d.thi)} · ${jam(d.ms)}`;
      el('circle', { cx: pts[i].x, cy: pts[i].y, r: 6, class: 'cincin-anotasi' }, svg);
    }
  }

  // Label zona di lapisan teratas agar tidak tertutup garis
  labelZona.forEach((g) => svg.appendChild(g));

  // Lapisan interaksi
  const bidik = el('line', { y1: m.t, y2: m.t + ih, class: 'bidik', visibility: 'hidden' }, svg);
  const titikAktif = el('circle', { r: 5, class: 'titik-aktif', visibility: 'hidden' }, svg);
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  wadah.appendChild(tip);

  const tampilkan = (d) => {
    const x = sx(d.ms), y = sy(d.thi);
    for (const a of [bidik]) { a.setAttribute('x1', x); a.setAttribute('x2', x); a.setAttribute('visibility', 'visible'); }
    titikAktif.setAttribute('cx', x); titikAktif.setAttribute('cy', y); titikAktif.setAttribute('visibility', 'visible');
    const k = kategoriTHI(d.thi);
    tip.replaceChildren();
    const nilai = document.createElement('strong');
    nilai.textContent = `THI ${angka(d.thi)}`;
    const kat = document.createElement('span');
    kat.textContent = k.label;
    const ket = document.createElement('small');
    ket.textContent = `${hariSingkat(d.ms)}, ${jam(d.ms)} WIB · ${angka(d.t)} °C · ${angka(d.hu, 0)}%` +
      (d.ms > nowMs ? ' · prakiraan' : '');
    tip.append(nilai, kat, ket);
    tip.hidden = false;
    const lebar = tip.offsetWidth;
    tip.style.left = `${Math.min(Math.max(0, x - lebar / 2), W - lebar)}px`;
    tip.style.top = `${Math.max(0, y - tip.offsetHeight - 12)}px`;
  };
  const sembunyikan = () => {
    bidik.setAttribute('visibility', 'hidden'); titikAktif.setAttribute('visibility', 'hidden'); tip.hidden = true;
  };
  const terdekat = (px) => data.reduce((a, d) => (Math.abs(sx(d.ms) - px) < Math.abs(sx(a.ms) - px) ? d : a));

  const area = el('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent', tabindex: 0,
    'aria-label': 'Area grafik. Gunakan panah kiri/kanan untuk membaca nilai per slot.' }, svg);
  const posisiX = (ev) => (ev.clientX - svg.getBoundingClientRect().left) * (W / svg.getBoundingClientRect().width);
  area.addEventListener('pointermove', (ev) => tampilkan(terdekat(posisiX(ev))));
  area.addEventListener('pointerdown', (ev) => tampilkan(terdekat(posisiX(ev))));
  area.addEventListener('pointerleave', sembunyikan);
  let iFokus = Math.max(0, data.findIndex((d) => d.ms >= nowMs));
  area.addEventListener('focus', () => tampilkan(data[iFokus]));
  area.addEventListener('blur', sembunyikan);
  area.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowRight') iFokus = Math.min(data.length - 1, iFokus + 1);
    else if (ev.key === 'ArrowLeft') iFokus = Math.max(0, iFokus - 1);
    else return;
    ev.preventDefault();
    tampilkan(data[iFokus]);
  });
}

function isiTabel(tbody, data, nowMs) {
  tbody.replaceChildren();
  for (const d of data) {
    const tr = document.createElement('tr');
    const sel = [
      `${hariSingkat(d.ms)}, ${jam(d.ms)}`, angka(d.t), angka(d.hu, 0), angka(d.thi),
      kategoriTHI(d.thi).label, d.ms > nowMs ? 'Prakiraan' : 'Riwayat',
    ];
    for (const s of sel) { const td = document.createElement('td'); td.textContent = s; tr.appendChild(td); }
    tbody.appendChild(tr);
  }
}

/** Kemiringan kurva monoton (Fritsch–Carlson): kurva tidak membuat puncak palsu di antara slot. */
function kemiringanMonoton(p) {
  const n = p.length;
  if (n < 2) return [0];
  const s = [];
  for (let i = 0; i < n - 1; i++) s.push((p[i + 1].y - p[i].y) / (p[i + 1].x - p[i].x));
  const t = [s[0]];
  for (let i = 1; i < n - 1; i++) t.push(s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2);
  t.push(s[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / s[i], b = t[i + 1] / s[i], h = a * a + b * b;
    if (h > 9) { const tau = 3 / Math.sqrt(h); t[i] = tau * a * s[i]; t[i + 1] = tau * b * s[i]; }
  }
  return t;
}
