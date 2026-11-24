/**
 * chart.js — grafik tren THI per 3 jam (SVG murni, tanpa library).
 *  - pita warna latar = 4 kategori THI (dengan label teks, bukan warna saja)
 *  - garis tegas = riwayat, garis putus-putus = prakiraan ke depan
 *  - garis vertikal "Sekarang"
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
  const H = 230;
  const m = { l: 34, r: 10, t: 12, b: 30 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;

  const thi = data.map((d) => d.thi);
  const yMin = Math.min(19, Math.floor(Math.min(...thi)) - 1);
  const yMax = Math.max(28, Math.ceil(Math.max(...thi)) + 1);
  const x0 = data[0].ms, x1 = data.at(-1).ms;
  const sx = (ms) => m.l + ((ms - x0) / (x1 - x0)) * iw;
  const sy = (v) => m.t + (1 - (v - yMin) / (yMax - yMin)) * ih;

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img',
    'aria-label': 'Grafik tren THI per 3 jam. Data lengkap tersedia di tabel di bawah grafik.' }, wadah);

  // Pita kategori
  const batas = [-Infinity, 21, 24, 27, Infinity];
  KATEGORI.forEach((k, i) => {
    const lo = Math.max(batas[i], yMin), hi = Math.min(batas[i + 1], yMax);
    if (hi <= lo) return;
    el('rect', { x: m.l, y: sy(hi), width: iw, height: sy(lo) - sy(hi), class: `pita pita-${k.id}` }, svg);
    if (sy(lo) - sy(hi) < 14) return; // pita terlalu tipis untuk label
    const t = el('text', { x: m.l + iw - 6, y: (sy(hi) + sy(lo)) / 2, class: 'label-pita',
      'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg);
    t.textContent = k.label;
  });

  // Sumbu Y: batas kategori
  for (const v of [21, 24, 27]) {
    el('line', { x1: m.l, x2: m.l + iw, y1: sy(v), y2: sy(v), class: 'grid' }, svg);
    const t = el('text', { x: m.l - 6, y: sy(v) + 4, class: 'tick', 'text-anchor': 'end' }, svg);
    t.textContent = v;
  }
  const tY = el('text', { x: m.l - 6, y: m.t + 4, class: 'tick', 'text-anchor': 'end' }, svg);
  tY.textContent = '°C';

  // Sumbu X: label tiap pukul 00.00 & 12.00 WIB
  el('line', { x1: m.l, x2: m.l + iw, y1: m.t + ih, y2: m.t + ih, class: 'sumbu' }, svg);
  for (const d of data) {
    const h = jamWIB(d.ms);
    if (h !== 0 && h !== 12) continue;
    const x = sx(d.ms);
    el('line', { x1: x, x2: x, y1: m.t + ih, y2: m.t + ih + 4, class: 'sumbu' }, svg);
    const t = el('text', { x, y: H - 10, class: 'tick', 'text-anchor': 'middle' }, svg);
    t.textContent = h === 0 ? hariSingkat(d.ms) : '12.00';
  }

  // Garis: riwayat (tegas) dan prakiraan (putus-putus), bersambung di titik terdekat "sekarang"
  const titik = (xs) => xs.map((d, i) => `${i ? 'L' : 'M'}${sx(d.ms).toFixed(1)},${sy(d.thi).toFixed(1)}`).join('');
  const iTerakhirLalu = data.findLastIndex((d) => d.ms <= nowMs); // -1 bila semua di masa depan
  const lalu = data.slice(0, iTerakhirLalu + 1);
  const depan = data.slice(Math.max(0, iTerakhirLalu));
  if (lalu.length > 1) el('path', { d: titik(lalu), class: 'garis' }, svg);
  if (depan.length > 1) el('path', { d: titik(depan), class: 'garis garis-prakiraan' }, svg);

  // Label pita dipindah ke atas garis agar tetap terbaca (diberi halo lewat CSS)
  svg.querySelectorAll('.label-pita').forEach((n) => svg.appendChild(n));

  // Garis "Sekarang"
  if (nowMs >= x0 && nowMs <= x1) {
    const x = sx(nowMs);
    el('line', { x1: x, x2: x, y1: m.t, y2: m.t + ih, class: 'sekarang' }, svg);
    const t = el('text', { x: x + 4, y: m.t + ih - 6, class: 'label-sekarang' }, svg);
    t.textContent = 'Sekarang';
  }

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
  const posisi = (ev) => (ev.clientX - svg.getBoundingClientRect().left) * (W / svg.getBoundingClientRect().width);
  area.addEventListener('pointermove', (ev) => tampilkan(terdekat(posisi(ev))));
  area.addEventListener('pointerdown', (ev) => tampilkan(terdekat(posisi(ev))));
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
