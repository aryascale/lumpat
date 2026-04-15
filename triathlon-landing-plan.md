# PRD & Planning Design: Landing Page Triathlon Transponder

## 1. Overview
Project: Landing Page untuk sistem transponder/timing Lomba Triathlon (Lari, Renang, Sepeda).
Referensi Utama: [RACE RESULT - HuTag](https://www.raceresult.com/en-us/systems/transponders?id=hutag)
Project Type: WEB (Frontend)

## 2. Design Goal & Aesthetic
- **Warna Utama**: Merah (Red) dan Putih (White).
- **Style**: Oldschool (Klasik/Retro/Sporty jadul) dipadukan dengan sentuhan Modern (animasi halus, clean spacing) dan Parallax effect.
- **Vibe**: Energetik, kokoh (durable), dapat diandalkan, dan profesional.

## 3. Copywriting Plan & Section Breakdown

### Section 1: Hero Banner (Header)
- **Visual**: Parallax background dengan sentuhan elemen 3 olahraga (siluet atau garis vektor orang berenang, bersepeda, dan berlari).
- **Copy**: 
  - *Headline*: "Presisi di Setiap Detik. Di Darat Maupun di Air." (Oldschool bold/block typography).
  - *Sub-headline*: "Transponder UHF reusable terbaik untuk event Triathlon, Obstacle Course, dan Multisport."
  - *CTA Button*: "Lihat Spesifikasi" atau "Pesan Sekarang".

### Section 2: Product Showcase (The Transponder)
- **Visual**: Gambar alat transponder (misal: bentuk strap pergelangan kaki / HuTag) dengan layout asimetris modern.
- **Copy**: 
  - *Headline*: "Didesain untuk Ketahanan."
  - *Body*: "Sistem timing yang ringan, 100% tahan air, dan nyaman digunakan dengan strap neoprene di pergelangan kaki. Tidak mengganggu performa atlet."

### Section 3: Parallax Journey (Swim -> Bike -> Run)
- **Visual**: Scrolling vertikal dengan parallax effect. Saat di-scroll, background berubah dari elemen air (Renang), jalanan (Sepeda), lalu lintasan lari.
- **Copy**:
  - *Swim*: "Waterproof & Seamless. Transponder tetap aktif menyelam bersamamu."
  - *Bike*: "Aerodinamis & Kokoh. Tahan terhadap guncangan di lintasan."
  - *Run*: "Ringan & Presisi. Mencatat garis finish dengan akurasi 0.2 detik."

### Section 4: Technical Specifications & Features
- **Visual**: Grid layout atau kartu-kartu bergaya retro-modern dengan garis-garis tegas (Merah & Putih).
- **Copy**:
  - Tahan Air (Waterproof)
  - UHF Passive Transponder
  - Reusable (Bisa dipakai berulang-ulang)
  - Pre-programmed 7-digit code
  - Material Neoprene yang nyaman

### Section 5: Final CTA (Call to Action) & Footer
- **Visual**: Banner solid warna merah dengan teks putih tebal.
- **Copy**: 
  - *Headline*: "Siap Menggelar Event Triathlon Anda Selanjutnya?"
  - *Body*: "Dapatkan sistem timing paling andal untuk peserta Anda hari ini."
  - *CTA*: "Hubungi Tim Sales" atau "Minta Penawaran".

## 4. Task Breakdown (Implementation Plan)

### Task 1: Setup & Scaffolding [P0]
- Agent: `frontend-specialist`
- Description: Inisialisasi halaman Next.js, setup global CSS (Red & White palette), dan konfigurasi font (misal: font tebal/sporty untuk oldschool vibe).

### Task 2: Build Hero Section & Parallax Wrapper [P1]
- Agent: `frontend-specialist`
- Description: Mengimplementasikan hero section dengan Framer Motion atau GSAP untuk efek parallax yang smooth.

### Task 3: Build Journey Section (Swim-Bike-Run) [P2]
- Agent: `frontend-specialist`
- Description: Membuat komponen interaktif yang berubah konten dan backgroundnya ketika di scroll (Scroll-linked animations).

### Task 4: Content & Tech Specs Grid [P2]
- Agent: `frontend-specialist`
- Description: Merancang grid untuk spesifikasi teknis dan copywriting dengan style "oldschool bold".

### Task 5: Final Polish & Verification [P3]
- Agent: `performance-optimizer` / `test-engineer`
- Description: Memastikan animasi berjalan 60fps, responsive di mobile, dan warna merepresentasikan kontras yang baik.

## 5. Phase X: Verification
- [ ] UX Audit
- [ ] Responsiveness (Mobile, Tablet, Desktop)
- [ ] Lighthouse (Performance Parallax Check)
