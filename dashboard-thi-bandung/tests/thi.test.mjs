// Kasus uji perhitungan THI dan kategori (indikator Tabel 3.3: selisih ≤ 0,1 °C dari hitungan manual).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hitungTHI, kategoriTHI } from '../public/js/thi.js';

// [T (°C), RH (%), THI hitungan manual]
const KASUS = [
  [26, 81, 25.0],  // contoh wireframe Lampiran A
  [30, 49, 26.9],  // prakiraan BMKG 14 Okt 2026 (latar belakang proposal)
  [26, 81, 25.0],
  [18, 90, 17.6],  // malam hari khas Bandung
  [22, 70, 20.7],
  [24, 60, 22.1],
  [28, 75, 26.6],
  [32, 70, 30.1],
  [20, 95, 19.8],
  [0, 50, 0.0],
];

test('THI sesuai hitungan manual (selisih ≤ 0,1 °C)', () => {
  for (const [t, rh, manual] of KASUS) {
    const thi = hitungTHI(t, rh);
    assert.ok(Math.abs(thi - manual) <= 0.1, `T=${t}, RH=${rh}: ${thi} vs manual ${manual}`);
  }
});

test('THI dibulatkan satu desimal', () => {
  assert.equal(hitungTHI(25.3, 77.7), 24.2);
  assert.equal(String(hitungTHI(26, 81)), '25');
});

test('nilai tidak valid menghasilkan null', () => {
  assert.equal(hitungTHI(NaN, 80), null);
  assert.equal(hitungTHI(25, undefined), null);
  assert.equal(kategoriTHI(null), null);
});

test('batas kategori BMKG', () => {
  const k = (x) => kategoriTHI(x).label;
  assert.equal(k(17.6), 'Dingin');
  assert.equal(k(20.9), 'Dingin');
  assert.equal(k(21.0), 'Nyaman');
  assert.equal(k(24.0), 'Nyaman');
  assert.equal(k(24.1), 'Agak nyaman'); // celah 24–25 tertutup
  assert.equal(k(27.0), 'Agak nyaman');
  assert.equal(k(27.1), 'Tidak nyaman');
});
