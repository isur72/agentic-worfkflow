/*
 * data.js — Data lowongan SIMULASI (mock).
 *
 * CATATAN PROTOTIPE:
 * Di produksi, array MOCK_JOBS ini akan digantikan oleh hasil scraping nyata
 * dari backend (lihat tools/scrape_jobstreet.py + workflow WAT). Struktur tiap
 * objek sengaja dibuat menyerupai output scraper agar integrasi nanti mulus.
 *
 * Skema 1 lowongan:
 *   id              : string unik
 *   title           : posisi
 *   company         : nama perusahaan
 *   city            : kota (untuk filter lokasi)
 *   workType        : "Onsite" | "Remote" | "Hybrid"
 *   employment      : "Full Time" | "Part Time" | "Kontrak" | "Magang" | "Freelance"
 *   level           : "Fresh Graduate" | "Junior" | "Mid" | "Senior"
 *   industry        : sektor industri
 *   companySize     : "Startup" | "Menengah" | "Enterprise"
 *   salaryMin/Max   : angka Rupiah/bulan (0 = tidak disebutkan)
 *   source          : "Glints" | "JobStreet" | "Loker.id" | "LinkedIn"
 *   postedDaysAgo   : berapa hari lalu diposting (untuk sort tanggal)
 *   skills          : array keyword skill (dipakai untuk match score)
 *   url             : link lowongan
 *   description     : ringkasan JD (dipakai untuk match score)
 */

const CITIES = ["Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Tangerang", "Bali", "Semarang", "Medan"];
const SOURCES = ["Glints", "JobStreet", "Loker.id", "LinkedIn"];

const MOCK_JOBS = [
  // ---------- Tech / Engineering ----------
  { id: "j01", title: "Frontend Engineer (React)", company: "PT Tokoflow Digital", city: "Jakarta", workType: "Hybrid", employment: "Full Time", level: "Mid", industry: "Teknologi", companySize: "Startup", salaryMin: 10000000, salaryMax: 16000000, source: "Glints", postedDaysAgo: 1, skills: ["react", "javascript", "typescript", "tailwind", "rest api", "git"], url: "https://glints.com/id/job/j01", description: "Membangun antarmuka web dengan React dan TypeScript, kolaborasi dengan tim desain dan backend." },
  { id: "j02", title: "Backend Engineer (Node.js)", company: "Bumi Payments", city: "Jakarta", workType: "Remote", employment: "Full Time", level: "Senior", industry: "Fintech", companySize: "Menengah", salaryMin: 18000000, salaryMax: 28000000, source: "LinkedIn", postedDaysAgo: 3, skills: ["node.js", "javascript", "postgresql", "rest api", "docker", "aws"], url: "https://linkedin.com/jobs/j02", description: "Mendesain layanan backend skala besar untuk sistem pembayaran, fokus pada reliabilitas dan keamanan." },
  { id: "j03", title: "Fullstack Developer", company: "CV Sinar Koding", city: "Bandung", workType: "Onsite", employment: "Kontrak", level: "Junior", industry: "Teknologi", companySize: "Startup", salaryMin: 7000000, salaryMax: 11000000, source: "Loker.id", postedDaysAgo: 12, skills: ["react", "node.js", "javascript", "mongodb", "rest api"], url: "https://loker.id/job/j03", description: "Mengembangkan fitur fullstack memakai React di frontend dan Node.js di backend." },
  { id: "j04", title: "Mobile Engineer (Flutter)", company: "Sehatin App", city: "Surabaya", workType: "Hybrid", employment: "Full Time", level: "Mid", industry: "Health Tech", companySize: "Startup", salaryMin: 12000000, salaryMax: 18000000, source: "Glints", postedDaysAgo: 5, skills: ["flutter", "dart", "rest api", "firebase", "git"], url: "https://glints.com/id/job/j04", description: "Membangun aplikasi mobile kesehatan lintas platform menggunakan Flutter." },
  { id: "j05", title: "DevOps Engineer", company: "Awan Nusantara", city: "Jakarta", workType: "Remote", employment: "Full Time", level: "Senior", industry: "Cloud", companySize: "Enterprise", salaryMin: 20000000, salaryMax: 32000000, source: "LinkedIn", postedDaysAgo: 8, skills: ["docker", "kubernetes", "aws", "ci/cd", "terraform", "linux"], url: "https://linkedin.com/jobs/j05", description: "Mengelola infrastruktur cloud, pipeline CI/CD, dan otomasi deployment." },

  // ---------- Data ----------
  { id: "j06", title: "Data Analyst", company: "PT Ritel Maju", city: "Jakarta", workType: "Onsite", employment: "Full Time", level: "Junior", industry: "Retail", companySize: "Enterprise", salaryMin: 8000000, salaryMax: 13000000, source: "JobStreet", postedDaysAgo: 2, skills: ["sql", "excel", "python", "tableau", "data visualization"], url: "https://id.jobstreet.com/id/job/j06", description: "Menganalisis data penjualan ritel, membuat dashboard dan laporan untuk manajemen." },
  { id: "j07", title: "Data Scientist", company: "Bumi Payments", city: "Bandung", workType: "Hybrid", employment: "Full Time", level: "Mid", industry: "Fintech", companySize: "Menengah", salaryMin: 15000000, salaryMax: 24000000, source: "LinkedIn", postedDaysAgo: 6, skills: ["python", "machine learning", "sql", "pandas", "statistics"], url: "https://linkedin.com/jobs/j07", description: "Membangun model prediksi risiko kredit dan deteksi fraud memakai machine learning." },
  { id: "j08", title: "Data Engineer", company: "Awan Nusantara", city: "Jakarta", workType: "Remote", employment: "Kontrak", level: "Mid", industry: "Cloud", companySize: "Enterprise", salaryMin: 16000000, salaryMax: 25000000, source: "Glints", postedDaysAgo: 10, skills: ["python", "sql", "spark", "airflow", "etl", "aws"], url: "https://glints.com/id/job/j08", description: "Merancang pipeline data dan ETL untuk kebutuhan analitik perusahaan." },
  { id: "j09", title: "Business Intelligence Analyst", company: "PT Ritel Maju", city: "Surabaya", workType: "Onsite", employment: "Full Time", level: "Mid", industry: "Retail", companySize: "Enterprise", salaryMin: 10000000, salaryMax: 15000000, source: "JobStreet", postedDaysAgo: 14, skills: ["sql", "power bi", "tableau", "excel", "data visualization"], url: "https://id.jobstreet.com/id/job/j09", description: "Mengubah data bisnis menjadi insight melalui dashboard Power BI dan Tableau." },

  // ---------- Marketing ----------
  { id: "j10", title: "Digital Marketing Specialist", company: "Kopi Kekinian", city: "Jakarta", workType: "Hybrid", employment: "Full Time", level: "Mid", industry: "F&B", companySize: "Menengah", salaryMin: 7000000, salaryMax: 12000000, source: "Glints", postedDaysAgo: 1, skills: ["seo", "meta ads", "google ads", "content marketing", "analytics"], url: "https://glints.com/id/job/j10", description: "Mengelola kampanye digital, paid ads, dan strategi konten untuk brand F&B." },
  { id: "j11", title: "Social Media Officer", company: "Fashionista ID", city: "Bandung", workType: "Onsite", employment: "Part Time", level: "Fresh Graduate", industry: "Fashion", companySize: "Startup", salaryMin: 3500000, salaryMax: 5000000, source: "Loker.id", postedDaysAgo: 4, skills: ["social media", "content creation", "canva", "copywriting"], url: "https://loker.id/job/j11", description: "Mengelola akun media sosial brand fashion, membuat konten harian dan engagement." },
  { id: "j12", title: "Performance Marketing Manager", company: "ShopEase", city: "Jakarta", workType: "Hybrid", employment: "Full Time", level: "Senior", industry: "E-commerce", companySize: "Enterprise", salaryMin: 18000000, salaryMax: 30000000, source: "LinkedIn", postedDaysAgo: 7, skills: ["google ads", "meta ads", "analytics", "sql", "growth", "roas"], url: "https://linkedin.com/jobs/j12", description: "Memimpin strategi performance marketing dan optimasi ROAS lintas channel." },
  { id: "j13", title: "Content Writer", company: "Media Nusantara", city: "Yogyakarta", workType: "Remote", employment: "Freelance", level: "Junior", industry: "Media", companySize: "Menengah", salaryMin: 4000000, salaryMax: 7000000, source: "Glints", postedDaysAgo: 9, skills: ["copywriting", "seo", "content marketing", "editing"], url: "https://glints.com/id/job/j13", description: "Menulis artikel SEO dan konten editorial untuk berbagai klien." },

  // ---------- Design / Product ----------
  { id: "j14", title: "UI/UX Designer", company: "Tokoflow Digital", city: "Jakarta", workType: "Hybrid", employment: "Full Time", level: "Mid", industry: "Teknologi", companySize: "Startup", salaryMin: 9000000, salaryMax: 15000000, source: "Glints", postedDaysAgo: 2, skills: ["figma", "ui design", "ux research", "prototyping", "design system"], url: "https://glints.com/id/job/j14", description: "Mendesain pengalaman pengguna untuk produk web dan mobile, riset dan prototyping." },
  { id: "j15", title: "Product Manager", company: "Sehatin App", city: "Jakarta", workType: "Hybrid", employment: "Full Time", level: "Senior", industry: "Health Tech", companySize: "Startup", salaryMin: 20000000, salaryMax: 35000000, source: "LinkedIn", postedDaysAgo: 5, skills: ["product management", "roadmap", "agile", "analytics", "stakeholder"], url: "https://linkedin.com/jobs/j15", description: "Mengelola roadmap produk kesehatan digital dari discovery hingga delivery." },
  { id: "j16", title: "Graphic Designer", company: "Fashionista ID", city: "Bandung", workType: "Onsite", employment: "Kontrak", level: "Junior", industry: "Fashion", companySize: "Startup", salaryMin: 5000000, salaryMax: 8000000, source: "Loker.id", postedDaysAgo: 11, skills: ["photoshop", "illustrator", "branding", "canva"], url: "https://loker.id/job/j16", description: "Membuat aset visual untuk kampanye dan kebutuhan brand fashion." },

  // ---------- Finance / Ops / Admin ----------
  { id: "j17", title: "Finance Staff", company: "PT Ritel Maju", city: "Semarang", workType: "Onsite", employment: "Full Time", level: "Fresh Graduate", industry: "Retail", companySize: "Enterprise", salaryMin: 5000000, salaryMax: 7000000, source: "JobStreet", postedDaysAgo: 3, skills: ["accounting", "excel", "tax", "financial report"], url: "https://id.jobstreet.com/id/job/j17", description: "Membantu pencatatan transaksi keuangan, rekonsiliasi, dan pelaporan bulanan." },
  { id: "j18", title: "HR Generalist", company: "Awan Nusantara", city: "Jakarta", workType: "Onsite", employment: "Full Time", level: "Mid", industry: "Cloud", companySize: "Enterprise", salaryMin: 8000000, salaryMax: 13000000, source: "JobStreet", postedDaysAgo: 15, skills: ["recruitment", "payroll", "employee relations", "hris"], url: "https://id.jobstreet.com/id/job/j18", description: "Menangani rekrutmen, payroll, dan administrasi SDM end-to-end." },
  { id: "j19", title: "Customer Success Associate", company: "ShopEase", city: "Tangerang", workType: "Hybrid", employment: "Full Time", level: "Junior", industry: "E-commerce", companySize: "Enterprise", salaryMin: 6000000, salaryMax: 9000000, source: "Glints", postedDaysAgo: 6, skills: ["customer service", "communication", "crm", "problem solving"], url: "https://glints.com/id/job/j19", description: "Membantu pelanggan B2B mencapai sukses memakai produk, menjaga retensi." },
  { id: "j20", title: "Project Coordinator", company: "Bumi Payments", city: "Bali", workType: "Remote", employment: "Kontrak", level: "Mid", industry: "Fintech", companySize: "Menengah", salaryMin: 9000000, salaryMax: 14000000, source: "LinkedIn", postedDaysAgo: 13, skills: ["project management", "agile", "communication", "jira"], url: "https://linkedin.com/jobs/j20", description: "Mengoordinasi proyek lintas tim, menjaga timeline dan komunikasi stakeholder." },

  // ---------- Tambahan variasi ----------
  { id: "j21", title: "QA Engineer", company: "CV Sinar Koding", city: "Bandung", workType: "Remote", employment: "Full Time", level: "Mid", industry: "Teknologi", companySize: "Startup", salaryMin: 9000000, salaryMax: 14000000, source: "Glints", postedDaysAgo: 4, skills: ["testing", "automation", "selenium", "javascript", "qa"], url: "https://glints.com/id/job/j21", description: "Menjamin kualitas produk lewat pengujian manual dan otomatis." },
  { id: "j22", title: "Sales Executive", company: "Kopi Kekinian", city: "Surabaya", workType: "Onsite", employment: "Full Time", level: "Junior", industry: "F&B", companySize: "Menengah", salaryMin: 5000000, salaryMax: 9000000, source: "Loker.id", postedDaysAgo: 2, skills: ["sales", "negotiation", "communication", "b2b"], url: "https://loker.id/job/j22", description: "Mengembangkan jaringan mitra B2B dan mencapai target penjualan regional." },
  { id: "j23", title: "Junior Web Developer", company: "Media Nusantara", city: "Yogyakarta", workType: "Onsite", employment: "Magang", level: "Fresh Graduate", industry: "Media", companySize: "Menengah", salaryMin: 2500000, salaryMax: 4000000, source: "Loker.id", postedDaysAgo: 1, skills: ["html", "css", "javascript", "php", "wordpress"], url: "https://loker.id/job/j23", description: "Program magang web developer, membangun dan memelihara situs berita." },
  { id: "j24", title: "Senior Data Analyst", company: "ShopEase", city: "Jakarta", workType: "Hybrid", employment: "Full Time", level: "Senior", industry: "E-commerce", companySize: "Enterprise", salaryMin: 17000000, salaryMax: 26000000, source: "JobStreet", postedDaysAgo: 7, skills: ["sql", "python", "tableau", "ab testing", "data visualization", "statistics"], url: "https://id.jobstreet.com/id/job/j24", description: "Memimpin analitik produk, eksperimen A/B, dan rekomendasi berbasis data." },
  { id: "j25", title: "React Native Developer", company: "Sehatin App", city: "Remote", workType: "Remote", employment: "Freelance", level: "Mid", industry: "Health Tech", companySize: "Startup", salaryMin: 12000000, salaryMax: 20000000, source: "LinkedIn", postedDaysAgo: 20, skills: ["react native", "javascript", "typescript", "rest api", "redux"], url: "https://linkedin.com/jobs/j25", description: "Membangun fitur aplikasi mobile kesehatan dengan React Native." },
];

// Tanggal posting absolut dihitung dari postedDaysAgo (relatif terhadap hari ini).
MOCK_JOBS.forEach((j) => {
  const d = new Date();
  d.setDate(d.getDate() - j.postedDaysAgo);
  j.postedDate = d; // objek Date untuk sorting
});
