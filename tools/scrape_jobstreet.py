#!/usr/bin/env python3
"""
Scrape job listings from JobStreet Indonesia using FireCrawl.

Usage:
  python tools/scrape_jobstreet.py "data analyst" --max 50 --detail
  python tools/scrape_jobstreet.py "software engineer" --max 30

Output:
  .tmp/jobs_<keyword>_<timestamp>.json
"""

import os
import sys
import json
import time
import argparse
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent.parent
TMP_DIR = BASE_DIR / ".tmp"
TMP_DIR.mkdir(exist_ok=True)

FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY")

SEARCH_URL = "https://id.jobstreet.com/id/jobs?keywords={keyword}&page={page}"

LISTING_SCHEMA = {
    "type": "object",
    "properties": {
        "jobs": {
            "type": "array",
            "description": "Semua lowongan pekerjaan yang tampil di halaman ini",
            "items": {
                "type": "object",
                "properties": {
                    "title":       {"type": "string", "description": "Judul posisi pekerjaan"},
                    "company":     {"type": "string", "description": "Nama perusahaan"},
                    "location":    {"type": "string", "description": "Lokasi kerja"},
                    "salary":      {"type": "string", "description": "Rentang gaji jika ditampilkan"},
                    "job_url":     {"type": "string", "description": "URL halaman detail lowongan"},
                    "posted_date": {"type": "string", "description": "Tanggal posting"},
                    "tags":        {"type": "array", "items": {"type": "string"}, "description": "Label/tag pekerjaan"}
                },
                "required": ["title", "company"]
            }
        },
        "has_next_page": {"type": "boolean", "description": "Apakah masih ada halaman berikutnya"}
    }
}

DETAIL_SCHEMA = {
    "type": "object",
    "properties": {
        "title":               {"type": "string"},
        "company":             {"type": "string"},
        "location":            {"type": "string"},
        "salary":              {"type": "string"},
        "job_type":            {"type": "string", "description": "Full-time / Part-time / Contract / dll"},
        "experience_required": {"type": "string"},
        "education_required":  {"type": "string"},
        "description":         {"type": "string", "description": "Deskripsi lengkap pekerjaan"},
        "responsibilities":    {"type": "array", "items": {"type": "string"}},
        "requirements":        {"type": "array", "items": {"type": "string"}},
        "skills":              {"type": "array", "items": {"type": "string"}},
        "benefits":            {"type": "array", "items": {"type": "string"}}
    }
}


def scrape_search_page(app, keyword: str, page: int) -> dict:
    url = SEARCH_URL.format(keyword=keyword.replace(" ", "+"), page=page)
    print(f"  Halaman {page}: {url}")

    result = app.scrape_url(
        url,
        params={
            "formats": ["extract"],
            "extract": {
                "prompt": (
                    f"Ekstrak semua listing lowongan pekerjaan dari halaman hasil pencarian JobStreet "
                    f"untuk keyword '{keyword}'. Untuk setiap lowongan, ambil: judul posisi, nama perusahaan, "
                    f"lokasi, gaji (jika ada), URL detail, tanggal posting, dan tags."
                ),
                "schema": LISTING_SCHEMA
            },
            "waitFor": 3000
        }
    )
    return result.get("extract", {})


def scrape_job_detail(app, job_url: str) -> dict:
    if not job_url.startswith("http"):
        job_url = "https://id.jobstreet.com" + job_url

    result = app.scrape_url(
        job_url,
        params={
            "formats": ["extract"],
            "extract": {
                "prompt": (
                    "Ekstrak detail lengkap lowongan ini: judul, perusahaan, lokasi, gaji, tipe pekerjaan, "
                    "pengalaman yang dibutuhkan, pendidikan, deskripsi lengkap, tanggung jawab, "
                    "persyaratan/kualifikasi, skills, dan benefit."
                ),
                "schema": DETAIL_SCHEMA
            },
            "waitFor": 3000
        }
    )
    return result.get("extract", {})


def main():
    parser = argparse.ArgumentParser(
        description="Scrape lowongan pekerjaan dari JobStreet Indonesia",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Contoh penggunaan:
  python tools/scrape_jobstreet.py "data analyst"
  python tools/scrape_jobstreet.py "software engineer" --max 30
  python tools/scrape_jobstreet.py "marketing manager" --max 50 --detail
        """
    )
    parser.add_argument("keyword", help="Keyword pencarian (gunakan tanda kutip untuk kata majemuk)")
    parser.add_argument("--max",    type=int, default=50, help="Jumlah maksimum lowongan (default: 50)")
    parser.add_argument("--detail", action="store_true",
                        help="Scrape detail lengkap tiap lowongan — lebih lambat tapi menghasilkan resume lebih baik")
    args = parser.parse_args()

    if not FIRECRAWL_API_KEY:
        print("ERROR: FIRECRAWL_API_KEY belum diset di .env")
        sys.exit(1)

    try:
        from firecrawl import FirecrawlApp
    except ImportError:
        print("ERROR: firecrawl-py belum terinstall. Jalankan: pip install firecrawl-py")
        sys.exit(1)

    app = FirecrawlApp(api_key=FIRECRAWL_API_KEY)

    print(f"Mencari lowongan di JobStreet: '{args.keyword}' (maks {args.max})")
    print("-" * 60)

    all_jobs = []
    page = 1

    while len(all_jobs) < args.max:
        try:
            page_data = scrape_search_page(app, args.keyword, page)
            page_jobs = page_data.get("jobs", [])

            if not page_jobs:
                print(f"  Tidak ada lowongan di halaman {page}. Selesai.")
                break

            all_jobs.extend(page_jobs)
            print(f"  Halaman {page}: +{len(page_jobs)} lowongan (total: {min(len(all_jobs), args.max)})")

            if not page_data.get("has_next_page", True) or len(page_jobs) < 5:
                break

            page += 1
            time.sleep(2)

        except Exception as e:
            print(f"  Error halaman {page}: {e}")
            if page == 1:
                print("  Gagal scraping halaman pertama. Periksa API key dan koneksi.")
                sys.exit(1)
            break

    all_jobs = all_jobs[:args.max]

    if args.detail and all_jobs:
        print(f"\nMengambil detail untuk {len(all_jobs)} lowongan...")
        for i, job in enumerate(all_jobs):
            job_url = job.get("job_url", "")
            if not job_url:
                continue
            print(f"  [{i+1}/{len(all_jobs)}] {job.get('title', '?')} @ {job.get('company', '?')}")
            try:
                detail = scrape_job_detail(app, job_url)
                job.update(detail)
            except Exception as e:
                print(f"    Peringatan: Gagal ambil detail — {e}")
            time.sleep(1.5)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = TMP_DIR / f"jobs_{args.keyword.replace(' ', '_')}_{timestamp}.json"

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump({
            "keyword":     args.keyword,
            "scraped_at":  datetime.now().isoformat(),
            "total":       len(all_jobs),
            "has_detail":  args.detail,
            "jobs":        all_jobs
        }, f, ensure_ascii=False, indent=2)

    print(f"\nSelesai! {len(all_jobs)} lowongan disimpan ke:")
    print(str(output_file))


if __name__ == "__main__":
    main()
