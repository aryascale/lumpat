import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

// Using picsum seeds to guarantee stable, high-quality images that don't break
const PLACEHOLDER_IMAGES = Array.from({ length: 24 }).map(
  (_, i) => `https://picsum.photos/seed/${i + 150}/400/600`
);

export default function HeroCircularGallery() {
  const navigate = useNavigate();
  const [radius, setRadius] = useState(340);
  const [isExploded, setIsExploded] = useState(false);

  // Responsive radius
  useEffect(() => {
    const handleResize = () => {
      setRadius(window.innerWidth < 768 ? 125 : 340);
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
                    duration: 65, 
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
                      // Phase 2 (Explosion) uses premium spring physics
                      // Phase 1 (Intro) uses tween bezier for the initial pop
                      type: isExploded ? "spring" : "tween",
                      stiffness: isExploded ? 35 : undefined,
                      damping: isExploded ? 14 : undefined,
                      mass: isExploded ? 1.2 : undefined,
                      delay: isExploded ? i * 0.012 : 0,
                      duration: isExploded ? undefined : 1.4,
                      ease: isExploded ? undefined : [0.16, 1, 0.3, 1],
                    }}
                    className="w-[38px] h-[50px] md:w-[60px] md:h-[80px] overflow-hidden rounded-md shadow-md border border-white/50 bg-white"
                  >
                    <img
                      src={src}
                      alt={`Runner event ${i}`}
                      className="w-full h-full object-cover"
                    />
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
            delay: isExploded ? 0.6 : 0, // 0.6s delay after explosion starts
            duration: 1.2,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="relative z-10 flex flex-col items-center text-center max-w-2xl px-6 pointer-events-auto"
        >
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.1] md:leading-[1.05] tracking-tight mb-4">
            The Future of <br className="hidden md:block" />
            Running Events.
          </h1>
          <p className="text-slate-600 text-sm md:text-base font-medium leading-relaxed max-w-md mb-8">
            Satu ekosistem digital untuk manajemen registrasi, pengambilan racepack QR, hingga akurasi live timing kit iZT.
          </p>
          <motion.button
            whileHover={{ scale: 1.03 }}
            onClick={() => navigate("/event")}
            className="px-8 py-3.5 bg-slate-900 text-white rounded-full font-bold shadow-lg hover:shadow-xl transition-shadow active:scale-95"
          >
            Mulai Jelajah
          </motion.button>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
