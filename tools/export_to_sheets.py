#!/usr/bin/env python3
"""
Export hasil scraping JobStreet ke Google Sheets.

Usage:
  python tools/export_to_sheets.py .tmp/jobs_IT_Manager_20241201.json

Output:
  Tab baru di Google Sheets dengan nama: "JobStreet - <keyword> - <tanggal>"
  Kolom: No | Tanggal | Keyword | Judul | Perusahaan | Lokasi | Gaji | Tipe | URL | Deskripsi | Skills | Tags
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).parent.parent
SHEETS_ID = os.getenv("GOOGLE_SHEETS_ID")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

HEADER = [
    "No", "Tanggal Scraping", "Keyword", "Judul Posisi", "Perusahaan",
    "Lokasi", "Gaji", "Tipe Pekerjaan", "Tanggal Posting", "URL",
    "Deskripsi", "Persyaratan", "Skills", "Tags"
]

HEADER_COLOR = {"red": 0.13, "green": 0.42, "blue": 0.66}


def get_credentials():
    """Load OAuth2 credentials dari token.json."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    token_path = BASE_DIR / "token.json"

    if not token_path.exists():
        print("ERROR: token.json tidak ditemukan.")
        print("Jalankan dulu: python tools/auth_google.py")
        sys.exit(1)

    creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        token_path.write_text(creds.to_json(), encoding="utf-8")

    return creds


def fmt_list(items) -> str:
    if not items:
        return ""
    if isinstance(items, list):
        return "\n".join(f"• {i}" for i in items if i)
    return str(items)


def job_to_row(i: int, job: dict, keyword: str, scraped_at: str) -> list:
    return [
        i,
        scraped_at,
        keyword,
        job.get("title", ""),
        job.get("company", ""),
        job.get("location", ""),
        job.get("salary", ""),
        job.get("job_type", ""),
        job.get("posted_date", ""),
        job.get("job_url", ""),
        job.get("description") or job.get("brief_description", ""),
        fmt_list(job.get("requirements")),
        fmt_list(job.get("skills")) or ", ".join(job.get("tags", [])),
        ", ".join(job.get("tags", []))
    ]


def apply_formatting(service, spreadsheet_id: str, sheet_id: int, num_rows: int):
    """Apply header formatting and freeze top row."""
    requests = [
        # Bold & color header row
        {
            "repeatCell": {
                "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1},
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": HEADER_COLOR,
                        "textFormat": {"bold": True, "foregroundColor": {"red": 1, "green": 1, "blue": 1}},
                        "horizontalAlignment": "CENTER",
                        "verticalAlignment": "MIDDLE",
                        "wrapStrategy": "CLIP"
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)"
            }
        },
        # Freeze header row
        {
            "updateSheetProperties": {
                "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
                "fields": "gridProperties.frozenRowCount"
            }
        },
        # Wrap text for description/requirements columns
        {
            "repeatCell": {
                "range": {"sheetId": sheet_id, "startRowIndex": 1, "endRowIndex": num_rows + 1,
                          "startColumnIndex": 10, "endColumnIndex": 14},
                "cell": {"userEnteredFormat": {"wrapStrategy": "WRAP", "verticalAlignment": "TOP"}},
                "fields": "userEnteredFormat(wrapStrategy,verticalAlignment)"
            }
        },
        # Set row height for data rows
        {
            "updateDimensionProperties": {
                "range": {"sheetId": sheet_id, "dimension": "ROWS",
                          "startIndex": 1, "endIndex": num_rows + 1},
                "properties": {"pixelSize": 80},
                "fields": "pixelSize"
            }
        },
        # Auto-resize columns
        {
            "autoResizeDimensions": {
                "dimensions": {"sheetId": sheet_id, "dimension": "COLUMNS",
                               "startIndex": 0, "endIndex": 10}
            }
        }
    ]

    service.spreadsheets().batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"requests": requests}
    ).execute()


def main():
    parser = argparse.ArgumentParser(
        description="Export hasil scraping JobStreet ke Google Sheets"
    )
    parser.add_argument("jobs_file", help="Path ke file JSON hasil scrape_jobstreet.py")
    args = parser.parse_args()

    if not SHEETS_ID:
        print("ERROR: GOOGLE_SHEETS_ID belum diset di .env")
        sys.exit(1)

    jobs_path = Path(args.jobs_file)
    if not jobs_path.exists():
        print(f"ERROR: File tidak ditemukan: {jobs_path}")
        sys.exit(1)

    try:
        import gspread
        from googleapiclient.discovery import build
    except ImportError:
        print("ERROR: Library belum terinstall. Jalankan: pip install -r requirements.txt")
        sys.exit(1)

    print("Menghubungkan ke Google Sheets...")
    creds = get_credentials()

    gc = gspread.authorize(creds)
    service = build("sheets", "v4", credentials=creds)

    with open(jobs_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    keyword    = raw.get("keyword", "unknown") if isinstance(raw, dict) else "unknown"
    scraped_at = raw.get("scraped_at", datetime.now().isoformat()) if isinstance(raw, dict) else datetime.now().isoformat()
    jobs       = raw.get("jobs", raw) if isinstance(raw, dict) else raw

    # Format display date
    try:
        dt = datetime.fromisoformat(scraped_at)
        date_display = dt.strftime("%d %b %Y")
        date_tab     = dt.strftime("%Y%m%d")
    except Exception:
        date_display = datetime.now().strftime("%d %b %Y")
        date_tab     = datetime.now().strftime("%Y%m%d")

    tab_name = f"JobStreet - {keyword} - {date_tab}"[:100]

    spreadsheet = gc.open_by_key(SHEETS_ID)

    # Hapus tab lama dengan nama sama jika ada
    try:
        existing = spreadsheet.worksheet(tab_name)
        spreadsheet.del_worksheet(existing)
        print(f"  Tab lama '{tab_name}' dihapus dan akan dibuat ulang.")
    except gspread.exceptions.WorksheetNotFound:
        pass

    worksheet = spreadsheet.add_worksheet(title=tab_name, rows=len(jobs) + 10, cols=len(HEADER))
    sheet_id  = worksheet.id

    print(f"  Tab baru dibuat: '{tab_name}'")

    # Build rows
    rows = [HEADER]
    for i, job in enumerate(jobs, 1):
        rows.append(job_to_row(i, job, keyword, date_display))

    worksheet.update(rows, value_input_option="USER_ENTERED")
    print(f"  {len(jobs)} baris data ditulis.")

    apply_formatting(service, SHEETS_ID, sheet_id, len(jobs))
    print("  Formatting diterapkan.")

    sheet_url = f"https://docs.google.com/spreadsheets/d/{SHEETS_ID}/edit#gid={sheet_id}"
    print(f"\nSelesai! Buka Google Sheets:")
    print(sheet_url)


if __name__ == "__main__":
    main()
