import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
// Guaranteed working images for sports/running/events
const PLACEHOLDER_IMAGES = Array.from({ length: 24 }).map(
  (_, i) => `https://loremflickr.com/400/400/running,marathon,sports?lock=${i + 150}`
);

export default function HeroCircularGallery() {
  const navigate = useNavigate();
  const [radius, setRadius] = useState(340);
  const [isExploded, setIsExploded] = useState(false);

  // Responsive setup
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const radius = isMobile ? 125 : 350;
  const explodedScale = isMobile ? 0.65 : 0.95;

  // 1.4s delay for Explosion Trigger (Phase 2)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExploded(true);
    }, 1400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-[100svh] flex items-center justify-center bg-[#F1F3F6] overflow-hidden">
      <AnimatePresence>
        {/* The Main Animation Asset: Outer Container */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Infinite Rotating Container (Phase 3) */}
          <motion.div
            animate={isExploded ? { rotate: 360 } : { rotate: 0 }}
            transition={
              isExploded
                ? { 
                    duration: 70, // 70s slow orbit
                    ease: "linear", 
                    repeat: Infinity,
                    delay: 1.0 // Wait 1s for the explosion spring to settle
                  }
                : { duration: 0 }
            }
            style={{ willChange: "transform" }}
            className="relative w-0 h-0 flex items-center justify-center"
          >
            {PLACEHOLDER_IMAGES.map((src, i) => {
              const angle = (i / 24) * 2 * Math.PI;
              const targetX = isExploded ? Math.cos(angle) * radius : 0;
              const targetY = isExploded ? Math.sin(angle) * radius : 0;
              // Tangential Rotation: point bottom toward center
              const targetRotation = isExploded ? (angle + Math.PI / 2) * (180 / Math.PI) : 0;

              return (
                <motion.div
                  key={i}
                  initial={{
                    x: 0,
                    y: 0,
                    scale: i === 0 ? 0.3 : 0,
                    opacity: 0,
                    rotate: 0,
                  }}
                  animate={{
                    x: targetX,
                    y: targetY,
                    scale: isExploded ? explodedScale : (i === 0 ? 1.6 : 0),
                    opacity: isExploded ? 1 : (i === 0 ? 1 : 0),
                    rotate: targetRotation,
                  }}
                  transition={{
                    type: isExploded ? "spring" : "tween",
                    stiffness: isExploded ? 30 : undefined,
                    damping: isExploded ? 15 : undefined,
                    mass: isExploded ? 1.2 : undefined,
                    delay: isExploded ? i * 0.015 : 0,
                    duration: isExploded ? undefined : 1.4,
                    ease: isExploded ? undefined : [0.16, 1, 0.3, 1],
                  }}
                  className="absolute w-[38px] h-[50px] md:w-[60px] md:h-[80px] p-[4px] md:p-1.5 overflow-hidden rounded-md md:rounded-lg shadow-xl bg-white flex items-center justify-center"
                >
                  <div className="w-full h-full overflow-hidden rounded-[2px] md:rounded-[4px]">
                    <img
                      src={src}
                      alt={`Sport asset ${i}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* Centered Hero Content */}
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{
            y: isExploded ? 0 : 40,
            opacity: isExploded ? 1 : 0,
          }}
          transition={{
            delay: isExploded ? 0.4 : 0, // slight delay after explosion starts
            duration: 1.2,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative z-10 flex flex-col items-center text-center max-w-[320px] md:max-w-3xl px-4 pointer-events-auto mt-6 md:mt-0"
        >
          <h1 className="text-[28px] sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] tracking-tight mb-4 md:mb-6">
            Masa Depan Manajemen <br className="hidden md:block" />
            Event Olahraga.
          </h1>
          <p className="text-slate-500 text-[13px] sm:text-sm md:text-base font-medium leading-relaxed max-w-[280px] md:max-w-md mb-8 md:mb-10">
            Satu ekosistem digital terintegrasi untuk otomatisasi registrasi, sistem praktis QR Code Racepack, hingga akurasi tinggi Live Timing Kit iZT.
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/event")}
            className="px-8 py-3.5 md:px-10 md:py-4 text-[13px] md:text-[15px] bg-slate-900 text-white rounded-full font-bold shadow-[0_8px_20px_rgba(15,23,42,0.2)] hover:bg-slate-800 transition-colors"
          >
            Mulai Jelajah
          </motion.button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
