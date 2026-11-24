// Uji pipeline dengan respons BMKG tiruan (tanpa akses internet).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseRespons, ambilSemua, keIsoWIB } from '../pipeline/fetch-bmkg.mjs';
import { agregasi } from '../pipeline/aggregate.mjs';
import { perbaruiRiwayat } from '../pipeline/history.mjs';

const slotBMKG = (jam, t, hu, cuaca = 'Berawan') => ({
  local_datetime: `2026-12-01 ${jam}:00:00`, utc_datetime: 'x', analysis_date: '2026-12-01T00:00:00',
  t, hu, weather_desc: cuaca, ws: 5, wd: 'SE',
});
// Struktur seperti API BMKG: data[0].cuaca = [[slot hari 1...], [slot hari 2...]]
const respons = (slots) => ({ lokasi: { adm4: 'x' }, data: [{ lokasi: {}, cuaca: [slots] }] });

test('keIsoWIB menambahkan zona WIB', () => {
  assert.equal(keIsoWIB('2026-12-01 13:00:00'), '2026-12-01T13:00:00+07:00');
});

test('parseRespons meratakan struktur bersarang BMKG', () => {
  const s = parseRespons(respons([slotBMKG('10', 25, 80), slotBMKG('13', 27, 70)]));
  assert.equal(s.length, 2);
  assert.deepEqual(Object.keys(s[0]).sort(), ['analysis_date', 'cuaca', 'hu', 't', 'time', 'wd', 'ws']);
  assert.equal(s[1].time, '2026-12-01T13:00:00+07:00');
});

const WILAYAH = {
  kecamatan: [
    { kode: 'K1', nama: 'Satu', kelurahan: [{ kode: 'A' }, { kode: 'B' }] },
    { kode: 'K2', nama: 'Dua', kelurahan: [{ kode: 'C' }] },
  ],
};

test('agregasi merata-ratakan kelurahan, THI dari rata-rata, cuaca modus', () => {
  const hasil = [
    { kode: 'A', ok: true, slots: parseRespons(respons([slotBMKG('10', 26, 80, 'Hujan Ringan')])) },
    { kode: 'B', ok: true, slots: parseRespons(respons([slotBMKG('10', 27, 82, 'Hujan Ringan')])) },
    { kode: 'C', ok: false, slots: [], error: 'HTTP 500' },
  ];
  const a = agregasi(WILAYAH, hasil);
  const s = a.kecamatan.K1.slots[0];
  assert.equal(s.t, 26.5);
  assert.equal(s.hu, 81);
  assert.equal(s.thi, 25.5);           // 0,8·26,5 + 81·26,5/500
  assert.equal(s.kategori, 'agak-nyaman');
  assert.equal(s.cuaca, 'Hujan Ringan');
  assert.equal(s.n, 2);
  assert.equal(a.kecamatan.K2, undefined); // kecamatan tanpa data dilewati
});

test('ambilSemua mencoba ulang lalu mencatat kegagalan', async () => {
  let panggilan = 0;
  const fetchPalsu = async (url) => {
    panggilan++;
    if (url.endsWith('GAGAL')) return { ok: false, status: 503 };
    return { ok: true, json: async () => respons([slotBMKG('10', 25, 80)]) };
  };
  const r = await ambilSemua(['OK1', 'GAGAL'], { fetchFn: fetchPalsu, jedaMs: 0, log: () => {} });
  assert.equal(r[0].ok, true);
  assert.equal(r[1].ok, false);
  assert.match(r[1].error, /503/);
  assert.equal(panggilan, 4); // 1 sukses + 3 percobaan gagal
});

test('riwayat: slot baru di-upsert, slot lama dipertahankan', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'riwayat-'));
  const buat = (slots) => ({ kecamatan: { K1: { slots } } });
  perbaruiRiwayat(dir, buat([
    { time: '2026-12-01T10:00:00+07:00', t: 25, hu: 80, thi: 24.0, kategori: 'nyaman', n: 2 },
    { time: '2026-12-01T13:00:00+07:00', t: 27, hu: 70, thi: 26.2, kategori: 'agak-nyaman', n: 2 },
  ]));
  // pembaruan berikutnya: slot 10.00 sudah lewat (tidak ada lagi), slot 13.00 direvisi
  const bulan = perbaruiRiwayat(dir, buat([
    { time: '2026-12-01T13:00:00+07:00', t: 28, hu: 70, thi: 27.3, kategori: 'tidak-nyaman', n: 2 },
  ]));
  const data = JSON.parse(fs.readFileSync(path.join(dir, '2026-12.json'), 'utf8'));
  assert.deepEqual(bulan, ['2026-12']);
  assert.equal(data.kecamatan.K1['2026-12-01T10:00:00+07:00'].thi, 24.0);
  assert.equal(data.kecamatan.K1['2026-12-01T13:00:00+07:00'].thi, 27.3);
  assert.equal('n' in data.kecamatan.K1['2026-12-01T13:00:00+07:00'], false);
});
