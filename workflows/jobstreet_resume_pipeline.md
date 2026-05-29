# Workflow: JobStreet Resume Pipeline

## Objective
Scrape hingga 50 lowongan pekerjaan dari JobStreet Indonesia berdasarkan keyword, lalu generate resume yang disesuaikan (tailored) untuk setiap lowongan menggunakan Claude API.

---

## Required Inputs
| Input | Keterangan |
|-------|------------|
| `keyword` | Posisi/skill yang dicari, contoh: `"data analyst"`, `"software engineer"` |
| `user_profile.json` | Data CV/profil kandidat (salin dari `user_profile_template.json`) |
| `FIRECRAWL_API_KEY` | API key FireCrawl di `.env` — untuk scraping JobStreet |
| `ANTHROPIC_API_KEY` | API key Anthropic di `.env` — untuk generate resume dengan Claude |

---

## Setup Awal (Satu Kali)

```bash
# Install dependencies
pip install -r requirements.txt

# Salin dan isi profil pengguna
copy user_profile_template.json user_profile.json
# Buka user_profile.json dan isi dengan data Anda yang sebenarnya
```

Isi juga `.env` dengan API key yang valid:
```
FIRECRAWL_API_KEY=fc-xxxxx
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

---

## Langkah Eksekusi

### Step 1 — Scrape Lowongan
```bash
python tools/scrape_jobstreet.py "KEYWORD ANDA" --max 50 --detail
```

**Flag penting:**
- `--max 50` — jumlah maksimum lowongan yang dikumpulkan
- `--detail` — scrape deskripsi lengkap tiap lowongan (direkomendasikan; menghasilkan resume lebih relevan)
- Tanpa `--detail` hanya mengambil listing ringkas (lebih cepat, hemat API credit)

**Output:** `.tmp/jobs_<keyword>_<timestamp>.json`

**Estimasi waktu:**
- Tanpa `--detail`: ~2-3 menit untuk 50 lowongan
- Dengan `--detail`: ~10-15 menit untuk 50 lowongan

**Estimasi FireCrawl credit:**
- Tanpa `--detail`: ~5-10 credit
- Dengan `--detail`: ~100-150 credit

---

### Step 2 — (Opsional) Review & Filter Jobs
Buka file `.tmp/jobs_*.json` dan hapus lowongan yang tidak relevan sebelum generate resume. Ini menghemat waktu dan biaya API.

---

### Step 3 — Generate Resume
```bash
python tools/generate_resume.py .tmp/jobs_<keyword>_<timestamp>.json
```

**Flag opsional:**
- `--max 10` — generate hanya N resume pertama (berguna untuk test)
- `--profile path/ke/profil.json` — jika file profil bukan `user_profile.json`

**Output:**
- `.tmp/resumes/run_<timestamp>/` — folder berisi file `.md` per lowongan
- `.tmp/resumes/run_<timestamp>/summary.json` — ringkasan hasil (berhasil/gagal)

**Estimasi waktu:** ~15-25 menit untuk 50 resume

**Estimasi Anthropic API cost:** ~$0.50-1.50 untuk 50 resume (tergantung panjang job description)

---

## Expected Final Output
```
.tmp/
  jobs_data_analyst_20241201_143022.json     ← data lowongan
  resumes/
    run_20241201_150000/
      01_PT_ABC_Data_Analyst.md              ← resume #1
      02_PT_XYZ_Senior_Analyst.md            ← resume #2
      ...
      50_PT_DEF_Business_Analyst.md          ← resume #50
      summary.json                           ← ringkasan hasil
```

---

## Edge Cases & Known Issues

### JobStreet Scraping
- **Halaman kosong**: JobStreet menggunakan React (JavaScript rendering). FireCrawl menunggu 3 detik (`waitFor: 3000`). Jika masih kosong, naikkan `waitFor` di `tools/scrape_jobstreet.py` ke `5000`.
- **Rate limiting (429 error)**: Naikkan delay di `scrape_jobstreet.py`:
  - Antar halaman: `time.sleep(2)` → `time.sleep(4)`
  - Antar detail job: `time.sleep(1.5)` → `time.sleep(3)`
- **URL berubah**: Verifikasi format URL search di browser: `https://id.jobstreet.com/id/jobs?keywords=KEYWORD&page=2`. Jika berbeda, update `SEARCH_URL` di `scrape_jobstreet.py`.
- **Sedikit hasil**: Beberapa keyword spesifik mungkin hanya menghasilkan <50 lowongan. Tool akan berhenti otomatis ketika tidak ada halaman berikutnya.

### Resume Generation
- **Resume terlalu generik**: Pastikan `user_profile.json` berisi pencapaian spesifik dengan angka, bukan hanya deskripsi tugas.
- **Bahasa salah**: Jika lowongan berbahasa Inggris, Claude otomatis menyesuaikan. Jika perlu paksa satu bahasa, ubah instruksi di `RESUME_PROMPT` di `generate_resume.py`.
- **Anthropic rate limit**: Jika muncul error 429, naikkan `time.sleep(0.5)` ke `time.sleep(2)` di `generate_resume.py`.

---

## Improvement Log
*(Update bagian ini saat menemukan cara lebih baik atau hambatan baru)*

| Tanggal | Temuan | Perubahan |
|---------|--------|-----------|
| — | Initial version | Menggunakan FireCrawl extract + Claude Opus |
