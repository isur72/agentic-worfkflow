#!/usr/bin/env python3
import sys
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
URL_FILE  = BASE_DIR / "auth_url.txt"
LOG_FILE  = BASE_DIR / "auth_log.txt"

LOG_FILE.write_text("", encoding="utf-8")  # reset log

def log(msg):
    print(msg, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")

log("Step 1: dimulai")

from google_auth_oauthlib.flow import InstalledAppFlow
log("Step 2: library imported")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive"
]

# Patch webbrowser.get() karena library memanggil webbrowser.get(browser).open(url)
class _UrlCapture:
    def open(self, url, new=0, autoraise=True):
        URL_FILE.write_text(url, encoding="utf-8")
        log(f"Step 4: URL berhasil dicapture:\n{url}")
        return True
    def open_new(self, url):
        return self.open(url)
    def open_new_tab(self, url):
        return self.open(url)

webbrowser.get = lambda using=None: _UrlCapture()
log("Step 3: webbrowser.get di-patch")

try:
    flow = InstalledAppFlow.from_client_secrets_file(
        str(BASE_DIR / "credentials.json"), SCOPES
    )
    log("Step 4: flow dibuat")
    log("Step 5: memulai server di port 9876 dan menunggu callback...")

    creds = flow.run_local_server(port=9876, open_browser=True)

    log("Step 6: OAuth sukses! Menyimpan token.json...")
    (BASE_DIR / "token.json").write_text(creds.to_json(), encoding="utf-8")
    log("Step 7: SELESAI.")

except Exception as e:
    import traceback
    log(f"ERROR: {type(e).__name__}: {e}")
    log(traceback.format_exc())
    sys.exit(1)
