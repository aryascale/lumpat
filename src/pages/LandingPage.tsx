// src/pages/LandingPage.tsx

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import EventSearchModal from "../components/EventSearchModal";

export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeHardware, setActiveHardware] = useState(0);
  const [activeEcosystem, setActiveEcosystem] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);

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

  const products = [
    {
      name: "Pro Time Decoder",
      desc: "The core timing unit that processes transponder reads with extreme accuracy and reliability.",
      type: "hardware",
    },
    {
      name: "Magic Antenna",
      desc: "Advanced high-gain antenna system ensuring maximum read rates in dense race conditions.",
      type: "hardware",
    },
    {
      name: "Active Chip",
      desc: "High precision active transponder designed for professional cycling and high-speed sports.",
      type: "reusable",
    },
    {
      name: "Running Chip",
      desc: "Lightweight passive UHF transponder optimized for mass running events and marathons.",
      type: "disposable",
    },
  ];

  const hardwareImages = [
    "/Assets/landing2/PRO TIME DECODER.png",
    "/Assets/landing2/MAGIC ANTENNA.png",
    "/Assets/landing2/Active Chip.png",
    "/Assets/landing2/RUNNING Chip.png"
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

      {/* ===================== PLATFORM ECOSYSTEM — CINEMATIC 3D CAROUSEL ===================== */}
      <section className="overflow-hidden relative" id="platform" style={{ backgroundColor: "#f5f5f5", padding: "100px 0 80px" }}>
        {/* Section Header */}
        <div className="text-center mb-24 px-6 relative z-10">
          <span className="text-red-500 font-extrabold tracking-[0.25em] text-xs uppercase mb-3 block">SOFTWARE PLATFORM</span>
          <h2 className="text-4xl md:text-6xl font-black uppercase text-stone-900 mb-5 tracking-[-0.04em] leading-[0.95]">COMPLETE ECOSYSTEM</h2>
          <p className="text-stone-400 max-w-lg mx-auto text-sm md:text-base font-medium">
            Manage your entire event from one unified dashboard. From custom branding to real-time results.
          </p>
        </div>

        {/* 3D Carousel Stage */}
        <div className="relative w-screen left-1/2 -translate-x-1/2" style={{ perspective: '2000px' }}>
          
          {/* Atmospheric glow behind center */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-red-500/[0.06] blur-[80px] pointer-events-none" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[250px] h-[250px] rounded-full bg-blue-500/[0.04] blur-[60px] pointer-events-none" />

          {/* Edge fade gradients */}
          <div className="absolute left-0 top-0 h-full w-32 md:w-48 bg-gradient-to-r from-[#f5f5f5] to-transparent z-[60] pointer-events-none" />
          <div className="absolute right-0 top-0 h-full w-32 md:w-48 bg-gradient-to-l from-[#f5f5f5] to-transparent z-[60] pointer-events-none" />

          <div className="flex items-center justify-center relative" style={{ height: '480px', transformStyle: 'preserve-3d' }}>
            {[
              { title: "White Label", img: "/Assets/landing2/White Label Website.png", tag: "#01" },
              { title: "Results", img: "/Assets/landing2/result.png", tag: "#02" },
              { title: "Route Map", img: "/Assets/landing2/map start and finish.png", tag: "#03" },
              { title: "Multisport", img: "/Assets/landing2/multisport.png", tag: "#04" },
              { title: "Portfolio", img: "/Assets/landing2/portfolio.png", tag: "#05" },
            ].map((item, index) => {
              let diff = index - activeEcosystem;
              const total = 5;
              if (diff > Math.floor(total / 2)) diff -= total;
              if (diff < -Math.floor(total / 2)) diff += total;
              const absDiff = Math.abs(diff);
              const isCenter = absDiff === 0;

              // Cinematic 3D transforms
              const tx = diff * 200;
              const ry = diff * 22;         // Stronger rotation
              const tz = isCenter ? 80 : -(absDiff * 100);  // Deeper Z push
              const ty = absDiff * 15;      // Vertical stagger
              const sc = isCenter ? 1.15 : Math.max(0.78, 0.92 - absDiff * 0.07);
              const op = isCenter ? 1 : Math.max(0.35, 0.7 - absDiff * 0.15);
              const z = isCenter ? 50 : 40 - absDiff * 5;

              return (
                <div
                  key={item.tag}
                  className="absolute transition-all duration-[1000ms] ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer select-none group"
                  style={{
                    transform: `translateX(${tx}px) translateY(${ty}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${sc})`,
                    zIndex: z,
                    opacity: op,
                    transformStyle: 'preserve-3d',
                  }}
                  onClick={() => setActiveEcosystem(index)}
                >
                  <div
                    className={`overflow-hidden rounded-[20px] transition-all duration-700 bg-stone-200 relative ${
                      isCenter 
                        ? 'shadow-[0_40px_100px_-15px_rgba(0,0,0,0.3),0_15px_30px_-10px_rgba(0,0,0,0.15)] ring-1 ring-white/30' 
                        : 'shadow-[0_15px_40px_-10px_rgba(0,0,0,0.12)] group-hover:-translate-y-3 group-hover:shadow-[0_25px_60px_-10px_rgba(0,0,0,0.2)]'
                    }`}
                    style={{ width: '220px', height: '340px' }}
                  >
                    <img
                      src={item.img}
                      alt={item.title}
                      className={`w-full h-full object-cover transition-all duration-700 ${
                        isCenter ? 'brightness-105 saturate-110' : 'brightness-[0.75] saturate-[0.6]'
                      }`}
                      draggable={false}
                    />
                    {/* Glass overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10 pointer-events-none" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Labels with active indicator */}
        <div className="flex justify-center gap-8 sm:gap-12 md:gap-16 mt-10 px-4 flex-wrap relative z-10">
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
              className={`flex flex-col items-center gap-1.5 transition-all duration-500 cursor-pointer ${activeEcosystem === idx ? 'opacity-100' : 'opacity-25 hover:opacity-50'}`}
            >
              <span className={`font-black text-xs md:text-sm tracking-[0.2em] transition-colors duration-500 ${activeEcosystem === idx ? 'text-red-500' : 'text-stone-400'}`}>{item.tag}</span>
              <span className="text-stone-800 font-bold text-[10px] md:text-xs uppercase tracking-wider whitespace-nowrap">{item.title}</span>
              {/* Active indicator line */}
              <div className={`h-[2px] rounded-full transition-all duration-500 ${activeEcosystem === idx ? 'w-8 bg-red-500' : 'w-0 bg-transparent'}`} />
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
      <section className="landing-section landing-section--white" id="products">
        <div className="landing-container">
          <div className="landing-section-header scroll-reveal">
            <span className="landing-section-header__tag">TIMING HARDWARE</span>
            <h2 className="landing-section-header__title">TRANSPONDER LINEUP</h2>
            <p className="landing-section-header__subtitle">
              Purpose-built transponders for every race format. Different tags can
              be used in the same event.
            </p>
          </div>

          <div className="landing-products scroll-reveal">
            <div className="landing-products__image landing-img-wrapper transition-all duration-500 bg-stone-50 rounded-xl flex items-center justify-center p-8">
              <img
                src={hardwareImages[activeHardware]}
                alt={products[activeHardware].name}
                loading="lazy"
                className="max-h-[400px] object-contain drop-shadow-2xl transition-all duration-500 scale-100"
                key={activeHardware}
              />
            </div>
            <div className="landing-products__list">
              {products.map((product, idx) => (
                <div 
                  key={idx} 
                  className={`landing-product-card cursor-pointer transition-all duration-300 border-2 ${activeHardware === idx ? 'border-red-500 bg-red-50' : 'border-transparent hover:border-red-200'}`}
                  onClick={() => setActiveHardware(idx)}
                >
                  <div className="landing-product-card__header">
                    <h4 className={`landing-product-card__name ${activeHardware === idx ? 'text-red-600' : ''}`}>{product.name}</h4>
                    <span
                      className={`landing-product-card__badge ${
                        product.type === "reusable"
                          ? "landing-product-card__badge--reusable"
                          : ""
                      }`}
                    >
                      {product.type}
                    </span>
                  </div>
                  <p className="landing-product-card__desc">{product.desc}</p>
                </div>
              ))}
            </div>
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
      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer__top">
            <div className="landing-footer__brand">
              <img src="/Assets/logo2.gif" alt="IJT Logo" className="landing-footer__logo" />
              <p className="landing-footer__tagline">
                Indonesia's Triathlon Timing System
              </p>
            </div>
            <div className="landing-footer__links">
              <div className="landing-footer__col">
                <h5>Platform</h5>
                <a onClick={() => navigate("/leaderboard")}>Leaderboard</a>
                <a onClick={() => setIsSearchOpen(true)}>Events</a>
                <a href="#products">Transponders</a>
              </div>
              <div className="landing-footer__col">
                <h5>Company</h5>
                <a href="#organizers">For Organizers</a>
                <a href="#faq">FAQ</a>
                <a href="#cta">Contact</a>
              </div>
            </div>
          </div>
          <div className="landing-footer__bottom">
            <span>© 2026 IJT — Indonesia Timing System. All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* Popups */}
      <EventSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
