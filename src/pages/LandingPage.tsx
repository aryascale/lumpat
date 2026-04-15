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
    "/images/events/device_bib_tag.png",
    "/images/events/device_ankle_tag.png",
    "/images/events/device_bike_tag.png",
    "/images/events/device_relay_baton.png"
  ];


  return (
    <>
      <Navbar />

      {/* ===================== SECTION 1: HERO ===================== */}
      <section
        id="hero"
        className="landing-hero"
        style={{
          backgroundPositionY: `${scrollY * 0.4}px`,
        }}
      >
        <div className="landing-hero__overlay" />
        <div className="landing-hero__content scroll-reveal">
          <span className="landing-hero__tag">TIMING SYSTEM FOR TRIATHLON EVENTS</span>
          <h1 className="landing-hero__title">
            PRECISION IN
            <br />
            EVERY SECOND
          </h1>
          <p className="landing-hero__subtitle">
            The leading transponder and timing system for Swim, Bike &amp; Run events.
            <br />
            Trusted by 150+ sport events across Indonesia.
          </p>
          <div className="landing-hero__cta">
            <button
              onClick={() => navigate("/leaderboard")}
              className="landing-btn landing-btn--primary"
            >
              VIEW LEADERBOARD
            </button>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="landing-btn landing-btn--outline"
            >
              FIND EVENTS
            </button>
          </div>

          {/* Stats Bar */}
          <div className="landing-hero__stats">
            <div className="landing-hero__stat">
              <span className="landing-hero__stat-number">4,800+</span>
              <span className="landing-hero__stat-label">Athletes Timed</span>
            </div>
            <div className="landing-hero__stat-divider" />
            <div className="landing-hero__stat">
              <span className="landing-hero__stat-number">150+</span>
              <span className="landing-hero__stat-label">Events Powered</span>
            </div>
            <div className="landing-hero__stat-divider" />
            <div className="landing-hero__stat">
              <span className="landing-hero__stat-number">24</span>
              <span className="landing-hero__stat-label">Cities Covered</span>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== SECTION 2: PHOTO GRID ===================== */}
      <section className="landing-section landing-section--white" id="photo-grid">
        <div className="landing-container">
          <div className="landing-photo-grid scroll-reveal">
            <div className="landing-photo-grid__item landing-photo-grid__item--large landing-img-wrapper">
              <img src="/Assets/landing/swim.png" alt="Triathlon swimming" loading="lazy" />
            </div>
            <div className="landing-photo-grid__item landing-img-wrapper">
              <img src="/Assets/landing/bike.png" alt="Triathlon cycling" loading="lazy" />
            </div>
            <div className="landing-photo-grid__item landing-img-wrapper">
              <img src="/Assets/landing/run.png" alt="Triathlon running" loading="lazy" />
            </div>
          </div>

          <div className="landing-section-header scroll-reveal" style={{ marginTop: "48px" }}>
            <h2 className="landing-section-header__title">SWIM · BIKE · RUN</h2>
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
            backgroundImage: "url('/Assets/landing/swim.png')",
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
            backgroundImage: "url('/Assets/landing/bike.png')",
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
            backgroundImage: "url('/Assets/landing/run.png')",
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

      {/* ===================== SECTION 6: FOR PARTICIPANTS ===================== */}
      <section className="landing-section landing-section--white" id="participants">
        <div className="landing-container">
          <div className="landing-split scroll-reveal">
            <div className="landing-split__visual">
              <div className="landing-leaderboard-mock">
                <div className="landing-leaderboard-mock__header">
                  <div className="landing-leaderboard-mock__dot landing-leaderboard-mock__dot--red" />
                  <div className="landing-leaderboard-mock__dot landing-leaderboard-mock__dot--yellow" />
                  <div className="landing-leaderboard-mock__dot landing-leaderboard-mock__dot--green" />
                  <span>IJT Live Leaderboard</span>
                </div>
                <div className="landing-leaderboard-mock__body">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Swim</th>
                        <th>Bike</th>
                        <th>Run</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { rank: 1, name: "A. Rahman", swim: "24:12", bike: "1:02:34", run: "38:45", total: "2:05:31" },
                        { rank: 2, name: "D. Pratama", swim: "25:08", bike: "1:01:12", run: "40:22", total: "2:06:42" },
                        { rank: 3, name: "R. Santoso", swim: "23:45", bike: "1:04:18", run: "39:51", total: "2:07:54" },
                        { rank: 4, name: "M. Wijaya", swim: "26:33", bike: "1:00:45", run: "41:10", total: "2:08:28" },
                        { rank: 5, name: "B. Kusuma", swim: "24:56", bike: "1:03:22", run: "41:33", total: "2:09:51" },
                      ].map((row) => (
                        <tr key={row.rank}>
                          <td>
                            <span className={`mock-rank mock-rank--${row.rank}`}>
                              {row.rank}
                            </span>
                          </td>
                          <td className="mock-name">{row.name}</td>
                          <td>{row.swim}</td>
                          <td>{row.bike}</td>
                          <td>{row.run}</td>
                          <td className="mock-total">{row.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="landing-split__content">
              <span className="landing-section-header__tag">FOR PARTICIPANTS</span>
              <h2 className="landing-section-header__title" style={{ textAlign: "left" }}>
                TRACK YOUR RACE.
                <br />
                OWN YOUR RESULT.
              </h2>
              <p className="landing-split__text">
                Monitor your ranking in real-time on the live leaderboard. Download
                your official finisher certificate after every event.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-1 gap-4 mb-8">
                {[
                  "Live leaderboard with split times",
                  "Shareable Finisher Certificate for IG Stories",
                  "Race history & profile",
                  "Results verified from official timing system"
                ].map((feature, i) => (
                  <div key={i} className="bg-white border-2 border-red-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex items-start gap-3">
                    <span className="text-sm font-bold text-stone-800 leading-tight">{feature}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate("/leaderboard")}
                className="landing-btn landing-btn--primary"
              >
                VIEW LEADERBOARD
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== SECTION 7: FOR ORGANIZERS ===================== */}
      <section className="landing-section landing-section--dark" id="organizers">
        <div className="landing-container">
          <div className="landing-section-header scroll-reveal">
            <span className="landing-section-header__tag landing-section-header__tag--light">
              FOR EVENT ORGANIZERS
            </span>
            <h2 className="landing-section-header__title landing-section-header__title--light">
              COMPLETE TIMING SOLUTION
              <br />
              FOR YOUR NEXT EVENT
            </h2>
            <p className="landing-section-header__subtitle landing-section-header__subtitle--light">
              From transponders to live scoring software — everything in one platform.
            </p>
          </div>

          <div className="landing-org-grid scroll-reveal">
            {[
              {
                title: "Participant Management",
                desc: "Handle registration, categories, and BIB number assignment automatically.",
              },
              {
                title: "Real-time Timing",
                desc: "UHF transponder system with 0.2-second accuracy and live split tracking.",
              },
              {
                title: "Results & Certificates",
                desc: "Auto-generate race results and finisher certificates for every participant.",
              },
            ].map((item, idx) => (
              <div key={idx} className="landing-org-card">
                <h4 className="landing-org-card__title">{item.title}</h4>
                <p className="landing-org-card__desc">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="landing-org-cta scroll-reveal">
            <button className="landing-btn landing-btn--white">CONTACT SALES TEAM</button>
            <button
              onClick={() => setIsSearchOpen(true)}
              className="landing-btn landing-btn--outline-light"
            >
              VIEW DEMO
            </button>
          </div>
        </div>
      </section>

      {/* ===================== SECTION 8: FAQ ===================== */}
      <section className="landing-section landing-section--gray" id="faq">
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

      {/* ===================== SECTION 9: FINAL CTA ===================== */}
      <section className="landing-final-cta" id="cta">
        <div className="landing-container scroll-reveal">
          <h2 className="landing-final-cta__title">
            READY TO POWER YOUR
            <br />
            NEXT TRIATHLON EVENT?
          </h2>
          <p className="landing-final-cta__subtitle">
            Get the most reliable timing system for your participants today.
          </p>
          <div className="landing-final-cta__buttons">
            <button className="landing-btn landing-btn--white landing-btn--large">
              REQUEST A QUOTE
            </button>
            <button
              onClick={() => navigate("/leaderboard")}
              className="landing-btn landing-btn--outline-light landing-btn--large"
            >
              VIEW LEADERBOARD
            </button>
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
            <span>© 2026 IJT — Indonesia Jaya Triathlon. All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* Popups */}
      <EventSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
}
