import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function LandingNavbar() {
  const navigate = useNavigate();

  return (
    <motion.nav
      initial={{ y: -70, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        delay: 1.4, // Match explosion timing
        duration: 1.2,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="absolute top-0 left-0 w-full z-50 px-4 py-3 bg-transparent"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <div className="flex items-center justify-center w-8 h-8 bg-slate-900 rounded-md relative overflow-hidden">
            <span className="text-white font-black text-[15px] z-10 relative">L</span>
            <div className="absolute top-1 right-1">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#CCFF00" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 17l9.2-9.2M17 17V7H7"/>
              </svg>
            </div>
          </div>
          <span className="text-[14px] font-bold tracking-tight text-slate-900 mt-1">
            lumpat.online
          </span>
        </div>

        {/* Center: Nav Links */}
        <div className="hidden md:flex items-center gap-8 text-[13px] font-semibold text-slate-500 tracking-wide">
          <a onClick={() => navigate("/event")} className="hover:text-slate-900 transition-colors cursor-pointer">
            Eksplorasi Event
          </a>
          <a href="#izt-timing" className="hover:text-slate-900 transition-colors">
            Teknologi Timing iZT
          </a>
          <a href="#solusi-eo" className="hover:text-slate-900 transition-colors">
            Solusi EO
          </a>
          <a href="#about" className="hover:text-slate-900 transition-colors">
            Tentang Kami
          </a>
        </div>

        {/* Mobile Menu Icon */}
        <div className="md:hidden flex items-center text-slate-800 cursor-pointer">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Right: Login Button */}
        <div className="hidden md:block">
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2.5 rounded-full bg-slate-900 text-white text-[13px] font-bold hover:bg-slate-800 transition-all shadow-md active:scale-95"
          >
            Masuk
          </button>
        </div>
      </div>
    </motion.nav>
  );
}
