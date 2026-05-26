import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

// Using dummy sport images for Indonesia timing context
const PLACEHOLDER_IMAGES = Array.from({ length: 24 }).map(
  (_, i) => `https://loremflickr.com/400/400/sports,indonesia,timing?lock=${i + 150}`
);

export default function HeroCircularGallery() {
  const navigate = useNavigate();
  const [radius, setRadius] = useState(340);
  const [isExploded, setIsExploded] = useState(false);

  // Responsive radius
  useEffect(() => {
    const handleResize = () => {
      setRadius(window.innerWidth < 768 ? 160 : 380);
    };
    handleResize(); // Set initial
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 1.4s delay for Explosion Trigger (Phase 2)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExploded(true);
    }, 1400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-[100svh] flex items-center justify-center bg-white overflow-hidden">
      <AnimatePresence>
        {/* The Main Animation Asset: Outer Container */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          {/* Infinite Rotating Container (Phase 3) */}
          <motion.div
            animate={isExploded ? { rotate: 360 } : { rotate: 0 }}
            transition={
              isExploded
                ? { 
                    duration: 30, // Faster spin
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
              const targetX = Math.cos(angle) * radius;
              const targetY = Math.sin(angle) * radius;
              // Tangential Rotation: align perfectly pointing outward
              const targetRotation = angle * (180 / Math.PI) + 90;

              return (
                <div
                  key={i}
                  className="absolute flex items-center justify-center"
                >
                  <motion.div
                    initial={{
                      x: 0,
                      y: 0,
                      scale: i === 0 ? 0.3 : 0,
                      opacity: i === 0 ? 0 : 0,
                      rotate: 0,
                    }}
                    animate={{
                      x: isExploded ? targetX : 0,
                      y: isExploded ? targetY : 0,
                      scale: isExploded ? 1 : i === 0 ? 1.6 : 0,
                      opacity: isExploded ? 1 : i === 0 ? 1 : 0,
                      rotate: isExploded ? targetRotation : 0,
                    }}
                    transition={{
                      type: isExploded ? "spring" : "tween",
                      stiffness: isExploded ? 35 : undefined,
                      damping: isExploded ? 14 : undefined,
                      mass: isExploded ? 1.2 : undefined,
                      delay: isExploded ? i * 0.012 : 0,
                      duration: isExploded ? undefined : 1.4,
                      ease: isExploded ? undefined : [0.16, 1, 0.3, 1],
                    }}
                    className="w-[48px] h-[48px] md:w-[72px] md:h-[72px] overflow-hidden rounded-lg shadow-md bg-stone-50 flex items-center justify-center"
                  >
                    {i === 0 ? (
                      <div className="w-full h-full flex items-center justify-center bg-white border border-gray-100">
                        <span className="font-black text-[12px] md:text-[16px] tracking-tighter text-slate-900">
                          LUMPAT
                        </span>
                      </div>
                    ) : (
                      <img
                        src={src}
                        alt={`Dummy sport ${i}`}
                        className="w-full h-full object-cover opacity-90 mix-blend-multiply"
                      />
                    )}
                  </motion.div>
                </div>
              );
            })}
          </motion.div>
        </div>

        {/* Centered Hero Content */}
        <motion.div
          initial={{ y: 35, opacity: 0 }}
          animate={{
            y: isExploded ? 0 : 35,
            opacity: isExploded ? 1 : 0,
          }}
          transition={{
            delay: isExploded ? 0.6 : 0,
            duration: 1.2,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative z-10 flex flex-col items-center text-center max-w-[320px] md:max-w-2xl px-2 md:px-6 pointer-events-auto mt-4 md:mt-0"
        >
          <h1 className="flex flex-col items-center justify-center tracking-tight mb-4 md:mb-5">
            <span className="text-[20px] sm:text-[24px] md:text-[36px] font-normal text-slate-400 mb-1 md:mb-3">The future of</span>
            <span className="text-[32px] sm:text-4xl md:text-[56px] font-semibold text-slate-900 leading-[1.1]">Running Events</span>
          </h1>
          <p className="text-slate-500 text-[12px] sm:text-sm md:text-[15px] font-medium leading-relaxed max-w-[260px] md:max-w-md mb-8 md:mb-10">
            Satu ekosistem digital untuk manajemen registrasi, pengambilan racepack QR, hingga akurasi live timing kit iZT.
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            onClick={() => navigate("/event")}
            className="px-6 py-3 md:px-8 md:py-4 text-xs md:text-sm bg-[#1A1A1A] text-white rounded-full font-medium shadow-[0_8px_20px_rgba(0,0,0,0.15)] hover:bg-black transition-colors active:scale-95"
          >
            Mulai Jelajah
          </motion.button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
