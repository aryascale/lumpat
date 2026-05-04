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
      name: "Bib Tag",
      desc: "Race bib with integrated UHF transponder chip. Pre-programmed and personalized.",
      type: "disposable",
    },
    {
      name: "Ankle Tag",
      desc: "Reusable UHF transponder worn on the ankle with neoprene strap. Low-cost and durable.",
      type: "reusable",
    },
    {
      name: "Bike Tag",
      desc: "Aerodynamic seatpost sticker with embedded transponder. Simply stick and ride.",
      type: "disposable",
    },
    {
      name: "Relay Baton",
      desc: "Timing baton with dual transponders for relay race events. Robust and reliable.",
      type: "reusable",
    },
  ];

  const hardwareImages = [
    "/images/events/device_bib_tag.webp",
    "/images/events/device_ankle_tag.webp",
    "/images/events/device_bike_tag.webp",
    "/images/events/device_relay_baton.webp"
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

      {/* ===================== SECTION 2: PHOTO GRID ===================== */}
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
