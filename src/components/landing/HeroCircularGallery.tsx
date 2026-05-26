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
  const [radius, setRadius] = useState(250);

  useEffect(() => {
    const handleResize = () => {
      setRadius(window.innerWidth < 768 ? 130 : 250);
    };
    handleResize(); // Set initial
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="relative w-full h-[100svh] flex items-center justify-center bg-[#F1F3F6] overflow-hidden">
      {/* The Main Animation Asset: Outer Container zooming in */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{
          duration: 1.5,
          ease: [0.16, 1, 0.3, 1], // custom power4 out
        }}
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
      >
        {/* Infinite Rotating Container */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{
            duration: 45,
            ease: "linear",
            repeat: Infinity,
          }}
          style={{ willChange: "transform" }}
          className="relative w-0 h-0"
        >
          {PLACEHOLDER_IMAGES.map((src, i) => {
            const angle = (i / 24) * 2 * Math.PI;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            // Align perfectly pointing outward
            const rotation = angle * (180 / Math.PI) + 90;

            return (
              <div
                key={i}
                className="absolute w-8 h-11 md:w-12 md:h-16 overflow-hidden rounded-md shadow-md border border-white/50 bg-white"
                style={{
                  transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg)`,
                }}
              >
                <img
                  src={src}
                  alt={`Runner event ${i}`}
                  className="w-full h-full object-cover"
                />
              </div>
            );
          })}
        </motion.div>
      </motion.div>

      {/* Centered Hero Content */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{
          delay: 0.5,
          duration: 1.2,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative z-10 flex flex-col items-center text-center max-w-2xl px-6"
      >
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 leading-[1.1] md:leading-[1.05] tracking-tight mb-4">
          The Future of <br className="hidden md:block" />
          Running Events.
        </h1>
        <p className="text-slate-600 text-sm md:text-base font-medium leading-relaxed max-w-md mb-8">
          Platform registrasi event lari terintegrasi dengan akurasi real-time timing kit iZT dan sistem digital QR code.
        </p>
        <button
          onClick={() => navigate("/event")}
          className="px-8 py-3.5 bg-slate-900 text-white rounded-full font-bold shadow-lg hover:shadow-xl hover:bg-slate-800 transition-all hover:-translate-y-1 active:scale-95"
        >
          Mulai Jelajah
        </button>
      </motion.div>
    </div>
  );
}
