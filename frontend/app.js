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
  page: 1,
  pageSize: 8,
  savedIds: new Set(), // id lowongan yang disimpan (localStorage)
  resultFilter: { text: "", minMatch: 0, savedOnly: false },
};

// Kunci localStorage untuk persistensi ringan (CV & lowongan tersimpan).
const LS_CV = "lokermatch_cv";
const LS_SAVED = "lokermatch_saved";

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
function computeMatchBreakdown(job, cv, filters) {
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
  const matched = [];
  userTokens.forEach((t) => { if (jobTokens.has(t)) matched.push(t); });
  const denom = Math.max(userTokens.size, 1);
  const content = Math.min(matched.length / denom, 1) * 55;

  // 2) Level pengalaman
  let level = 7; // netral bila user tidak memilih
  if (filters.level) level = job.level === filters.level ? 15 : 0;

  // 3) Tipe kerja
  let workType = 5;
  if (filters.workType) workType = job.workType === filters.workType ? 10 : 0;

  // 4) Lokasi
  let city = 5;
  if (filters.city) city = (job.city === filters.city || job.workType === "Remote") ? 10 : 0;

  // 5) Gaji
  let salary = 5;
  if (filters.salaryMin) {
    const jobTop = job.salaryMax || job.salaryMin || 0;
    salary = jobTop >= filters.salaryMin ? 10 : 0;
  }

  const score = Math.round(Math.min(content + level + workType + city + salary, 100));
  return { score, content: Math.round(content), level, workType, city, salary, matched };
}

function computeMatchScore(job, cv, filters) {
  return computeMatchBreakdown(job, cv, filters).score;
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

function updateCvRecap() {
  const cv = state.cv;
  const el = $("#cv-recap");
  if (!cv) { el.innerHTML = "Belum mengisi CV (opsional)."; return; }
  el.innerHTML = `
    <strong>${cv.fullName || "Kandidat"}</strong> · target: <em>${cv.targetRole || "—"}</em>
    ${cv.yearsExp ? "· " + cv.yearsExp + " thn" : ""}
    <br><span class="muted">Skill: ${cv.skills.join(", ") || "—"}</span>`;
}

function fillCvForm(cv) {
  if (!cv) return;
  $("#cv-name").value = cv.fullName || "";
  $("#cv-role").value = cv.targetRole || "";
  $("#cv-years").value = cv.yearsExp || "";
  $("#cv-summary").value = cv.summary || "";
  $("#cv-skills").value = (cv.skills || []).join(", ");
}

function persistCv() {
  try { localStorage.setItem(LS_CV, JSON.stringify(state.cv)); } catch (e) {}
}

function handleCvSubmit(e) {
  e.preventDefault();
  const cv = readCvForm();
  if (!cv.targetRole && cv.skills.length === 0) {
    alert("Isi minimal Target Posisi atau Keahlian agar AI bisa menilai kesesuaian lowongan.");
    return;
  }
  state.cv = cv;
  persistCv();
  updateCvRecap();
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
  state.sortKey = "matchScore";
  state.sortDir = "desc";
  state.page = 1;
  state.resultFilter = { text: "", minMatch: 0, savedOnly: false };
  resetSubfilterInputs();
  goToStep(3);

  // Simulasikan jeda "scraping + ranking" agar loading state terlihat.
  showLoading();
  setTimeout(() => {
    state.results = searchJobs(state.cv, filters);
    renderResults();
  }, 550);
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

// --- localStorage: lowongan tersimpan ---
function loadSaved() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_SAVED) || "[]")); }
  catch (e) { return new Set(); }
}
function persistSaved() {
  try { localStorage.setItem(LS_SAVED, JSON.stringify([...state.savedIds])); } catch (e) {}
}
function toggleSaved(id) {
  if (state.savedIds.has(id)) state.savedIds.delete(id);
  else state.savedIds.add(id);
  persistSaved();
}

// --- subfilter + sorting menghasilkan daftar yang TAMPIL (tanpa mutasi state.results) ---
function getVisibleResults() {
  const f = state.resultFilter;
  let list = state.results.filter((j) => {
    if (f.savedOnly && !state.savedIds.has(j.id)) return false;
    if (j.matchScore < f.minMatch) return false;
    if (f.text) {
      const hay = (j.title + " " + j.company + " " + j.skills.join(" ") + " " + j.city).toLowerCase();
      if (!hay.includes(f.text.toLowerCase())) return false;
    }
    return true;
  });
  const dir = state.sortDir === "asc" ? 1 : -1;
  const col = COLUMNS.find((c) => c.key === state.sortKey);
  list = list.slice().sort((a, b) => {
    let av = a[state.sortKey], bv = b[state.sortKey];
    if (col.type === "str") { av = (av || "").toLowerCase(); bv = (bv || "").toLowerCase(); return av < bv ? -1 * dir : av > bv ? 1 * dir : 0; }
    if (col.type === "date") { return (av.getTime() - bv.getTime()) * dir; }
    return ((av || 0) - (bv || 0)) * dir;
  });
  return list;
}

function onHeaderClick(key) {
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.sortKey = key;
    const col = COLUMNS.find((c) => c.key === key);
    state.sortDir = col.type === "str" ? "asc" : "desc";
  }
  state.page = 1;
  renderResults();
}

function scoreClass(score) { return score >= 70 ? "high" : score >= 45 ? "mid" : "low"; }

function matchBadge(score) {
  const cls = scoreClass(score);
  return `<div class="match-cell">
      <span class="match-num ${cls}">${score}%</span>
      <span class="match-bar"><span class="match-fill ${cls}" style="width:${score}%"></span></span>
    </div>`;
}

function starButton(id) {
  const on = state.savedIds.has(id);
  return `<button class="star ${on ? "on" : ""}" data-action="save" data-id="${id}" title="${on ? "Hapus dari tersimpan" : "Simpan lowongan"}">${on ? "★" : "☆"}</button>`;
}

// --- kartu statistik ringkasan ---
function renderStats() {
  const res = state.results;
  const withSalary = res.filter((j) => j.salaryMax || j.salaryMin);
  const avg = withSalary.length
    ? Math.round(withSalary.reduce((s, j) => s + (j.salaryMax || j.salaryMin), 0) / withSalary.length)
    : 0;
  const top = res.reduce((m, j) => Math.max(m, j.matchScore), 0);
  const bySource = {};
  res.forEach((j) => { bySource[j.source] = (bySource[j.source] || 0) + 1; });
  const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];

  $("#stats").innerHTML = `
    <div class="stat"><div class="stat-val">${res.length}</div><div class="stat-lbl">Lowongan ditemukan</div></div>
    <div class="stat"><div class="stat-val">${top}%</div><div class="stat-lbl">Match tertinggi</div></div>
    <div class="stat"><div class="stat-val">${avg ? formatRupiah(avg) : "—"}</div><div class="stat-lbl">Rata-rata gaji</div></div>
    <div class="stat"><div class="stat-val">${topSource ? topSource[0] : "—"}</div><div class="stat-lbl">Sumber terbanyak${topSource ? " (" + topSource[1] + ")" : ""}</div></div>
    <div class="stat"><div class="stat-val">${state.savedIds.size}</div><div class="stat-lbl">Tersimpan</div></div>`;
}

function showLoading() {
  $("#stats").innerHTML = "";
  $("#results-summary").innerHTML = `<span class="spinner"></span> Mengumpulkan & merangking lowongan dari ${state.filters.sources.join(", ")}…`;
  $("#results-body").innerHTML = Array.from({ length: 5 })
    .map(() => `<tr class="skeleton"><td colspan="9"><span class="skel"></span></td></tr>`).join("");
  $("#pagination").innerHTML = "";
}

function resetSubfilterInputs() {
  const t = $("#rf-text"), m = $("#rf-match"), mv = $("#rf-match-val"), s = $("#rf-saved");
  if (t) t.value = "";
  if (m) m.value = 0;
  if (mv) mv.textContent = "0%";
  if (s) s.checked = false;
}

function renderResults() {
  renderStats();

  // header tabel
  $("#results-head").innerHTML = "<tr>" + COLUMNS.map((c) => {
    const isActive = state.sortKey === c.key;
    const arrow = isActive ? (state.sortDir === "asc" ? " ▲" : " ▼") : " ⇅";
    return `<th data-key="${c.key}" class="${isActive ? "sorted" : ""}">${c.label}<span class="arrow">${arrow}</span></th>`;
  }).join("") + "<th>Aksi</th></tr>";
  $$("#results-head th[data-key]").forEach((th) =>
    th.addEventListener("click", () => onHeaderClick(th.dataset.key)));

  // hitung daftar tampil + pagination
  const visible = getVisibleResults();
  const totalPages = Math.max(1, Math.ceil(visible.length / state.pageSize));
  if (state.page > totalPages) state.page = totalPages;
  const start = (state.page - 1) * state.pageSize;
  const pageItems = visible.slice(start, start + state.pageSize);

  // body
  const tbody = $("#results-body");
  if (visible.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty">Tidak ada lowongan yang cocok. Coba longgarkan filter, turunkan match minimum, atau ubah keyword.</td></tr>`;
  } else {
    tbody.innerHTML = pageItems.map((j) => `
      <tr data-id="${j.id}" class="job-row">
        <td>${matchBadge(j.matchScore)}</td>
        <td><div class="job-title">${j.title}</div><div class="muted small">${j.level} · ${j.workType}</div></td>
        <td>${j.company}<div class="muted small">${j.industry} · ${j.companySize}</div></td>
        <td>${j.city}</td>
        <td><span class="tag">${j.employment}</span></td>
        <td>${salaryLabel(j)}</td>
        <td>${timeAgo(j.postedDaysAgo)}<div class="muted small">${j.postedDate.toLocaleDateString("id-ID")}</div></td>
        <td><span class="source source-${j.source.replace(/[^a-z]/gi, "").toLowerCase()}">${j.source}</span></td>
        <td class="actions-cell">${starButton(j.id)}<button class="btn-link" data-action="detail" data-id="${j.id}">Detail</button></td>
      </tr>`).join("");
  }

  // pagination
  renderPagination(visible.length, totalPages);

  // ringkasan
  const colLabel = COLUMNS.find((c) => c.key === state.sortKey).label;
  $("#results-summary").innerHTML =
    `Menampilkan <strong>${visible.length ? start + 1 : 0}–${Math.min(start + state.pageSize, visible.length)}</strong>
     dari <strong>${visible.length}</strong> lowongan${visible.length !== state.results.length ? ` (difilter dari ${state.results.length})` : ""} ·
     diurutkan <strong>${colLabel}</strong> (${state.sortDir === "asc" ? "naik" : "turun"})`;

  $("#final-prompt-result").textContent = buildFinalPrompt(state.cv, state.filters);
}

function renderPagination(total, totalPages) {
  const el = $("#pagination");
  if (totalPages <= 1) { el.innerHTML = ""; return; }
  let btns = `<button data-page="${state.page - 1}" ${state.page === 1 ? "disabled" : ""}>← Sebelumnya</button>`;
  for (let p = 1; p <= totalPages; p++) {
    btns += `<button data-page="${p}" class="${p === state.page ? "active" : ""}">${p}</button>`;
  }
  btns += `<button data-page="${state.page + 1}" ${state.page === totalPages ? "disabled" : ""}>Berikutnya →</button>`;
  el.innerHTML = btns;
}

// ============================================================
//  MODAL DETAIL LOWONGAN
// ============================================================
function openJobModal(id) {
  const job = state.results.find((j) => j.id === id);
  if (!job) return;
  const bd = computeMatchBreakdown(job, state.cv, state.filters);
  const saved = state.savedIds.has(id);

  const bar = (label, val, max) =>
    `<div class="bd-row"><span>${label}</span>
       <span class="bd-bar"><span class="bd-fill" style="width:${(val / max) * 100}%"></span></span>
       <span class="bd-num">${val}/${max}</span></div>`;

  const matchedChips = bd.matched.length
    ? bd.matched.map((k) => `<span class="chip">${k}</span>`).join("")
    : `<span class="muted small">Tidak ada keyword cocok — coba lengkapi Brief CV / keyword JD.</span>`;

  $("#modal-body").innerHTML = `
    <div class="modal-head">
      <div>
        <h3>${job.title}</h3>
        <p class="muted">${job.company} · ${job.city} · ${job.workType}</p>
      </div>
      ${matchBadge(job.matchScore)}
    </div>

    <div class="modal-grid">
      <div><span class="k">Status</span><span class="tag">${job.employment}</span></div>
      <div><span class="k">Level</span>${job.level}</div>
      <div><span class="k">Gaji</span>${salaryLabel(job)}</div>
      <div><span class="k">Diposting</span>${timeAgo(job.postedDaysAgo)}</div>
      <div><span class="k">Sumber</span><span class="source source-${job.source.replace(/[^a-z]/gi, "").toLowerCase()}">${job.source}</span></div>
      <div><span class="k">Industri</span>${job.industry}</div>
    </div>

    <h4>Deskripsi</h4>
    <p>${job.description || "—"}</p>

    <h4>Skill yang dibutuhkan</h4>
    <div class="chips">${job.skills.map((s) => `<span class="chip ${(state.cv?.skills || []).map((x) => x.toLowerCase()).includes(s.toLowerCase()) ? "owned" : ""}">${s}</span>`).join("") || "—"}</div>

    <h4>Rincian Match Score (${job.matchScore}%)</h4>
    <div class="breakdown">
      ${bar("Relevansi konten", bd.content, 55)}
      ${bar("Level pengalaman", bd.level, 15)}
      ${bar("Tipe kerja", bd.workType, 10)}
      ${bar("Lokasi", bd.city, 10)}
      ${bar("Gaji", bd.salary, 10)}
    </div>
    <h4>Keyword yang cocok</h4>
    <div class="chips">${matchedChips}</div>

    <div class="modal-actions">
      <button class="btn-ghost" data-action="save" data-id="${id}">${saved ? "★ Tersimpan" : "☆ Simpan"}</button>
      <button class="btn-ghost" id="btn-resume" data-id="${id}">📄 Generate Resume</button>
      <a class="btn-primary" href="${job.url}" target="_blank" rel="noopener">Lihat di ${job.source} ↗</a>
    </div>
    <div id="resume-brief"></div>`;

  $("#modal").classList.add("open");
}

function renderResumeBrief(id) {
  const job = state.results.find((j) => j.id === id);
  const box = $("#resume-brief");
  if (!state.cv) {
    box.innerHTML = `<div class="resume-note">Isi <strong>Brief CV</strong> dulu (Langkah 1) agar resume bisa dibuat tertarget.</div>`;
    return;
  }
  const cv = state.cv;
  const brief =
`# Brief untuk Generate Resume (tool: generate_resume.py)
Posisi   : ${job.title} @ ${job.company}
Lokasi   : ${job.city} (${job.workType}) · ${job.employment}
Skill JD : ${job.skills.join(", ") || "-"}

Kandidat : ${cv.fullName || "(anonim)"} — target "${cv.targetRole || "-"}"${cv.yearsExp ? ", " + cv.yearsExp + " thn" : ""}
Skill CV : ${cv.skills.join(", ") || "-"}
Ringkasan: ${cv.summary || "-"}

→ Resume akan menonjolkan irisan skill CV ↔ JD dan disesuaikan dengan deskripsi lowongan.`;
  box.innerHTML = `
    <div class="resume-note">Di produksi, tombol ini memanggil <code>tools/generate_resume.py</code> (Claude API) untuk membuat resume <em>tailored</em>. Berikut brief yang akan dikirim:</div>
    <pre>${brief.replace(/</g, "&lt;")}</pre>`;
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

function closeModal() {
  $("#modal").classList.remove("open");
  const rb = $("#resume-brief");
  if (rb) rb.innerHTML = "";
}

// ============================================================
//  INIT
// ============================================================
async function init() {
  state.allJobs = await loadJobs();
  state.savedIds = loadSaved();
  renderDataSourceBadge();

  // restore CV dari localStorage (jika ada)
  try {
    const savedCv = JSON.parse(localStorage.getItem(LS_CV) || "null");
    if (savedCv) { state.cv = savedCv; fillCvForm(savedCv); }
  } catch (e) {}
  updateCvRecap();

  // isi dropdown kota
  const citySel = $("#f-city");
  [...new Set(state.allJobs.map((j) => j.city))].sort().forEach((c) => {
    const o = document.createElement("option"); o.value = c; o.textContent = c; citySel.appendChild(o);
  });

  $("#cv-form").addEventListener("submit", handleCvSubmit);
  $("#search-form").addEventListener("submit", handleSearchSubmit);
  $("#btn-skip-cv").addEventListener("click", () => { goToStep(2); });
  $("#btn-back-1").addEventListener("click", () => goToStep(1));
  $("#btn-back-2").addEventListener("click", () => goToStep(2));
  $("#btn-new-search").addEventListener("click", () => goToStep(2));

  // update preview prompt setiap kali filter berubah
  $("#search-form").addEventListener("input", updatePromptPreview);
  $("#search-form").addEventListener("change", updatePromptPreview);

  // --- delegasi klik di tabel hasil: simpan / detail / buka baris ---
  $("#results-body").addEventListener("click", (e) => {
    const saveBtn = e.target.closest('[data-action="save"]');
    if (saveBtn) { toggleSaved(saveBtn.dataset.id); renderResults(); return; }
    const detailBtn = e.target.closest('[data-action="detail"]');
    if (detailBtn) { openJobModal(detailBtn.dataset.id); return; }
    if (e.target.closest("a")) return;
    const tr = e.target.closest("tr[data-id]");
    if (tr) openJobModal(tr.dataset.id);
  });

  // --- pagination ---
  $("#pagination").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-page]");
    if (!btn || btn.disabled) return;
    state.page = Number(btn.dataset.page);
    renderResults();
    $(".table-wrap").scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  // --- subfilter hasil ---
  $("#rf-text").addEventListener("input", (e) => {
    state.resultFilter.text = e.target.value.trim(); state.page = 1; renderResults();
  });
  $("#rf-match").addEventListener("input", (e) => {
    state.resultFilter.minMatch = Number(e.target.value);
    $("#rf-match-val").textContent = e.target.value + "%";
    state.page = 1; renderResults();
  });
  $("#rf-saved").addEventListener("change", (e) => {
    state.resultFilter.savedOnly = e.target.checked; state.page = 1; renderResults();
  });

  // --- modal: tombol save / resume di dalam modal, close, backdrop, Esc ---
  $("#modal-body").addEventListener("click", (e) => {
    const saveBtn = e.target.closest('[data-action="save"]');
    if (saveBtn) { toggleSaved(saveBtn.dataset.id); openJobModal(saveBtn.dataset.id); renderResults(); return; }
    const resumeBtn = e.target.closest("#btn-resume");
    if (resumeBtn) { renderResumeBrief(resumeBtn.dataset.id); return; }
  });
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  // klik item stepper untuk navigasi mundur
  $$(".stepper-item").forEach((s) =>
    s.addEventListener("click", () => {
      const n = Number(s.dataset.step);
      if (n === 1) goToStep(1);
      if (n === 2) goToStep(2);
      if (n === 3 && state.results.length) goToStep(3);
    })
  );

  updatePromptPreview();
}

document.addEventListener("DOMContentLoaded", init);
