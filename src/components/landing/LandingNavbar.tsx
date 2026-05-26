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
        <div className="flex items-center cursor-pointer" onClick={() => navigate("/")}>
          <span className="text-[14px] md:text-[15px] font-extrabold tracking-tight text-slate-900">
            LUMPAT
          </span>
        </div>

        {/* Center: Nav Links */}
        <div className="hidden md:flex items-center gap-10 text-[12px] font-medium text-slate-600 tracking-wide">
          <a onClick={() => navigate("/event")} className="hover:text-slate-900 transition-colors cursor-pointer">
            Events
          </a>
          <a href="#izt-timing" className="hover:text-slate-900 transition-colors">
            iZT Timing Kit
          </a>
          <a href="#live-results" className="hover:text-slate-900 transition-colors">
            Live Results
          </a>
          <a href="#about" className="hover:text-slate-900 transition-colors">
            About
          </a>
        </div>

        {/* Mobile Menu Icon */}
        <div className="md:hidden flex items-center text-slate-800 cursor-pointer">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 16h16" />
          </svg>
        </div>
      </div>
    </motion.nav>
  );
}
