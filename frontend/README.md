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

## Rencana Integrasi Backend (fase berikutnya)

- Ganti `MOCK_JOBS` dengan endpoint yang memanggil scraper WAT per sumber.
- Pindahkan `computeMatchScore` ke backend (atau LLM) untuk ranking semantik yang lebih kuat.
- Tambah pagination, simpan/lamar lowongan, dan generate resume tertarget (sudah ada `tools/generate_resume.py`).
