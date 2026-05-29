# LokerMatch — Prototipe Frontend

Web app pencari kerja yang membantu kandidat menemukan lowongan paling relevan
dari **Glints, JobStreet, Loker.id, dan LinkedIn** dalam satu pencarian, diurutkan
berdasarkan tingkat kesesuaian dengan profil & keyword mereka.

> **Status:** Prototipe **frontend saja** (sesuai permintaan). Belum ada backend.
> Data lowongan masih **simulasi** (`data.js`). Scraping nyata akan ditangani
> backend WAT (lihat `tools/scrape_jobstreet.py`) di fase berikutnya.

## Cara Menjalankan

Tanpa build, tanpa dependency. Pilih salah satu:

```bash
# Opsi A — buka langsung
buka frontend/index.html di browser

# Opsi B — lewat server lokal (disarankan)
cd frontend
python -m http.server 8000
# lalu buka http://localhost:8000
```

## Alur Pengguna (3 Langkah)

1. **Brief CV** — kandidat mengisi target posisi, keahlian, pengalaman, ringkasan.
   Dipakai AI sebagai sinyal utama untuk menilai kecocokan tiap lowongan. (Bisa dilewati.)
2. **Kriteria Pencarian** — Job Description + filter:
   - Lokasi kota, Tipe lokasi (Onsite/Remote/Hybrid)
   - Status pekerjaan (Full/Part Time, Kontrak, Magang, Freelance)
   - Level pengalaman, Gaji minimum, Tanggal posting
   - Sumber website (centang yang ingin di-scrape)
   - **Preview "Prompt Akhir"** dirakit otomatis dari CV + filter (real-time).
3. **Hasil** — tabel lowongan dengan **header kolom yang bisa diklik untuk sorting**
   (Match %, Posisi, Perusahaan, Lokasi, Status, Gaji, Tanggal, Sumber). Klik sekali
   untuk urut, klik lagi untuk balik arah.

## Logika Match Score (0–100)

Dihitung di `app.js → computeMatchScore()`:

| Bobot | Komponen |
|------:|----------|
| 55% | Relevansi konten — overlap keyword JD + skill CV vs. judul/skill/deskripsi lowongan |
| 15% | Kecocokan level pengalaman |
| 10% | Kecocokan tipe lokasi kerja |
| 10% | Kecocokan kota |
| 10% | Gaji memenuhi ekspektasi minimum |

Filter "keras" (sumber, status, tanggal posting) menyaring dulu; sisanya diberi skor lalu diurutkan.

## Struktur File

```
frontend/
  index.html   # markup + 3 step panel
  styles.css   # tema, responsif, komponen tabel
  app.js       # state, match score, pencarian, sorting, render
  data.js      # MOCK_JOBS (skema menyerupai output scraper agar mudah diintegrasi)
```

## Jembatan ke Backend WAT (sudah tersedia)

Frontend otomatis memuat **data live** dari `frontend/jobs.json` bila ada
(`app.js → loadJobs()`); jika tidak ada (mis. dibuka via `file://` atau belum
scraping), otomatis **fallback ke data simulasi** `MOCK_JOBS`. Indikator sumber
data ("DATA LIVE" / "DATA SIMULASI") tampil di atas halaman.

Pipeline data live:

```bash
# 1. Scrape lowongan nyata (backend WAT yang sudah ada)
python tools/scrape_jobstreet.py "data analyst" --max 50 --detail
#    -> menghasilkan .tmp/jobs_data_analyst_<timestamp>.json

# 2. Normalisasi hasil scraping ke skema frontend
python tools/export_jobs_for_frontend.py            # ambil file .tmp terbaru
#    atau gabungkan beberapa sumber:
python tools/export_jobs_for_frontend.py .tmp/jobs_glints.json:Glints .tmp/jobs_js.json:JobStreet
#    -> menghasilkan frontend/jobs.json

# 3. Jalankan frontend lewat http server -> data live otomatis terbaca
cd frontend && python -m http.server 8000
```

`tools/export_jobs_for_frontend.py` adalah adapter deterministik (tanpa API
berbayar) yang menormalkan output scraper:
- `salary` string ("Rp 8.000.000 - Rp 12jt") → `salaryMin`/`salaryMax`
- `posted_date` ("2 hari lalu"/"kemarin"/ISO) → `postedDaysAgo`
- `job_type` → `employment`; `experience_required` → `level`
- `location` → `city` + deteksi `workType` (Remote/Hybrid/Onsite)
- dedup berdasarkan id, gabung multi-sumber

> `frontend/jobs.json` adalah data hasil generate dan **di-gitignore** (tidak di-commit).

## Rencana Lanjutan

- Tambah scraper untuk Glints / Loker.id / LinkedIn (skema output samakan dengan JobStreet → langsung kompatibel dengan adapter).
- Pindahkan/perkuat `computeMatchScore` dengan ranking semantik (LLM/embedding) di backend.
- Pagination, simpan/lamar lowongan, dan generate resume tertarget (sudah ada `tools/generate_resume.py`).
