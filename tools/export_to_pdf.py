#!/usr/bin/env python3
"""
Export hasil scraping JobStreet ke file PDF.

Usage:
  python tools/export_to_pdf.py .tmp/jobs_IT_Manager_20241201.json

Output:
  results/JobStreet_<keyword>_<tanggal>.pdf
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()

BASE_DIR    = Path(__file__).parent.parent
RESULTS_DIR = BASE_DIR / "results"
RESULTS_DIR.mkdir(exist_ok=True)


def safe_text(text) -> str:
    if not text:
        return ""
    return str(text)


def fmt_list(items, bullet="- ") -> str:
    if not items:
        return ""
    if isinstance(items, list):
        return "\n".join(f"{bullet}{safe_text(i)}" for i in items if i)
    return safe_text(str(items))


class JobPDF:
    FONT = "Arial"
    FONT_PATH = {
        "": "C:/Windows/Fonts/arial.ttf",
        "B": "C:/Windows/Fonts/arialbd.ttf",
        "I": "C:/Windows/Fonts/ariali.ttf",
        "BI": "C:/Windows/Fonts/arialbi.ttf",
    }

    def __init__(self):
        from fpdf import FPDF

        font = self.FONT
        font_path = self.FONT_PATH

        class PDF(FPDF):
            def header(self):
                pass
            def footer(self):
                self.set_y(-12)
                self.set_font(font, "I", 8)
                self.set_text_color(150, 150, 150)
                self.cell(0, 10, f"Halaman {self.page_no()}", align="C")

        self.pdf = PDF(orientation="P", unit="mm", format="A4")
        self.pdf.set_auto_page_break(auto=True, margin=15)
        self.pdf.set_margins(15, 15, 15)

        # Daftarkan Arial TTF untuk full Unicode support
        for style, path in font_path.items():
            self.pdf.add_font(font, style, path)

    # ── warna ──────────────────────────────────────────────
    C_PRIMARY   = (31, 107, 168)   # biru JobStreet
    C_DARK      = (30, 30, 30)
    C_GREY      = (100, 100, 100)
    C_LIGHTGREY = (240, 240, 240)
    C_WHITE     = (255, 255, 255)
    C_GREEN     = (39, 174, 96)

    def _set_color(self, rgb, fill=False):
        r, g, b = rgb
        if fill:
            self.pdf.set_fill_color(r, g, b)
        else:
            self.pdf.set_text_color(r, g, b)

    # ── cover page ─────────────────────────────────────────
    def add_cover(self, keyword: str, total: int, scraped_at: str, has_detail: bool):
        p = self.pdf
        p.add_page()

        # Header bar
        self._set_color(self.C_PRIMARY, fill=True)
        p.rect(0, 0, 210, 50, "F")

        p.set_font("Arial", "B", 24)
        self._set_color(self.C_WHITE)
        p.set_xy(15, 12)
        p.cell(180, 12, "Hasil Pencarian Lowongan Kerja", align="C")

        p.set_font("Arial", "", 13)
        p.set_xy(15, 28)
        p.cell(180, 10, "JobStreet Indonesia", align="C")

        # Info box
        self._set_color(self.C_LIGHTGREY, fill=True)
        p.rect(15, 60, 180, 70, "F")

        self._set_color(self.C_DARK)
        p.set_font("Arial", "B", 14)
        p.set_xy(20, 68)
        p.cell(170, 8, f'Keyword: "{keyword}"')

        p.set_font("Arial", "", 12)
        p.set_xy(20, 82)
        p.cell(85, 8, f"Total Lowongan: {total}")
        p.set_xy(105, 82)
        p.cell(85, 8, f"Data Detail: {'Ya' if has_detail else 'Tidak'}")

        p.set_xy(20, 96)
        try:
            dt = datetime.fromisoformat(scraped_at)
            date_str = dt.strftime("%d %B %Y, %H:%M WIB")
        except Exception:
            date_str = scraped_at
        p.cell(170, 8, f"Tanggal Pencarian: {date_str}")

        p.set_xy(20, 110)
        self._set_color(self.C_GREY)
        p.set_font("Arial", "I", 10)
        p.cell(170, 8, "Sumber: id.jobstreet.com  |  Tool: WAT Framework")

        # Footer note
        self._set_color(self.C_DARK)
        p.set_font("Arial", "", 10)
        p.set_xy(15, 220)
        p.multi_cell(180, 6,
            "Dokumen ini berisi daftar lowongan pekerjaan yang sesuai dengan keyword pencarian. "
            "Setiap lowongan mencantumkan informasi posisi, perusahaan, lokasi, gaji (jika tersedia), "
            "dan deskripsi pekerjaan."
        )

    # ── satu kartu lowongan ────────────────────────────────
    def add_job(self, index: int, job: dict):
        p = self.pdf

        title   = safe_text(job.get("title", "Judul tidak tersedia"))
        company = safe_text(job.get("company", ""))
        loc     = safe_text(job.get("location", ""))
        salary  = safe_text(job.get("salary", ""))
        jtype   = safe_text(job.get("job_type", ""))
        url     = safe_text(job.get("job_url") or job.get("url", ""))
        posted  = safe_text(job.get("posted_date", ""))
        desc    = safe_text(job.get("description") or job.get("brief_description", ""))
        reqs    = fmt_list(job.get("requirements"))
        skills  = fmt_list(job.get("skills") or job.get("tags", []))

        # Nomor + judul (header kartu)
        self._set_color(self.C_PRIMARY, fill=True)
        p.set_fill_color(*self.C_PRIMARY)
        p.set_font("Arial", "B", 11)
        self._set_color(self.C_WHITE)
        p.cell(0, 8, f"  {index}. {title}", fill=True, new_x="LMARGIN", new_y="NEXT")

        # Info baris: perusahaan | lokasi | gaji
        p.set_font("Arial", "B", 10)
        self._set_color(self.C_DARK)
        meta_parts = []
        if company: meta_parts.append(company)
        if loc:     meta_parts.append(f"Lokasi: {loc}")
        if salary:  meta_parts.append(f"Gaji: {salary}")
        if jtype:   meta_parts.append(f"[{jtype}]")
        p.cell(0, 6, "  " + "  |  ".join(meta_parts), new_x="LMARGIN", new_y="NEXT")

        # Tanggal & URL
        if posted or url:
            p.set_font("Arial", "I", 9)
            self._set_color(self.C_GREY)
            line = ""
            if posted: line += f"Diposting: {posted}"
            if url:    line += ("   " if posted else "") + f"URL: {url[:80]}{'...' if len(url) > 80 else ''}"
            p.cell(0, 5, "  " + line, new_x="LMARGIN", new_y="NEXT")

        # Deskripsi
        if desc:
            p.set_font("Arial", "", 9)
            self._set_color(self.C_DARK)
            p.set_x(15)
            max_desc = desc[:600] + ("..." if len(desc) > 600 else "")
            p.multi_cell(0, 5, max_desc)

        # Persyaratan
        if reqs:
            p.set_font("Arial", "B", 9)
            self._set_color(self.C_PRIMARY)
            p.cell(0, 5, "  Persyaratan:", new_x="LMARGIN", new_y="NEXT")
            p.set_font("Arial", "", 9)
            self._set_color(self.C_DARK)
            p.set_x(15)
            max_reqs = reqs[:400] + ("..." if len(reqs) > 400 else "")
            p.multi_cell(0, 5, max_reqs)

        # Skills
        if skills:
            p.set_font("Arial", "B", 9)
            self._set_color(self.C_PRIMARY)
            p.cell(0, 5, "  Skills:", new_x="LMARGIN", new_y="NEXT")
            p.set_font("Arial", "", 9)
            self._set_color(self.C_DARK)
            p.set_x(15)
            p.multi_cell(0, 5, skills[:300])

        # Garis pemisah
        p.set_draw_color(200, 200, 200)
        p.ln(2)
        p.line(15, p.get_y(), 195, p.get_y())
        p.ln(4)

    # ── halaman ringkasan ──────────────────────────────────
    def add_summary_page(self, jobs: list, keyword: str):
        p = self.pdf
        p.add_page()

        self._set_color(self.C_PRIMARY, fill=True)
        p.rect(0, 0, 210, 20, "F")
        p.set_font("Arial", "B", 14)
        self._set_color(self.C_WHITE)
        p.set_xy(15, 5)
        p.cell(180, 10, f"Daftar Ringkas — {len(jobs)} Lowongan")

        p.ln(25)
        # Header tabel
        col_w = [10, 65, 55, 30, 30]
        headers = ["No", "Judul", "Perusahaan", "Lokasi", "Gaji"]
        self._set_color(self.C_PRIMARY, fill=True)
        p.set_font("Arial", "B", 9)
        self._set_color(self.C_WHITE)
        for w, h in zip(col_w, headers):
            p.cell(w, 7, h, border=0, fill=True, align="C")
        p.ln()

        p.set_font("Arial", "", 8)
        for i, job in enumerate(jobs):
            fill = (i % 2 == 0)
            if fill:
                p.set_fill_color(*self.C_LIGHTGREY)
            self._set_color(self.C_DARK)
            row = [
                str(i + 1),
                safe_text(job.get("title", ""))[:35],
                safe_text(job.get("company", ""))[:30],
                safe_text(job.get("location", ""))[:18],
                safe_text(job.get("salary", ""))[:18],
            ]
            for w, cell in zip(col_w, row):
                p.cell(w, 6, cell, border=0, fill=fill)
            p.ln()

    def save(self, output_path: Path):
        self.pdf.output(str(output_path))


def main():
    parser = argparse.ArgumentParser(
        description="Export hasil scraping JobStreet ke PDF"
    )
    parser.add_argument("jobs_file", help="Path ke file JSON hasil scrape_jobstreet.py")
    parser.add_argument("--max", type=int, default=50, help="Maks lowongan di PDF (default: 50)")
    args = parser.parse_args()

    try:
        from fpdf import FPDF
    except ImportError:
        print("ERROR: fpdf2 belum terinstall. Jalankan: pip install fpdf2")
        sys.exit(1)

    jobs_path = Path(args.jobs_file)
    if not jobs_path.exists():
        print(f"ERROR: File tidak ditemukan: {jobs_path}")
        sys.exit(1)

    with open(jobs_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    keyword    = raw.get("keyword", "unknown") if isinstance(raw, dict) else "unknown"
    scraped_at = raw.get("scraped_at", datetime.now().isoformat()) if isinstance(raw, dict) else datetime.now().isoformat()
    has_detail = raw.get("has_detail", False) if isinstance(raw, dict) else False
    jobs       = raw.get("jobs", raw) if isinstance(raw, dict) else raw
    jobs       = jobs[:args.max]

    try:
        date_str = datetime.fromisoformat(scraped_at).strftime("%Y%m%d")
    except Exception:
        date_str = datetime.now().strftime("%Y%m%d")

    safe_kw     = keyword.replace(" ", "_").replace("/", "-")
    output_file = RESULTS_DIR / f"JobStreet_{safe_kw}_{date_str}.pdf"

    print(f"Membuat PDF untuk {len(jobs)} lowongan keyword: '{keyword}'")
    print("-" * 60)

    doc = JobPDF()
    doc.add_cover(keyword, len(jobs), scraped_at, has_detail)
    doc.add_summary_page(jobs, keyword)

    doc.pdf.add_page()
    # Header halaman detail
    doc.pdf.set_fill_color(*JobPDF.C_PRIMARY)
    doc.pdf.rect(0, 0, 210, 20, "F")
    doc.pdf.set_font("Arial", "B", 14)
    doc.pdf.set_text_color(*JobPDF.C_WHITE)
    doc.pdf.set_xy(15, 5)
    doc.pdf.cell(180, 10, "Detail Setiap Lowongan")
    doc.pdf.ln(25)

    for i, job in enumerate(jobs, 1):
        title = job.get("title", "?")
        company = job.get("company", "?")
        print(f"  [{i}/{len(jobs)}] {title} @ {company}")
        doc.add_job(i, job)

    doc.save(output_file)
    print(f"\nSelesai! PDF disimpan di:\n{output_file}")
    print(str(output_file))


if __name__ == "__main__":
    main()
