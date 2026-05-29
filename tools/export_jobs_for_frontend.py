#!/usr/bin/env python3
"""
Adapter: normalisasi hasil scraping (.tmp/jobs_*.json) ke skema yang dipakai
frontend LokerMatch, lalu tulis ke frontend/jobs.json.

Ini adalah JEMBATAN antara backend WAT (scraper) dan prototipe frontend.
Tool deterministik — tidak memakai API berbayar.

Usage:
  # otomatis ambil file scraping TERBARU di .tmp/
  python tools/export_jobs_for_frontend.py

  # tentukan file & sumber secara eksplisit
  python tools/export_jobs_for_frontend.py .tmp/jobs_data_analyst_20241201.json --source JobStreet

  # gabungkan beberapa sumber sekaligus
  python tools/export_jobs_for_frontend.py .tmp/jobs_glints.json:Glints .tmp/jobs_js.json:JobStreet

Output:
  frontend/jobs.json   (di-fetch otomatis oleh frontend; fallback ke data mock bila tidak ada)
"""

import re
import sys
import json
import glob
import argparse
import hashlib
from pathlib import Path
from datetime import datetime, date

BASE_DIR = Path(__file__).parent.parent
TMP_DIR = BASE_DIR / ".tmp"
FRONTEND_DIR = BASE_DIR / "frontend"
OUTPUT_FILE = FRONTEND_DIR / "jobs.json"

KNOWN_CITIES = [
    "Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Tangerang", "Bali",
    "Denpasar", "Semarang", "Medan", "Bekasi", "Depok", "Bogor", "Makassar",
    "Malang", "Batam",
]


# ---------------------------------------------------------------------------
# Parser gaji: "Rp 8.000.000 - Rp 12.000.000 per bulan" -> (8000000, 12000000)
# ---------------------------------------------------------------------------
def parse_salary(text):
    if not text:
        return 0, 0
    t = str(text).lower()
    # ambil semua angka (titik/koma sebagai pemisah ribuan dibuang)
    nums = []
    for raw in re.findall(r"\d[\d.,]*", t):
        digits = re.sub(r"[.,]", "", raw)
        if digits.isdigit():
            val = int(digits)
            # normalisasi notasi "jt"/"juta" (mis. "8jt" -> 8.000.000)
            if val < 1000 and ("jt" in t or "juta" in t):
                val *= 1_000_000
            nums.append(val)
    # buang angka yang terlalu kecil untuk gaji bulanan (mis. "per bulan")
    nums = [n for n in nums if n >= 1_000_000]
    if not nums:
        return 0, 0
    if len(nums) == 1:
        return nums[0], nums[0]
    return min(nums), max(nums)


# ---------------------------------------------------------------------------
# Parser tanggal posting: "2 hari lalu" / "kemarin" / ISO -> jumlah hari lalu
# ---------------------------------------------------------------------------
def parse_posted_days(text):
    if not text:
        return 0
    t = str(text).strip().lower()
    if any(k in t for k in ["baru saja", "hari ini", "just posted", "today", "new"]):
        return 0
    if "kemarin" in t or "yesterday" in t:
        return 1
    m = re.search(r"(\d+)\s*(jam|hour|hari|day|minggu|week|bulan|month)", t)
    if m:
        n = int(m.group(1))
        unit = m.group(2)
        if unit in ("jam", "hour"):
            return 0
        if unit in ("hari", "day"):
            return n
        if unit in ("minggu", "week"):
            return n * 7
        if unit in ("bulan", "month"):
            return n * 30
    # coba parse tanggal absolut ISO (YYYY-MM-DD)
    m = re.search(r"(\d{4})-(\d{2})-(\d{2})", t)
    if m:
        try:
            d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            return max((date.today() - d).days, 0)
        except ValueError:
            pass
    return 0


# ---------------------------------------------------------------------------
# Mapping status pekerjaan & level pengalaman
# ---------------------------------------------------------------------------
def map_employment(job_type, tags):
    blob = (str(job_type) + " " + " ".join(tags or [])).lower()
    if "part" in blob or "paruh" in blob:
        return "Part Time"
    if "intern" in blob or "magang" in blob:
        return "Magang"
    if "freelance" in blob or "lepas" in blob:
        return "Freelance"
    if "contract" in blob or "kontrak" in blob:
        return "Kontrak"
    return "Full Time"


def map_level(experience, title):
    blob = (str(experience) + " " + str(title)).lower()
    if "fresh" in blob or "no experience" in blob or "tanpa pengalaman" in blob:
        return "Fresh Graduate"
    if "senior" in blob or "lead" in blob or "principal" in blob or "manager" in blob:
        return "Senior"
    if "junior" in blob:
        return "Junior"
    # heuristik dari angka tahun pengalaman
    m = re.search(r"(\d+)", str(experience))
    if m:
        yrs = int(m.group(1))
        if yrs <= 0:
            return "Fresh Graduate"
        if yrs <= 2:
            return "Junior"
        if yrs >= 5:
            return "Senior"
    return "Mid"


def detect_worktype(location, tags, job_type):
    blob = (str(location) + " " + str(job_type) + " " + " ".join(tags or [])).lower()
    if "remote" in blob or "wfh" in blob or "work from home" in blob:
        return "Remote"
    if "hybrid" in blob:
        return "Hybrid"
    return "Onsite"


def extract_city(location):
    if not location:
        return "Tidak disebutkan"
    loc = str(location)
    for c in KNOWN_CITIES:
        if c.lower() in loc.lower():
            return "Denpasar" if c == "Bali" else c
    # ambil segmen pertama sebelum koma sebagai fallback
    return loc.split(",")[0].strip() or "Tidak disebutkan"


def make_id(source, job):
    seed = f"{source}|{job.get('title','')}|{job.get('company','')}|{job.get('job_url','')}"
    return source[:2].lower() + hashlib.md5(seed.encode("utf-8")).hexdigest()[:8]


def normalize_job(job, source):
    tags = job.get("tags") or []
    # skills: prioritaskan field skills (detail) -> requirements -> tags
    skills = job.get("skills") or job.get("requirements") or tags or []
    skills = [str(s).strip() for s in skills if str(s).strip()][:12]

    sal_min, sal_max = parse_salary(job.get("salary"))
    description = job.get("description") or job.get("title") or ""

    return {
        "id": make_id(source, job),
        "title": (job.get("title") or "Tanpa Judul").strip(),
        "company": (job.get("company") or "Tidak disebutkan").strip(),
        "city": extract_city(job.get("location")),
        "workType": detect_worktype(job.get("location"), tags, job.get("job_type")),
        "employment": map_employment(job.get("job_type"), tags),
        "level": map_level(job.get("experience_required"), job.get("title")),
        "industry": (job.get("industry") or "—"),
        "companySize": (job.get("company_size") or "—"),
        "salaryMin": sal_min,
        "salaryMax": sal_max,
        "source": source,
        "postedDaysAgo": parse_posted_days(job.get("posted_date")),
        "skills": skills,
        "url": job.get("job_url") or "#",
        "description": str(description)[:400],
    }


def infer_source(filename, fallback="JobStreet"):
    name = Path(filename).name.lower()
    for src in ["glints", "jobstreet", "loker", "linkedin"]:
        if src in name:
            return {"glints": "Glints", "jobstreet": "JobStreet",
                    "loker": "Loker.id", "linkedin": "LinkedIn"}[src]
    return fallback


def load_input_specs(args):
    """Kembalikan list (path, source). Mendukung sintaks file:Source."""
    specs = []
    if args.files:
        for item in args.files:
            if ":" in item and not item[1:3] == ":\\":  # hindari salah parse path Windows
                path, _, src = item.rpartition(":")
                specs.append((path, src or args.source))
            else:
                specs.append((item, args.source or infer_source(item)))
    else:
        # otomatis: ambil file scraping terbaru di .tmp/
        candidates = sorted(glob.glob(str(TMP_DIR / "jobs_*.json")),
                            key=lambda p: Path(p).stat().st_mtime, reverse=True)
        if not candidates:
            print(f"ERROR: Tidak ada file .tmp/jobs_*.json. Jalankan scraper dulu, "
                  f"atau berikan path file secara eksplisit.")
            sys.exit(1)
        latest = candidates[0]
        specs.append((latest, args.source or infer_source(latest)))
        print(f"Memakai file scraping terbaru: {latest}")
    return specs


def main():
    parser = argparse.ArgumentParser(
        description="Normalisasi hasil scraping ke frontend/jobs.json",
        formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("files", nargs="*",
                        help="Path file JSON hasil scraping. Format opsional 'path:Sumber'. "
                             "Kosong = ambil file terbaru di .tmp/")
    parser.add_argument("--source", default=None,
                        help="Nama sumber default (Glints/JobStreet/Loker.id/LinkedIn)")
    args = parser.parse_args()

    specs = load_input_specs(args)

    all_jobs = []
    for path, source in specs:
        p = Path(path)
        if not p.exists():
            print(f"  Lewati (tidak ditemukan): {path}")
            continue
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
        raw_jobs = data.get("jobs", data if isinstance(data, list) else [])
        normalized = [normalize_job(j, source) for j in raw_jobs]
        all_jobs.extend(normalized)
        print(f"  {source:10s} <- {p.name}: {len(normalized)} lowongan")

    # buang duplikat berdasarkan id
    seen, deduped = set(), []
    for j in all_jobs:
        if j["id"] not in seen:
            seen.add(j["id"])
            deduped.append(j)

    FRONTEND_DIR.mkdir(exist_ok=True)
    payload = {
        "generatedAt": datetime.now().isoformat(),
        "total": len(deduped),
        "sources": sorted({j["source"] for j in deduped}),
        "jobs": deduped,
    }
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\nSelesai! {len(deduped)} lowongan ditulis ke {OUTPUT_FILE}")
    print("Buka frontend (lewat http server) untuk melihat data live.")


if __name__ == "__main__":
    main()
