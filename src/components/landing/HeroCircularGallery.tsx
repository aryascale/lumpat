import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const imageIds = [
  "1552674605-15cff24f36e6", // Running
  "1476480862126-209bcaa8ea6a", // Marathon
  "1530549595564-7bc1ab3d36ea", // Track
  "1502224562085-639558d11aa6", // Sprint
  "1571008840902-2465e180d588", // Trail
  "1534438327276-14e5300c3a48", // Shoes
  "1486218119243-13883505764c", // Fitness
  "1533681436813-f66f91f7a078", // Finish line
];

const PLACEHOLDER_IMAGES = Array.from({ length: 24 }).map(
  (_, i) =>
    `https://images.unsplash.com/photo-${
      imageIds[i % imageIds.length]
    }?w=400&q=80&auto=format&fit=crop`
);

export default function HeroCircularGallery() {
  const navigate = useNavigate();
  const [radius, setRadius] = useState(320);
  const [isExploded, setIsExploded] = useState(false);

  // Responsive radius
  useEffect(() => {
    const handleResize = () => {
      setRadius(window.innerWidth < 768 ? 120 : 320);
    };
    handleResize(); // Set initial
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 1.2s delay for Explosion Trigger
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExploded(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-[100svh] flex items-center justify-center bg-[#F1F3F6] overflow-hidden">
      {/* The Main Animation Asset: Outer Container */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        
        {/* Infinite Rotating Container */}
        <motion.div
          animate={isExploded ? { rotate: 360 } : { rotate: 0 }}
          transition={
            isExploded
              ? { duration: 60, ease: "linear", repeat: Infinity }
              : { duration: 0 }
          }
          style={{ willChange: "transform" }}
          className="relative w-0 h-0 flex items-center justify-center"
        >
          {PLACEHOLDER_IMAGES.map((src, i) => {
            const angle = (i / 24) * 2 * Math.PI;
            const targetX = Math.cos(angle) * radius;
            const targetY = Math.sin(angle) * radius;
            // Align perfectly pointing outward
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
                    scale: i === 0 ? 0.2 : 0,
                    opacity: i === 0 ? 0 : 0,
                    rotate: 0,
                  }}
                  animate={{
                    x: isExploded ? targetX : 0,
                    y: isExploded ? targetY : 0,
                    scale: isExploded ? 1 : i === 0 ? 1.5 : 0,
                    opacity: isExploded ? 1 : i === 0 ? 1 : 0,
                    rotate: isExploded ? targetRotation : 0,
                  }}
                  transition={{
                    // Explosion uses spring physics, the initial intro uses cubic bezier
                    type: isExploded ? "spring" : "tween",
                    stiffness: isExploded ? 40 : undefined,
                    damping: isExploded ? 12 : undefined,
                    delay: isExploded ? i * 0.015 : 0,
                    duration: isExploded ? undefined : 1.2,
                    ease: isExploded ? undefined : [0.16, 1, 0.3, 1],
                  }}
                  className="w-[36px] h-[48px] md:w-[55px] md:h-[75px] overflow-hidden rounded-md shadow-md border border-white/50 bg-white"
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
        initial={{ y: 30, opacity: 0 }}
        animate={{
          y: isExploded ? 0 : 30,
          opacity: isExploded ? 1 : 0,
        }}
        transition={{
          delay: isExploded ? 0.3 : 0, // Wait slightly after explosion starts
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
    </div>
  );
}
