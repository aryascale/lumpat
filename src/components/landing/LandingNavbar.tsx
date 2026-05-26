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
        delay: 1.6,
        duration: 1.2,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="absolute top-0 left-0 w-full z-50 px-4 py-3 bg-[#F1F3F6]/80 backdrop-blur-md border-b border-gray-200/50"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer group" onClick={() => navigate("/")}>
          <div className="relative w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden shadow-sm">
            <span className="text-white font-black text-lg">L</span>
            <span className="absolute top-1 right-1 text-[#00FF66] text-[8px] font-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
              ➔
            </span>
          </div>
          <span className="text-[14px] md:text-[15px] font-extrabold tracking-tight text-slate-900">
            lumpat.online
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
