// src/pages/LandingPage.tsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import EventSearchModal from "../components/EventSearchModal";
import ImageSlider3D from "../components/lightswind/3d-image-slider";
import CoolBentoEffect from "../components/ui/cool-bento-effect";

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeEcosystem, setActiveEcosystem] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive state observer
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const heroImages = [
    "/Assets/landing/hero.webp",
    "/Assets/landing/hero_2.webp",
    "/Assets/landing/hero_3.webp"
  ];

  // Rotate hero image every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  // Rotate ecosystem carousel every 3.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveEcosystem((prev) => (prev + 1) % 5);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  // Parallax scroll handler
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    document.querySelectorAll(".scroll-reveal").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const faqs = [
    {
      question: "How does the timing system work?",
      answer:
        "Each participant wears a UHF passive transponder (attached to their bib, ankle strap, or bike). As they cross timing mats placed at checkpoints and the finish line, the system records split times with 0.2-second accuracy and uploads results to the live leaderboard instantly.",
    },
    {
      question: "Are the transponders waterproof?",
      answer:
        "Yes, 100% waterproof. Our transponders are designed specifically for triathlon events — they remain active and accurate during the swim leg, whether in open water or pool environments.",
    },
    {
      question: "How do participants view their results?",
      answer:
        "Results are available in real-time on the online leaderboard. After the event concludes, participants can also download their official finisher certificate as a PDF directly from their profile.",
    },
    {
      question: "What does the timing package include?",
      answer:
        "Our complete timing solution includes transponder tags, timing mats, real-time scoring software, live leaderboard hosting, and post-event certificate generation. Contact our team for a customized quote.",
    },
    {
      question: "Can this system be used for non-triathlon events?",
      answer:
        "Absolutely. Our timing system supports running races, cycling events, obstacle courses, relay races, and any multi-sport event that requires accurate split timing and live results.",
    },
  ];




  return (
    <>
      <Navbar />

      {/* ===================== SECTION 1: HERO ===================== */}
      <section
        id="hero"
        className="landing-hero relative transition-all duration-1000 bg-cover bg-center"
        style={{
          backgroundImage: `url('${heroImages[heroIndex]}')`,
          backgroundPositionY: `${scrollY * 0.4}px`,
        }}
      >
        <div className="landing-hero__overlay absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-900/70 to-stone-900/40" />
        <div className="scroll-reveal relative z-10 w-full h-full flex flex-col justify-end pb-16 sm:pb-32 px-6 sm:px-12 max-w-7xl mx-auto">
          
          <div className="flex flex-col md:flex-row justify-between items-end gap-8 w-full">
            <div className="text-left max-w-2xl">
              <h1 className="text-white text-5xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight leading-tight mb-4 shadow-sm">
                CHASE THE FINISH,
                <br />
                OWN YOUR TIME
              </h1>
              <p className="text-white/90 text-lg sm:text-xl leading-relaxed max-w-xl shadow-sm">
                Discover events, push your limits, and see your results in real time.
              </p>
            </div>
            
            <div className="mb-4 sm:mb-8">
              <button
                onClick={() => navigate("/event")}
                className="px-8 py-4 bg-white text-gray-900 text-lg font-bold rounded-xl hover:bg-gray-100 transition-all flex items-center gap-2 shadow-2xl hover:-translate-y-1 active:scale-95"
              >
                Find Event
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </button>
            </div>
          </div>
          
          {/* Carousel Indicators */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex gap-2">
             {heroImages.map((_, i) => (
                <button 
                  key={i}
                  onClick={() => setHeroIndex(i)}
                  className={`h-2 rounded-full transition-all duration-300 ${i === heroIndex ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/80'}`}
                  aria-label={`Go to slide ${i+1}`}
                />
             ))}
          </div>
        </div>
      </section>

      {/* ===================== TICKER LOGO ===================== */}
      <div className="w-full bg-white border-b border-gray-100 overflow-hidden py-5 sm:py-7 flex items-center relative shadow-[inset_0_-10px_20px_rgba(0,0,0,0.02)]">
        {/* Gradients for smooth edges */}
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-32 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        
        <div className="flex animate-marquee w-max">
          {/* We repeat the items 16 times so it's wide enough. -50% translateX will loop exactly halfway. */}
          {[...Array(16)].map((_, i) => (
            <div key={i} className="flex items-center justify-center gap-3 sm:gap-4 px-8 sm:px-16 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-300 cursor-default">
              <span className="text-[10px] sm:text-xs font-bold tracking-[0.15em] text-gray-500 uppercase">Powered by</span>
              <img src="/Assets/logo2.gif" alt="Logo" className="h-5 sm:h-7 object-contain" />
            </div>
          ))}
        </div>
      </div>

      {/* ===================== PLATFORM ECOSYSTEM — CINEMATIC 3D ===================== */}
      <section className="overflow-hidden relative" id="platform" style={{ 
        background: 'radial-gradient(ellipse 120% 80% at 50% 40%, #f0f0f0 0%, #e8e8e8 40%, #f5f5f5 100%)',
        padding: isMobile ? '50px 0 30px' : '100px 0 80px' 
      }}>
        {/* Subtle top/bottom vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(180deg, rgba(245,245,245,0.8) 0%, transparent 15%, transparent 85%, rgba(245,245,245,0.8) 100%)' }} />

        {/* Section Header */}
        <div className="text-center mb-8 md:mb-20 px-6 relative z-10">
          <span className="text-red-500 font-extrabold tracking-[0.3em] text-[11px] uppercase mb-3 block">SOFTWARE PLATFORM</span>
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-black uppercase text-stone-900 mb-4 tracking-[-0.04em] leading-[0.92]">COMPLETE<br className="sm:hidden" /> ECOSYSTEM</h2>
          <p className="text-stone-400 max-w-md mx-auto text-sm md:text-[15px] font-medium leading-relaxed">
            Manage your entire event from one unified dashboard.<br className="hidden md:block" /> From custom branding to real-time results.
          </p>
        </div>

        {/* === 3D STAGE === */}
        <div className={`relative w-full max-w-6xl mx-auto flex items-center justify-center transition-all duration-500 ${isMobile ? 'h-[240px]' : 'h-[460px]'}`}>
          {/* Atmospheric glows */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(220,38,38,0.07) 0%, transparent 70%)', filter: 'blur(60px)' }} />
          
          <ImageSlider3D 
            images={[
              "/Assets/landing2/White Label Website.png",
              "/Assets/landing2/result.png",
              "/Assets/landing2/map start and finish.png",
              "/Assets/landing2/multisport.png",
              "/Assets/landing2/portfolio.png",
              "/Assets/landing2/White Label Website.png",
              "/Assets/landing2/result.png",
              "/Assets/landing2/map start and finish.png",
              "/Assets/landing2/multisport.png",
              "/Assets/landing2/portfolio.png"
            ]}
            duration={45}
            cardWidth={isMobile ? "12.5rem" : "28rem"}
            cardAspectRatio={isMobile ? "12/10" : "15/10"}
            perspective={isMobile ? "45rem" : "60rem"}
            withMask={true}
            containerClassName="w-full h-full"
            imageClassName="border border-stone-200/20 shadow-[0_20px_50px_rgba(0,0,0,0.15)] select-none pointer-events-none brightness-[1.02] saturate-[1.05]"
          />
        </div>

        {/* Labels with active indicator */}
        <div className="flex justify-center gap-4 sm:gap-10 md:gap-20 mt-6 md:mt-12 px-4 flex-wrap relative z-10">
          {[
            { tag: "#01", title: "White Label" },
            { tag: "#02", title: "Results" },
            { tag: "#03", title: "Route Map" },
            { tag: "#04", title: "Multisport" },
            { tag: "#05", title: "Portfolio" },
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => setActiveEcosystem(idx)}
              className={`flex flex-col items-center gap-1.5 transition-all duration-600 cursor-pointer ${activeEcosystem === idx ? 'opacity-100 scale-[1.08]' : 'opacity-20 hover:opacity-45 scale-100'}`}
            >
              <span className={`font-black text-xs md:text-sm tracking-[0.2em] transition-colors duration-500 ${activeEcosystem === idx ? 'text-red-500' : 'text-stone-400'}`}>{item.tag}</span>
              <span className={`font-bold text-[10px] md:text-xs uppercase tracking-wider whitespace-nowrap transition-colors duration-500 ${activeEcosystem === idx ? 'text-stone-900' : 'text-stone-500'}`}>{item.title}</span>
              {/* Active indicator */}
              <div className={`h-[2.5px] rounded-full transition-all duration-500 mt-0.5 ${activeEcosystem === idx ? 'w-10 bg-red-500' : 'w-0 bg-transparent'}`} />
            </button>
          ))}
        </div>
      </section>

      {/* ===================== SECTION 2: PHOTO GRID (PAUSED) ===================== */}
      {/* Section ini di-pause sementara
      <section className="landing-section landing-section--white" id="photo-grid">
        <div className="landing-container">
          <div className="landing-photo-grid scroll-reveal">
            <div className="landing-photo-grid__item landing-photo-grid__item--large landing-img-wrapper">
              <img src="/Assets/landing/swim.webp" alt="Triathlon swimming" loading="lazy" />
            </div>
            <div className="landing-photo-grid__item landing-img-wrapper">
              <img src="/Assets/landing/bike.webp" alt="Triathlon cycling" loading="lazy" />
            </div>
            <div className="landing-photo-grid__item landing-img-wrapper">
              <img src="/Assets/landing/run.webp" alt="Triathlon running" loading="lazy" />
            </div>
          </div>

          <div className="landing-section-header scroll-reveal" style={{ marginTop: "48px" }}>
            <p className="landing-section-header__subtitle">
              From the open water to the finish line, our timing system records
              every split time with industry-leading accuracy.
            </p>
          </div>
        </div>
      </section>
      */}

      {/* ===================== SECTION 3: PARALLAX JOURNEY ===================== */}
      <section id="journey">
        {/* SWIM */}
        <div
          className="landing-parallax-block"
          style={{
            backgroundImage: "url('/Assets/landing/swim.webp')",
            backgroundPositionY: `${(scrollY - 800) * 0.2}px`,
          }}
        >
          <div className="landing-parallax-block__overlay landing-parallax-block__overlay--dark" />
          <div className="landing-parallax-block__content scroll-reveal">
            <span className="landing-parallax-block__phase">01 — SWIM</span>
            <h3 className="landing-parallax-block__title">WATERPROOF. FAILPROOF.</h3>
            <p className="landing-parallax-block__text">
              100% waterproof transponders that stay active underwater. Accurately
              tracks swim splits in open water and pool environments.
            </p>
          </div>
        </div>

        {/* BIKE */}
        <div
          className="landing-parallax-block"
          style={{
            backgroundImage: "url('/Assets/landing/bike.webp')",
            backgroundPositionY: `${(scrollY - 1400) * 0.2}px`,
          }}
        >
          <div className="landing-parallax-block__overlay" />
          <div className="landing-parallax-block__content landing-parallax-block__content--right scroll-reveal">
            <span className="landing-parallax-block__phase">02 — BIKE</span>
            <h3 className="landing-parallax-block__title">BUILT FOR EVERY TERRAIN</h3>
            <p className="landing-parallax-block__text">
              Aerodynamic, shock-resistant design. Records every checkpoint without
              interruption across any distance.
            </p>
          </div>
        </div>

        {/* RUN */}
        <div
          className="landing-parallax-block"
          style={{
            backgroundImage: "url('/Assets/landing/run.webp')",
            backgroundPositionY: `${(scrollY - 2000) * 0.2}px`,
          }}
        >
          <div className="landing-parallax-block__overlay landing-parallax-block__overlay--red" />
          <div className="landing-parallax-block__content scroll-reveal">
            <span className="landing-parallax-block__phase">03 — RUN</span>
            <h3 className="landing-parallax-block__title">0.2-SECOND ACCURACY</h3>
            <p className="landing-parallax-block__text">
              Captures the finish line with precision. Results go live on the
              leaderboard in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* ===================== SECTION 4: PRODUCT SHOWCASE ===================== */}
      {/* ===================== SECTION 4: PRODUCT SHOWCASE — APPLE STYLE ===================== */}
      <section className="bg-[#f5f5f7] py-20 md:py-28" id="products">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Partnership Editorial Header */}
          <div className="text-center mb-16 md:mb-24 scroll-reveal">
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-red-500 font-extrabold tracking-[0.3em] text-[10px] md:text-xs uppercase">LUMPAT</span>
              <span className="text-stone-300 text-sm font-light">×</span>
              <span className="text-stone-500 font-extrabold tracking-[0.3em] text-[10px] md:text-xs uppercase">IZT TIMING</span>
            </div>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-black uppercase text-stone-900 tracking-[-0.04em] mb-6 leading-none">
              PROFESSIONAL TIMING LINEUP
            </h2>
            <p className="text-stone-500 max-w-2xl mx-auto text-base md:text-lg font-medium leading-relaxed">
              LUMPAT partners with IZT, Indonesia’s trusted multi-sport timing specialist. Together, we deliver state-of-the-art transponders and decoders for error-free splits.
            </p>
          </div>

          {/* Grid Layout — Bento Effect */}
          <div className="scroll-reveal w-full flex items-center justify-center">
            <CoolBentoEffect className="w-full" />
          </div>
        </div>
      </section>


      {/* ===================== SECTION 8: FAQ ===================== */}
      <section className="landing-section landing-section--white" id="faq">
        <div className="landing-container landing-container--narrow">
          <div className="landing-section-header scroll-reveal">
            <h2 className="landing-section-header__title">FREQUENTLY ASKED QUESTIONS</h2>
          </div>

          <div className="landing-faq scroll-reveal">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className={`landing-faq__item ${openFaq === idx ? "landing-faq__item--open" : ""}`}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="landing-faq__trigger"
                >
                  <span className="landing-faq__question">{faq.question}</span>
                  <svg
                    className={`landing-faq__chevron ${
                      openFaq === idx ? "landing-faq__chevron--open" : ""
                    }`}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className="landing-faq__answer"
                  style={{
                    maxHeight: openFaq === idx ? "300px" : "0",
                    opacity: openFaq === idx ? 1 : 0,
                    paddingBottom: openFaq === idx ? "20px" : "0",
                  }}
                >
                  <p>{faq.answer}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="bg-white border-t border-gray-200 text-xs text-gray-500 py-10 mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 mb-8">
            <div className="flex flex-col space-y-2.5">
              <h5 className="font-semibold text-gray-900 mb-1">Platform</h5>
              <a onClick={() => navigate("/leaderboard")} className="hover:text-gray-900 hover:underline cursor-pointer transition-colors">Leaderboard</a>
              <a onClick={() => setIsSearchOpen(true)} className="hover:text-gray-900 hover:underline cursor-pointer transition-colors">Search Events</a>
              <a href="#products" className="hover:text-gray-900 hover:underline transition-colors">Transponders</a>
              <a href="#features" className="hover:text-gray-900 hover:underline transition-colors">Features</a>
              <a href="#live-results" className="hover:text-gray-900 hover:underline transition-colors">Live Results</a>
            </div>
            <div className="flex flex-col space-y-2.5">
              <h5 className="font-semibold text-gray-900 mb-1">Company</h5>
              <a href="#about" className="hover:text-gray-900 hover:underline transition-colors">About IJT</a>
              <a href="#organizers" className="hover:text-gray-900 hover:underline transition-colors">For Organizers</a>
              <a href="#careers" className="hover:text-gray-900 hover:underline transition-colors">Careers</a>
              <a href="#contact" className="hover:text-gray-900 hover:underline transition-colors">Contact Us</a>
            </div>
            <div className="flex flex-col space-y-2.5">
              <h5 className="font-semibold text-gray-900 mb-1">Support</h5>
              <a href="#faq" className="hover:text-gray-900 hover:underline transition-colors">FAQ</a>
              <a href="#help-center" className="hover:text-gray-900 hover:underline transition-colors">Help Center</a>
              <a href="#timing-guide" className="hover:text-gray-900 hover:underline transition-colors">Timing Guide</a>
              <a href="#status" className="hover:text-gray-900 hover:underline transition-colors">System Status</a>
            </div>
            <div className="flex flex-col space-y-2.5">
              <h5 className="font-semibold text-gray-900 mb-1">Values</h5>
              <a href="#accessibility" className="hover:text-gray-900 hover:underline transition-colors">Accessibility</a>
              <a href="#environment" className="hover:text-gray-900 hover:underline transition-colors">Environment</a>
              <a href="#privacy" className="hover:text-gray-900 hover:underline transition-colors">Privacy</a>
              <a href="#responsibility" className="hover:text-gray-900 hover:underline transition-colors">Responsibility</a>
            </div>
            <div className="flex flex-col space-y-2.5">
              <h5 className="font-semibold text-gray-900 mb-1">About IJT</h5>
              <a href="#news" className="hover:text-gray-900 hover:underline transition-colors">Newsroom</a>
              <a href="#leadership" className="hover:text-gray-900 hover:underline transition-colors">Leadership</a>
              <a href="#events" className="hover:text-gray-900 hover:underline transition-colors">Events</a>
              <a href="#contact" className="hover:text-gray-900 hover:underline transition-colors">Contact IJT</a>
            </div>
          </div>
          
          <div className="border-t border-gray-200 pt-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-2">
              <p className="text-gray-400">Hak cipta © 2026 IJT — Indonesia Timing System. Seluruh hak cipta dilindungi undang-undang.</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 text-gray-500">
                <a href="#privacy" className="hover:text-gray-900 hover:underline transition-colors">Kebijakan Privasi</a>
                <span className="hidden md:inline text-gray-300">|</span>
                <a href="#terms" className="hover:text-gray-900 hover:underline transition-colors">Ketentuan Penggunaan</a>
                <span className="hidden md:inline text-gray-300">|</span>
                <a href="#legal" className="hover:text-gray-900 hover:underline transition-colors">Legal</a>
                <span className="hidden md:inline text-gray-300">|</span>
                <a href="#sitemap" className="hover:text-gray-900 hover:underline transition-colors">Peta Situs</a>
              </div>
            </div>
            <div className="text-gray-900 hover:text-black transition-colors cursor-pointer font-medium whitespace-nowrap">
              Indonesia
            </div>
          </div>
        </div>
      </footer>

      {/* Popups */}
      <EventSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
