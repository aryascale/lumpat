import React from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

export default function LandingNavbar() {
  const navigate = useNavigate();

  return (
    <motion.nav
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{
        duration: 1.5,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="absolute top-0 left-0 w-full z-50 px-4 py-3 bg-[#F1F3F6]/80 backdrop-blur-md border-b border-gray-200/50"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center cursor-pointer" onClick={() => navigate("/")}>
          <span className="text-[14px] md:text-[15px] font-bold tracking-tight text-slate-900">
            LUMPAT
          </span>
        </div>

        {/* Center: Nav Links */}
        <div className="hidden md:flex items-center gap-10 text-[12px] font-medium text-slate-600 tracking-wide">
          <a href="#events" className="hover:text-slate-900 transition-colors">
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

        {/* Mobile Menu Icon (Only visible on small screens) */}
        <div className="md:hidden flex items-center text-slate-800 cursor-pointer">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8h16M4 16h16" />
          </svg>
        </div>

        {/* Right: Login Button */}
        {/* <div>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2.5 rounded-full bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            Login
          </button>
        </div> */}
      </div>
    </motion.nav>
  );
}
