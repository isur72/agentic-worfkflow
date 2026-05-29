#!/usr/bin/env python3
"""
Generate tailored resumes for each job listing using Claude API.

Usage:
  python tools/generate_resume.py .tmp/jobs_data_analyst_20241201.json
  python tools/generate_resume.py .tmp/jobs_data_analyst_20241201.json --profile user_profile.json --max 10

Output:
  .tmp/resumes/run_<timestamp>/ — satu file .md per lowongan
  .tmp/resumes/run_<timestamp>/summary.json — ringkasan hasil
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent.parent
TMP_DIR  = BASE_DIR / ".tmp"
RESUMES_DIR = TMP_DIR / "resumes"

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

RESUME_PROMPT = """\
Kamu adalah expert resume writer profesional. Buat resume yang disesuaikan (tailored) \
untuk lowongan pekerjaan di bawah ini.

## Profil Kandidat:
{user_profile}

## Detail Lowongan:
**Posisi:** {title}
**Perusahaan:** {company}
**Lokasi:** {location}
**Tipe:** {job_type}
**Pengalaman Dibutuhkan:** {experience}

**Deskripsi Pekerjaan:**
{description}

**Tanggung Jawab:**
{responsibilities}

**Persyaratan/Kualifikasi:**
{requirements}

**Skills yang Dibutuhkan:**
{skills}

## Instruksi:
1. Buat resume profesional dalam format Markdown
2. Sesuaikan resume spesifik untuk lowongan ini — soroti pengalaman dan skill yang relevan
3. Gunakan Bahasa Indonesia (kecuali nama tool/teknologi tetap bahasa Inggris)
4. Struktur: Header Kontak → Ringkasan Profesional → Pengalaman Kerja → Keahlian → Pendidikan → Sertifikasi
5. Maksimal konten setara 2 halaman A4
6. Gunakan action verb yang kuat dan kuantifikasi pencapaian bila memungkinkan
7. Jangan tambahkan informasi yang tidak ada di profil kandidat

Buat resume sekarang:"""


def load_profile(profile_path: Path) -> dict:
    with open(profile_path, "r", encoding="utf-8") as f:
        return json.load(f)


def fmt_list(items) -> str:
    if not items:
        return "Tidak disebutkan"
    if isinstance(items, list):
        return "\n".join(f"- {item}" for item in items)
    return str(items)


def generate_resume(client, job: dict, profile: dict) -> str:
    prompt = RESUME_PROMPT.format(
        user_profile=json.dumps(profile, ensure_ascii=False, indent=2),
        title=job.get("title", ""),
        company=job.get("company", ""),
        location=job.get("location", ""),
        job_type=job.get("job_type", ""),
        experience=job.get("experience_required", ""),
        description=job.get("description") or job.get("brief_description") or "Lihat URL lowongan",
        responsibilities=fmt_list(job.get("responsibilities")),
        requirements=fmt_list(job.get("requirements")),
        skills=fmt_list(job.get("skills"))
    )

    message = client.messages.create(
        model="claude-opus-4-8",
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}]
    )
    return message.content[0].text


def main():
    parser = argparse.ArgumentParser(
        description="Generate tailored resume untuk setiap lowongan menggunakan Claude API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Contoh:
  python tools/generate_resume.py .tmp/jobs_data_analyst_20241201.json
  python tools/generate_resume.py .tmp/jobs_software_engineer_20241201.json --max 10
        """
    )
    parser.add_argument("jobs_file", help="Path ke file JSON hasil scrape_jobstreet.py")
    parser.add_argument("--profile", default="user_profile.json",
                        help="Path ke file profil pengguna (default: user_profile.json)")
    parser.add_argument("--max", type=int, default=50,
                        help="Jumlah resume yang dihasilkan (default: 50)")
    args = parser.parse_args()

    if not ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY belum diset di .env")
        sys.exit(1)

    jobs_path = Path(args.jobs_file)
    if not jobs_path.exists():
        print(f"ERROR: File tidak ditemukan: {jobs_path}")
        sys.exit(1)

    profile_path = BASE_DIR / args.profile
    if not profile_path.exists():
        print(f"ERROR: File profil tidak ditemukan: {profile_path}")
        print("Salin user_profile_template.json → user_profile.json dan isi data Anda")
        sys.exit(1)

    try:
        import anthropic
    except ImportError:
        print("ERROR: anthropic belum terinstall. Jalankan: pip install anthropic")
        sys.exit(1)

    with open(jobs_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    jobs = raw.get("jobs", raw) if isinstance(raw, dict) else raw
    jobs = jobs[:args.max]

    profile = load_profile(profile_path)
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    RESUMES_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    run_dir = RESUMES_DIR / f"run_{timestamp}"
    run_dir.mkdir(exist_ok=True)

    print(f"Membuat {len(jobs)} resume...")
    print(f"Output: {run_dir}")
    print("-" * 60)

    results = []

    for i, job in enumerate(jobs):
        title   = job.get("title", "Unknown")
        company = job.get("company", "Unknown")
        print(f"[{i+1}/{len(jobs)}] {title} @ {company}")

        try:
            resume_text = generate_resume(client, job, profile)

            safe = f"{i+1:02d}_{company}_{title}".replace("/", "-").replace(" ", "_")[:80]
            out_file = run_dir / f"{safe}.md"

            with open(out_file, "w", encoding="utf-8") as f:
                f.write(resume_text)

            results.append({"title": title, "company": company,
                            "file": out_file.name, "status": "success"})
            print(f"  OK: {out_file.name}")

        except Exception as e:
            print(f"  ERROR: {e}")
            results.append({"title": title, "company": company,
                            "status": "failed", "error": str(e)})

        time.sleep(0.5)

    success_count = sum(1 for r in results if r["status"] == "success")

    summary = {
        "generated_at": datetime.now().isoformat(),
        "jobs_file":    str(jobs_path),
        "total":        len(jobs),
        "success":      success_count,
        "failed":       len(jobs) - success_count,
        "results":      results
    }
    with open(run_dir / "summary.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\nSelesai! {success_count}/{len(jobs)} resume berhasil dibuat")
    print(f"Lokasi: {run_dir}")


if __name__ == "__main__":
    main()
