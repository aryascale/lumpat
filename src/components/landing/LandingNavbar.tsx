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
      className="absolute top-0 left-0 w-full z-50 px-6 py-6"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
          <span className="text-xl md:text-2xl font-black tracking-tight text-slate-900">
            🏃‍♂️ LUMPAT
          </span>
        </div>

        {/* Center: Nav Links */}
        <div className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600">
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

        {/* Right: Login Button */}
        <div>
          <button
            onClick={() => navigate("/login")}
            className="px-6 py-2.5 rounded-full bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            Login
          </button>
        </div>
      </div>
    </motion.nav>
  );
}
