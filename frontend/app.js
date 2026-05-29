/*
 * app.js — Logika prototipe LokerMatch (frontend only).
 *
 * Alur sistem:
 *   1) User mengisi Brief CV (Step 1)        -> state.cv
 *   2) User mengisi Kriteria Pencarian (Step 2) -> state.filters
 *   3) Klik "Cari Lowongan" -> rakit prompt akhir + hitung match score + tampilkan tabel (Step 3)
 *   4) Header kolom bisa diklik untuk sorting (asc/desc bergantian)
 *
 * Tidak ada backend: data berasal dari MOCK_JOBS (data.js). Fungsi searchJobs()
 * mensimulasikan "scraping + ranking" yang nanti akan dilayani backend WAT.
 */

// ============================================================
//  STATE GLOBAL
// ============================================================
const state = {
  cv: null,            // brief CV hasil Step 1
  filters: null,       // kriteria Step 2
  results: [],         // hasil pencarian (sudah diberi matchScore)
  allJobs: [],         // dataset aktif (live dari jobs.json, atau mock)
  dataSource: "mock",  // "live" | "mock"
  sortKey: "matchScore",
  sortDir: "desc",     // "asc" | "desc"
};

// Daftar "stopword" sederhana agar tokenisasi keyword lebih bersih.
const STOPWORDS = new Set(["dan","yang","untuk","dengan","di","ke","dari","the","and","for","with","a","an","of","in","on","to","atau","or"]);

// ============================================================
//  UTIL
// ============================================================
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s/]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function formatRupiah(n) {
  if (!n) return "—";
  return "Rp " + n.toLocaleString("id-ID");
}

function salaryLabel(job) {
  if (!job.salaryMin && !job.salaryMax) return "Tidak disebutkan";
  return `${formatRupiah(job.salaryMin)} – ${formatRupiah(job.salaryMax)}`;
}

function timeAgo(days) {
  if (days === 0) return "Hari ini";
  if (days === 1) return "1 hari lalu";
  if (days < 7) return `${days} hari lalu`;
  if (days < 30) return `${Math.floor(days / 7)} minggu lalu`;
  return `${Math.floor(days / 30)} bulan lalu`;
}

// ============================================================
//  MATCH SCORE — inti "kecerdasan" prototipe
// ============================================================
/*
 * Skor 0–100 yang mengukur kesesuaian sebuah lowongan terhadap:
 *   - keyword Job Description yang diincar user
 *   - skill di Brief CV user
 *   - target role di CV
 *   - bonus kecocokan filter (level, tipe kerja, lokasi, gaji)
 *
 * Bobot:
 *   55%  relevansi konten (overlap keyword JD + skill CV terhadap title/skills/desc job)
 *   15%  kecocokan level pengalaman
 *   10%  kecocokan tipe kerja (onsite/remote/hybrid)
 *   10%  kecocokan lokasi kota
 *   10%  gaji memenuhi ekspektasi minimum
 */
function computeMatchScore(job, cv, filters) {
  // --- kumpulkan sinyal dari user ---
  const userTokens = new Set([
    ...tokenize(filters.jobDescription),
    ...tokenize(cv?.targetRole),
    ...(cv?.skills || []).flatMap((s) => tokenize(s)),
  ]);

  // --- kumpulkan sinyal dari lowongan ---
  const jobTokens = new Set([
    ...tokenize(job.title),
    ...job.skills.flatMap((s) => tokenize(s)),
    ...tokenize(job.description),
  ]);

  // 1) Relevansi konten (Jaccard-like, dinormalisasi terhadap input user)
  let overlap = 0;
  userTokens.forEach((t) => { if (jobTokens.has(t)) overlap++; });
  const denom = Math.max(userTokens.size, 1);
  const contentScore = Math.min(overlap / denom, 1) * 55;

  // 2) Level pengalaman
  let levelScore = 7; // netral bila user tidak memilih
  if (filters.level) levelScore = job.level === filters.level ? 15 : 0;

  // 3) Tipe kerja
  let workScore = 5;
  if (filters.workType) workScore = job.workType === filters.workType ? 10 : 0;

  // 4) Lokasi
  let locScore = 5;
  if (filters.city) locScore = (job.city === filters.city || job.workType === "Remote") ? 10 : 0;

  // 5) Gaji
  let salScore = 5;
  if (filters.salaryMin) {
    const jobTop = job.salaryMax || job.salaryMin || 0;
    salScore = jobTop >= filters.salaryMin ? 10 : 0;
  }

  const total = contentScore + levelScore + workScore + locScore + salScore;
  return Math.round(Math.min(total, 100));
}

// ============================================================
//  PENCARIAN — mensimulasikan scraping + filtering + ranking
// ============================================================
function searchJobs(cv, filters) {
  return state.allJobs
    // Hard filter: hanya sumber yang dipilih user
    .filter((j) => filters.sources.includes(j.source))
    // Hard filter: status pekerjaan (jika dipilih)
    .filter((j) => !filters.employment || j.employment === filters.employment)
    // Hard filter: tanggal posting maksimal
    .filter((j) => !filters.maxDays || j.postedDaysAgo <= filters.maxDays)
    // Beri skor
    .map((j) => ({ ...j, matchScore: computeMatchScore(j, cv, filters) }))
    // Buang yang relevansinya nyaris nol agar hasil tetap berkualitas
    .filter((j) => j.matchScore > 5);
}

// ============================================================
//  PROMPT AKHIR — preview apa yang "dikirim ke engine"
// ============================================================
function buildFinalPrompt(cv, filters) {
  const parts = [];
  parts.push(`Cari lowongan kerja "${filters.jobDescription || "(belum diisi)"}"`);
  if (filters.city) parts.push(`di ${filters.city}`);
  if (filters.workType) parts.push(`(${filters.workType})`);
  if (filters.employment) parts.push(`status ${filters.employment}`);
  if (filters.level) parts.push(`level ${filters.level}`);
  if (filters.salaryMin) parts.push(`gaji minimal ${formatRupiah(filters.salaryMin)}/bulan`);
  if (filters.maxDays) parts.push(`diposting dalam ${filters.maxDays} hari terakhir`);

  let prompt = parts.join(", ") + ".";
  prompt += `\nSumber: ${filters.sources.join(", ")}.`;
  if (cv) {
    prompt += `\n\nProfil kandidat: ${cv.fullName || "(anonim)"}`;
    if (cv.targetRole) prompt += ` — target posisi "${cv.targetRole}"`;
    if (cv.yearsExp) prompt += `, ${cv.yearsExp} thn pengalaman`;
    if (cv.skills?.length) prompt += `.\nKeahlian: ${cv.skills.join(", ")}`;
    if (cv.summary) prompt += `.\nRingkasan: ${cv.summary}`;
  }
  prompt += `\n\nUrutkan berdasarkan tingkat kesesuaian dengan profil & keyword di atas.`;
  return prompt;
}

// ============================================================
//  RENDER STEP NAVIGATION
// ============================================================
function goToStep(n) {
  $$(".step-panel").forEach((p) => p.classList.toggle("active", Number(p.dataset.step) === n));
  $$(".stepper-item").forEach((s) => {
    const sn = Number(s.dataset.step);
    s.classList.toggle("active", sn === n);
    s.classList.toggle("done", sn < n);
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ============================================================
//  STEP 1 — BRIEF CV
// ============================================================
function readCvForm() {
  const skillsRaw = $("#cv-skills").value;
  return {
    fullName: $("#cv-name").value.trim(),
    targetRole: $("#cv-role").value.trim(),
    yearsExp: $("#cv-years").value.trim(),
    summary: $("#cv-summary").value.trim(),
    skills: skillsRaw.split(",").map((s) => s.trim()).filter(Boolean),
  };
}

function handleCvSubmit(e) {
  e.preventDefault();
  const cv = readCvForm();
  if (!cv.targetRole && cv.skills.length === 0) {
    alert("Isi minimal Target Posisi atau Keahlian agar AI bisa menilai kesesuaian lowongan.");
    return;
  }
  state.cv = cv;
  // tampilkan ringkasan CV di step 2
  $("#cv-recap").innerHTML = `
    <strong>${cv.fullName || "Kandidat"}</strong> · target: <em>${cv.targetRole || "—"}</em>
    ${cv.yearsExp ? "· " + cv.yearsExp + " thn" : ""}
    <br><span class="muted">Skill: ${cv.skills.join(", ") || "—"}</span>`;
  goToStep(2);
}

// ============================================================
//  STEP 2 — KRITERIA PENCARIAN
// ============================================================
function readFiltersForm() {
  const sources = $$('input[name="source"]:checked').map((c) => c.value);
  return {
    jobDescription: $("#f-jd").value.trim(),
    city: $("#f-city").value,
    workType: $("#f-worktype").value,
    employment: $("#f-employment").value,
    level: $("#f-level").value,
    salaryMin: Number($("#f-salary").value) || 0,
    maxDays: Number($("#f-postdate").value) || 0,
    sources: sources.length ? sources : ["Glints", "JobStreet", "Loker.id", "LinkedIn"],
  };
}

function updatePromptPreview() {
  const filters = readFiltersForm();
  $("#prompt-preview").textContent = buildFinalPrompt(state.cv, filters);
}

function handleSearchSubmit(e) {
  e.preventDefault();
  const filters = readFiltersForm();
  if (!filters.jobDescription) {
    alert("Masukkan Job Description / posisi yang diincar terlebih dahulu.");
    return;
  }
  if (filters.sources.length === 0) {
    alert("Pilih minimal satu sumber website.");
    return;
  }
  state.filters = filters;
  state.results = searchJobs(state.cv, filters);
  state.sortKey = "matchScore";
  state.sortDir = "desc";
  renderResults();
  goToStep(3);
}

// ============================================================
//  STEP 3 — TABEL HASIL + SORTING
// ============================================================
const COLUMNS = [
  { key: "matchScore", label: "Match", type: "num" },
  { key: "title", label: "Posisi", type: "str" },
  { key: "company", label: "Perusahaan", type: "str" },
  { key: "city", label: "Lokasi", type: "str" },
  { key: "employment", label: "Status", type: "str" },
  { key: "salaryMax", label: "Gaji", type: "num" },
  { key: "postedDate", label: "Tgl Posting", type: "date" },
  { key: "source", label: "Sumber", type: "str" },
];

function sortResults() {
  const { sortKey, sortDir } = state;
  const dir = sortDir === "asc" ? 1 : -1;
  const col = COLUMNS.find((c) => c.key === sortKey);
  state.results.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (col.type === "str") { av = (av || "").toLowerCase(); bv = (bv || "").toLowerCase(); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0; }
    if (col.type === "date") { return (av.getTime() - bv.getTime()) * dir; }
    return ((av || 0) - (bv || 0)) * dir; // num
  });
}

function onHeaderClick(key) {
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.sortKey = key;
    // default arah: angka/tanggal turun (besar→kecil), teks naik (A→Z)
    const col = COLUMNS.find((c) => c.key === key);
    state.sortDir = col.type === "str" ? "asc" : "desc";
  }
  renderResults();
}

function matchBadge(score) {
  let cls = "low";
  if (score >= 70) cls = "high";
  else if (score >= 45) cls = "mid";
  return `<div class="match-cell">
      <span class="match-num ${cls}">${score}%</span>
      <span class="match-bar"><span class="match-fill ${cls}" style="width:${score}%"></span></span>
    </div>`;
}

function renderResults() {
  sortResults();

  // header
  const thead = $("#results-head");
  thead.innerHTML = "<tr>" + COLUMNS.map((c) => {
    const isActive = state.sortKey === c.key;
    const arrow = isActive ? (state.sortDir === "asc" ? " ▲" : " ▼") : " ⇅";
    return `<th data-key="${c.key}" class="${isActive ? "sorted" : ""}">${c.label}<span class="arrow">${arrow}</span></th>`;
  }).join("") + "<th>Aksi</th></tr>";

  $$("#results-head th[data-key]").forEach((th) =>
    th.addEventListener("click", () => onHeaderClick(th.dataset.key))
  );

  // body
  const tbody = $("#results-body");
  if (state.results.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">Tidak ada lowongan yang cocok. Coba longgarkan filter atau ubah keyword.</td></tr>`;
  } else {
    tbody.innerHTML = state.results.map((j) => `
      <tr>
        <td>${matchBadge(j.matchScore)}</td>
        <td><div class="job-title">${j.title}</div><div class="muted small">${j.level} · ${j.workType}</div></td>
        <td>${j.company}<div class="muted small">${j.industry} · ${j.companySize}</div></td>
        <td>${j.city}</td>
        <td><span class="tag">${j.employment}</span></td>
        <td>${salaryLabel(j)}</td>
        <td>${timeAgo(j.postedDaysAgo)}<div class="muted small">${j.postedDate.toLocaleDateString("id-ID")}</div></td>
        <td><span class="source source-${j.source.replace(/[^a-z]/gi, "").toLowerCase()}">${j.source}</span></td>
        <td><a class="btn-link" href="${j.url}" target="_blank" rel="noopener">Lihat ↗</a></td>
      </tr>`).join("");
  }

  // ringkasan
  $("#results-summary").innerHTML =
    `Menemukan <strong>${state.results.length}</strong> lowongan untuk
     "<strong>${state.filters.jobDescription}</strong>" ·
     diurutkan berdasarkan <strong>${COLUMNS.find((c) => c.key === state.sortKey).label}</strong>
     (${state.sortDir === "asc" ? "naik" : "turun"})`;

  $("#final-prompt-result").textContent = buildFinalPrompt(state.cv, state.filters);
}

// ============================================================
//  PEMUATAN DATA — live (jobs.json dari adapter WAT) atau fallback mock
// ============================================================
// Pastikan tiap lowongan punya objek Date `postedDate` untuk sorting/tampilan.
function hydrate(jobs) {
  jobs.forEach((j) => {
    if (!(j.postedDate instanceof Date)) {
      const d = new Date();
      d.setDate(d.getDate() - (j.postedDaysAgo || 0));
      j.postedDate = d;
    }
  });
  return jobs;
}

async function loadJobs() {
  // Coba ambil data live yang dihasilkan tools/export_jobs_for_frontend.py.
  try {
    const res = await fetch("jobs.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const jobs = Array.isArray(data) ? data : data.jobs;
      if (jobs && jobs.length) {
        state.dataSource = "live";
        return hydrate(jobs);
      }
    }
  } catch (e) {
    // file:// atau jobs.json tidak ada -> pakai mock. Ini normal untuk demo.
  }
  state.dataSource = "mock";
  return hydrate(MOCK_JOBS);
}

function renderDataSourceBadge() {
  const el = $("#data-source");
  if (!el) return;
  if (state.dataSource === "live") {
    el.innerHTML = `<span class="ds live">● DATA LIVE</span> ${state.allJobs.length} lowongan dari scraper`;
  } else {
    el.innerHTML = `<span class="ds mock">● DATA SIMULASI</span> ${state.allJobs.length} lowongan contoh — jalankan <code>tools/export_jobs_for_frontend.py</code> untuk data live`;
  }
}

// ============================================================
//  INIT
// ============================================================
async function init() {
  state.allJobs = await loadJobs();
  renderDataSourceBadge();

  // isi dropdown kota
  const citySel = $("#f-city");
  [...new Set(state.allJobs.map((j) => j.city))].sort().forEach((c) => {
    const o = document.createElement("option"); o.value = c; o.textContent = c; citySel.appendChild(o);
  });

  $("#cv-form").addEventListener("submit", handleCvSubmit);
  $("#search-form").addEventListener("submit", handleSearchSubmit);
  $("#btn-skip-cv").addEventListener("click", () => { state.cv = null; goToStep(2); });
  $("#btn-back-1").addEventListener("click", () => goToStep(1));
  $("#btn-back-2").addEventListener("click", () => goToStep(2));
  $("#btn-new-search").addEventListener("click", () => goToStep(2));

  // update preview prompt setiap kali filter berubah
  $("#search-form").addEventListener("input", updatePromptPreview);
  $("#search-form").addEventListener("change", updatePromptPreview);

  // klik item stepper untuk navigasi mundur
  $$(".stepper-item").forEach((s) =>
    s.addEventListener("click", () => {
      const n = Number(s.dataset.step);
      if (n === 1) goToStep(1);
      if (n === 2 && (state.cv !== undefined)) goToStep(2);
      if (n === 3 && state.results.length) goToStep(3);
    })
  );

  updatePromptPreview();
}

document.addEventListener("DOMContentLoaded", init);
