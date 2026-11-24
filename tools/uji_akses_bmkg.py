"""
Uji akses API Prakiraan Cuaca BMKG — Dashboard Indeks Kenyamanan Kota Bandung (Kelompok 7)

Yang diuji:
  1. Akses API untuk 30 kelurahan perwakilan (satu per kecamatan): kode valid? data lengkap?
  2. Header CORS: apakah API bisa dipanggil langsung dari browser (tanpa serverless)?
  3. Perbedaan prakiraan antarkelurahan dalam satu kecamatan (Coblong, Bandung Kulon, Gedebage).
  4. Perhitungan THI + kategori BMKG untuk setiap slot 3 jam.

Cara pakai:
  - Letakkan file ini satu folder dengan wilayah_kota_bandung.csv
  - Jalankan:  python uji_akses_bmkg.py
  - Butuh ±1 menit (dijeda agar tidak melewati batas 60 permintaan/menit).

Output (di folder yang sama):
  - hasil_uji_akses.csv        status per kecamatan
  - prakiraan_thi.csv          semua slot prakiraan + THI + kategori
  - perbandingan_kelurahan.csv selisih suhu/kelembapan antarkelurahan dalam satu kecamatan

Sumber data: BMKG (Badan Meteorologi, Klimatologi, dan Geofisika)
"""

import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
from collections import defaultdict

API_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={kode}"
JEDA_DETIK = 1.1                     # aman di bawah 60 permintaan/menit
KECAMATAN_PEMBANDING = ["32.73.02", "32.73.15", "32.73.27"]  # Coblong, Bandung Kulon, Gedebage
ORIGIN_UJI = "https://contoh-dashboard.pages.dev"            # pura-pura dipanggil dari situs dashboard

FOLDER = os.path.dirname(os.path.abspath(__file__))
FILE_WILAYAH = os.path.join(FOLDER, "wilayah_kota_bandung.csv")


# ---------------------------------------------------------------- THI
def hitung_thi(t, rh):
    """Nieuwolt (1977): THI = 0,8 T + (RH x T)/500, dibulatkan 1 desimal."""
    return round(0.8 * t + (rh * t) / 500, 1)


def kategori_thi(thi):
    """Klasifikasi BMKG (@infobmkg); ambang 21-24 / >27 sesuai Wati & Fatkhuroyan (2017)."""
    if thi < 21:
        return "Dingin"
    if thi <= 24:
        return "Nyaman"
    if thi <= 27:
        return "Agak nyaman"
    return "Tidak nyaman"


# ---------------------------------------------------------------- API
def ambil(kode):
    """Ambil JSON prakiraan satu kelurahan. Mengembalikan (status_http, header, data|None, pesan_error)."""
    req = urllib.request.Request(
        API_URL.format(kode=kode),
        headers={"User-Agent": "Mozilla/5.0 (uji-dashboard-THI-ITB)", "Origin": ORIGIN_UJI},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            header = {k.lower(): v for k, v in r.headers.items()}
            return r.status, header, json.loads(r.read().decode("utf-8")), ""
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, None, str(e)
    except Exception as e:  # koneksi gagal, timeout, JSON rusak, dll.
        return None, {}, None, f"{type(e).__name__}: {e}"


def ratakan_slot(obj):
    """Cari semua slot prakiraan (dict yang punya kunci 't' dan 'hu') di struktur JSON bersarang."""
    if isinstance(obj, dict):
        if "t" in obj and "hu" in obj:
            yield obj
        else:
            for v in obj.values():
                yield from ratakan_slot(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from ratakan_slot(v)


def baca_lokasi(data):
    lok = data.get("lokasi") or {}
    if not lok and isinstance(data.get("data"), list) and data["data"]:
        lok = data["data"][0].get("lokasi") or {}
    return lok


# ---------------------------------------------------------------- utama
def main():
    if not os.path.exists(FILE_WILAYAH):
        sys.exit(f"File {FILE_WILAYAH} tidak ditemukan. Letakkan satu folder dengan skrip ini.")

    with open(FILE_WILAYAH, encoding="utf-8") as f:
        wilayah = list(csv.DictReader(f))

    perwakilan = [w for w in wilayah if w["perwakilan"] == "ya"]
    pembanding = [w for w in wilayah
                  if w["kode_kecamatan"] in KECAMATAN_PEMBANDING and w["perwakilan"] != "ya"]
    daftar = perwakilan + pembanding

    print(f"Menguji {len(perwakilan)} kelurahan perwakilan + {len(pembanding)} kelurahan pembanding "
          f"(±{round(len(daftar) * JEDA_DETIK / 60, 1)} menit)\n")

    hasil_status, semua_slot, header_cors = [], [], None

    for i, w in enumerate(daftar, 1):
        status, header, data, err = ambil(w["kode_adm4"])
        if header_cors is None and status == 200:
            header_cors = header

        slots = list(ratakan_slot(data)) if data else []
        lengkap = sum(1 for s in slots if s.get("t") is not None and s.get("hu") is not None)
        lok = baca_lokasi(data) if data else {}
        ok = status == 200 and lengkap > 0

        tanda = "OK " if ok else "GAGAL"
        print(f"[{i:2d}/{len(daftar)}] {tanda} {w['kode_adm4']} {w['kecamatan']:<17} / {w['kelurahan']:<20}"
              f" HTTP {status}  slot={len(slots)}  {err}")

        if w["perwakilan"] == "ya":
            hasil_status.append({
                "kode_kecamatan": w["kode_kecamatan"], "kecamatan": w["kecamatan"],
                "kode_adm4": w["kode_adm4"], "kelurahan": w["kelurahan"],
                "http": status, "jumlah_slot": len(slots), "slot_lengkap": lengkap,
                "nama_desa_dari_bmkg": lok.get("desa", ""), "lat": lok.get("lat", ""), "lon": lok.get("lon", ""),
                "analysis_date": slots[0].get("analysis_date", "") if slots else "",
                "status": "OK" if ok else "GAGAL", "error": err,
            })

        for s in slots:
            t, hu = s.get("t"), s.get("hu")
            thi = hitung_thi(float(t), float(hu)) if t is not None and hu is not None else ""
            semua_slot.append({
                "kode_kecamatan": w["kode_kecamatan"], "kecamatan": w["kecamatan"],
                "kode_adm4": w["kode_adm4"], "kelurahan": w["kelurahan"], "perwakilan": w["perwakilan"],
                "local_datetime": s.get("local_datetime", ""), "analysis_date": s.get("analysis_date", ""),
                "t": t, "hu": hu, "thi": thi, "kategori": kategori_thi(thi) if thi != "" else "",
                "weather_desc": s.get("weather_desc", ""), "ws": s.get("ws", ""), "wd": s.get("wd", ""),
            })

        time.sleep(JEDA_DETIK)

    # --- simpan hasil
    tulis_csv("hasil_uji_akses.csv", hasil_status)
    tulis_csv("prakiraan_thi.csv", semua_slot)
    perbandingan = bandingkan(semua_slot)
    tulis_csv("perbandingan_kelurahan.csv", perbandingan)

    # --- ringkasan
    ok = sum(1 for h in hasil_status if h["status"] == "OK")
    print("\n================ RINGKASAN ================")
    print(f"1. Akses kelurahan perwakilan : {ok}/{len(hasil_status)} berhasil")
    for h in hasil_status:
        if h["status"] != "OK":
            print(f"   - GAGAL: {h['kecamatan']} ({h['kode_adm4']} {h['kelurahan']}) -> {h['error'] or 'data kosong'}")

    print("\n2. CORS (bisa dipanggil langsung dari browser?)")
    if header_cors is None:
        print("   Tidak bisa dicek (tidak ada respons sukses).")
    else:
        acao = header_cors.get("access-control-allow-origin")
        print(f"   Access-Control-Allow-Origin: {acao!r}")
        if acao in ("*", ORIGIN_UJI):
            print("   -> Kemungkinan BISA dipanggil langsung dari browser. Pastikan dengan uji di console browser.")
        else:
            print("   -> Kemungkinan TIDAK bisa dari browser. Perlu fungsi serverless sebagai perantara.")

    print("\n3. Perbedaan antarkelurahan dalam satu kecamatan (selisih maksimum pada slot yang sama)")
    for p in perbandingan:
        print(f"   {p['kecamatan']:<15} {p['jumlah_kelurahan']} kel | maks selisih suhu {p['maks_selisih_t']} °C, "
              f"kelembapan {p['maks_selisih_hu']} %, THI {p['maks_selisih_thi']} | slot berbeda kategori: "
              f"{p['slot_beda_kategori']}/{p['jumlah_slot']}")
    if perbandingan and all(p["maks_selisih_thi"] == 0 for p in perbandingan):
        print("   -> Identik: satu kelurahan perwakilan per kecamatan sudah cukup.")
    elif perbandingan:
        print("   -> Ada perbedaan: pertimbangkan merata-ratakan semua kelurahan per kecamatan.")

    kat = defaultdict(int)
    for s in semua_slot:
        if s["perwakilan"] == "ya" and s["kategori"]:
            kat[s["kategori"]] += 1
    print("\n4. Sebaran kategori THI (30 kelurahan perwakilan, seluruh slot)")
    for k in ["Dingin", "Nyaman", "Agak nyaman", "Tidak nyaman"]:
        print(f"   {k:<13}: {kat[k]}")
    print("\nFile tersimpan: hasil_uji_akses.csv, prakiraan_thi.csv, perbandingan_kelurahan.csv")
    print("Sumber data: BMKG")


def bandingkan(slots):
    """Bandingkan kelurahan dalam satu kecamatan pada local_datetime yang sama."""
    per_kec = defaultdict(lambda: defaultdict(list))
    for s in slots:
        if s["kode_kecamatan"] in KECAMATAN_PEMBANDING and s["thi"] != "":
            per_kec[(s["kode_kecamatan"], s["kecamatan"])][s["local_datetime"]].append(s)
    out = []
    for (kode, nama), per_waktu in sorted(per_kec.items()):
        ds_t = ds_hu = ds_thi = 0.0
        beda_kat = 0
        kel = set()
        for daftar in per_waktu.values():
            kel.update(d["kode_adm4"] for d in daftar)
            ts = [float(d["t"]) for d in daftar]
            hus = [float(d["hu"]) for d in daftar]
            this = [d["thi"] for d in daftar]
            ds_t, ds_hu = max(ds_t, max(ts) - min(ts)), max(ds_hu, max(hus) - min(hus))
            ds_thi = max(ds_thi, max(this) - min(this))
            beda_kat += len({d["kategori"] for d in daftar}) > 1
        out.append({"kode_kecamatan": kode, "kecamatan": nama, "jumlah_kelurahan": len(kel),
                    "jumlah_slot": len(per_waktu), "maks_selisih_t": round(ds_t, 1),
                    "maks_selisih_hu": round(ds_hu, 1), "maks_selisih_thi": round(ds_thi, 1),
                    "slot_beda_kategori": beda_kat})
    return out


def tulis_csv(nama, baris):
    path = os.path.join(FOLDER, nama)
    if not baris:
        open(path, "w").close()
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(baris[0].keys()))
        w.writeheader()
        w.writerows(baris)


if __name__ == "__main__":
    main()
