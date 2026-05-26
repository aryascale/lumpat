import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

// ─── Triathlon-focused Unsplash images: swim, bike, run ───
const GALLERY_IMAGES = [
  // 1
  "https://plus.unsplash.com/premium_photo-1661963958813-dd7402cc7caa?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8dHJpYXRobG9uJTIwY29tcGV0aXRpb258ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 2
  "https://images.unsplash.com/photo-1658748721978-68fc04f3739b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJpYXRobG9uJTIwY29tcGV0aXRpb258ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 3
  "https://images.unsplash.com/photo-1533547477463-bcffb9ef386d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8dHJpYXRobG9uJTIwY29tcGV0aXRpb258ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 4
  "https://images.unsplash.com/photo-1576858574144-9ae1ebcf5ae5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8NHx8dHJpYXRobG9uJTIwY29tcGV0aXRpb258ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 5
  "https://plus.unsplash.com/premium_photo-1661964408302-d88b6e98322a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8NXx8dHJpYXRobG9uJTIwY29tcGV0aXRpb258ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 6
  "https://images.unsplash.com/photo-1627156399021-721b0f720f8d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Nnx8dHJpYXRobG9uJTIwY29tcGV0aXRpb258ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 7
  "https://images.unsplash.com/photo-1628689529124-3e0db67e984c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8N3x8dHJpYXRobG9uJTIwY29tcGV0aXRpb258ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 8
  "https://images.unsplash.com/photo-1695808403904-a43973fb42a6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8OHx8dHJpYXRobG9uJTIwY29tcGV0aXRpb258ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 9
  "https://plus.unsplash.com/premium_photo-1661964347110-8972b7e1569c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8OXx8dHJpYXRobG9uJTIwY29tcGV0aXRpb258ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 10
  "https://images.unsplash.com/photo-1716462420479-5a6ae7436425?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MTB8fHRyaWF0aGxvbiUyMGNvbXBldGl0aW9ufGVufDB8fHx8MTc3OTc4Mjk0OXww&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 11
  "https://images.unsplash.com/photo-1533049426476-9a889e21ece5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MTF8fHRyaWF0aGxvbiUyMGNvbXBldGl0aW9ufGVufDB8fHx8MTc3OTc4Mjk0OXww&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 12
  "https://images.unsplash.com/photo-1633114078244-353b1ce7b096?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MTJ8fHRyaWF0aGxvbiUyMGNvbXBldGl0aW9ufGVufDB8fHx8MTc3OTc4Mjk0OXww&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 13
  "https://plus.unsplash.com/premium_photo-1664302497172-b759cbdc1b6a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MTN8fHRyaWF0aGxvbiUyMGNvbXBldGl0aW9ufGVufDB8fHx8MTc3OTc4Mjk0OXww&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 14
  "https://images.unsplash.com/photo-1720423753777-d40550822d63?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MTR8fHRyaWF0aGxvbiUyMGNvbXBldGl0aW9ufGVufDB8fHx8MTc3OTc4Mjk0OXww&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 15
  "https://images.unsplash.com/photo-1580748386343-376c85dd4887?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MTV8fHRyaWF0aGxvbiUyMGNvbXBldGl0aW9ufGVufDB8fHx8MTc3OTc4Mjk0OXww&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 16
  "https://images.unsplash.com/photo-1728454994678-21be5481e249?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MTZ8fHRyaWF0aGxvbiUyMGNvbXBldGl0aW9ufGVufDB8fHx8MTc3OTc4Mjk0OXww&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 17
  "https://plus.unsplash.com/premium_photo-1661964350721-92fd41ac1e9f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MTd8fHRyaWF0aGxvbiUyMGNvbXBldGl0aW9ufGVufDB8fHx8MTc3OTc4Mjk0OXww&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 18
  "https://images.unsplash.com/photo-1633653872373-b3fd8eaf72a6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MTh8fHRyaWF0aGxvbiUyMGNvbXBldGl0aW9ufGVufDB8fHx8MTc3OTc4Mjk0OXww&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 19
  "https://images.unsplash.com/photo-1512203492609-972c16baa28b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MTl8fHRyaWF0aGxvbiUyMGNvbXBldGl0aW9ufGVufDB8fHx8MTc3OTc4Mjk0OXww&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 20
  "https://images.unsplash.com/photo-1627900258552-50850df9dbc5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MjB8fHRyaWF0aGxvbiUyMGNvbXBldGl0aW9ufGVufDB8fHx8MTc3OTc4Mjk0OXww&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 21
  "https://plus.unsplash.com/premium_photo-1664297510120-354f5adbb9eb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8cnVubmluZyUyMHJhY2V8ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 22
  "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cnVubmluZyUyMHJhY2V8ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 23
  "https://images.unsplash.com/photo-1502904550040-7534597429ae?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8cnVubmluZyUyMHJhY2V8ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
  // 24
  "https://images.unsplash.com/photo-1590333748338-d629e4564ad9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8NHx8cnVubmluZyUyMHJhY2V8ZW58MHx8fHwxNzc5NzgyOTQ5fDA&ixlib=rb-4.1.0&w=200&h=260&fit=crop",
];

const TOTAL_CARDS = 24;
const PHASE_DURATION_MS = 4000;

type Phase = "init" | "circle" | "splash";

// ─── Deterministic seeded random generator for stable splash offsets ───
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function generateSplashSeeds(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const s = i + 42; // stable seed base
    return {
      x: (seededRandom(s * 1) - 0.5) * 340,        // -170 to +170
      y: (seededRandom(s * 2) - 0.5) * 340,        // -170 to +170
      rot: (seededRandom(s * 3) - 0.5) * 120,      // -60 to +60
    };
  });
}

export default function HeroCircularGallery() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("init");
  const [isMobile, setIsMobile] = useState(false);
  const [masterRotation, setMasterRotation] = useState(0);

  // ─── Deterministic splash offsets (never re-generated) ───
  const splashSeeds = useMemo(() => generateSplashSeeds(TOTAL_CARDS), []);

  // ─── Responsive observer ───
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ─── Initial entrance delay: Intro Focus Stage ───
  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase("splash");
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // ─── 3-Phase State Machine Loop ───
  useEffect(() => {
    if (phase === "init") return;

    const interval = setInterval(() => {
      setPhase((prev) => (prev === "circle" ? "splash" : "circle"));
    }, PHASE_DURATION_MS);

    return () => clearInterval(interval);
  }, [phase === "init"]);

  // ─── Master container slow rotation (accumulates over time) ───
  useEffect(() => {
    if (phase === "init") return;

    let animFrame: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      // Rotate at ~6 deg/sec during circle, pause (0 deg/sec) during splash
      const speed = phase === "circle" ? 6 : 0;
      setMasterRotation((prev) => prev + speed * dt);
      animFrame = requestAnimationFrame(tick);
    };

    animFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animFrame);
  }, [phase]);

  // ─── Responsive dimensions ───
  const radius = isMobile ? 125 : 340;
  const cardW = isMobile ? 38 : 60;
  const cardH = isMobile ? 50 : 80;

  return (
    <section
      id="hero-gallery"
      className="relative w-full overflow-hidden flex items-center justify-center"
      style={{
        height: "100svh",
        background: "linear-gradient(180deg, #F1F3F6 0%, #EAECF0 50%, #F1F3F6 100%)",
      }}
    >
      {/* Subtle radial glow behind the orbit */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: isMobile ? 300 : 800,
          height: isMobile ? 300 : 800,
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle, rgba(204,255,0,0.06) 0%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />

      {/* ─── Rotating Master Container ─── */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ willChange: "transform" }}
      >
        <div
          style={{
            transform: `rotate(${masterRotation}deg)`,
            willChange: "transform",
            width: 0,
            height: 0,
            position: "relative",
          }}
        >
          {GALLERY_IMAGES.map((src, index) => {
            const angle = (index / TOTAL_CARDS) * 2 * Math.PI;
            const isInit = phase === "init";
            const isSplash = phase === "splash";

            // ─── Position math ───
            const circleX = Math.cos(angle) * radius;
            const circleY = Math.sin(angle) * radius;
            const tangentialRot = (angle + Math.PI / 2) * (180 / Math.PI);

            const targetX = isInit ? 0 : (isSplash
              ? circleX + splashSeeds[index].x * (isMobile ? 0.55 : 1)
              : circleX);
            const targetY = isInit ? 0 : (isSplash
              ? circleY + splashSeeds[index].y * (isMobile ? 0.55 : 1)
              : circleY);
            const targetRotation = isInit ? 0 : (isSplash
              ? splashSeeds[index].rot
              : tangentialRot);

            // Counter-rotate text/cards so they don't spin with master
            const counterRotate = isInit ? 0 : (isSplash ? 0 : -masterRotation);

            return (
              <motion.div
                key={index}
                initial={{
                  x: 0,
                  y: 0,
                  scale: index === 0 ? 0.2 : 0,
                  opacity: index === 0 ? 0 : 0,
                  rotate: 0,
                }}
                animate={{
                  x: targetX,
                  y: targetY,
                  scale: isInit ? (index === 0 ? 1.6 : 0) : 1,
                  opacity: isInit ? (index === 0 ? 1 : 0) : (isSplash ? 0.7 : 1),
                  rotate: targetRotation + counterRotate,
                }}
                transition={{
                  type: "spring",
                  stiffness: isInit ? 40 : (isSplash ? 25 : 40),
                  damping: isInit ? 15 : (isSplash ? 12 : 15),
                  mass: 1.1,
                  delay: isInit ? 0 : (isSplash
                    ? index * 0.015
                    : index * 0.02),
                }}
                className="absolute"
                style={{
                  width: cardW,
                  height: cardH,
                  marginLeft: -cardW / 2,
                  marginTop: -cardH / 2,
                  zIndex: isInit && index === 0 ? 50 : 1,
                  willChange: "transform",
                }}
              >
                <div
                  className="w-full h-full rounded-lg overflow-hidden shadow-md transition-shadow"
                  style={{
                    background: "#E8EAED",
                    boxShadow: isInit && index === 0 
                      ? "0 20px 40px rgba(0,0,0,0.25)"
                      : (isSplash
                        ? "0 8px 32px rgba(0,0,0,0.18)"
                        : "0 4px 16px rgba(0,0,0,0.10)"),
                  }}
                >
                  <img
                    src={src}
                    alt={`Event photo ${index + 1}`}
                    loading={index < 8 ? "eager" : "lazy"}
                    className="w-full h-full object-cover"
                    style={{ willChange: "transform" }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ─── Centered Hero Copy ─── */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{
          y: phase === "init" ? 40 : 0,
          opacity: phase === "init" ? 0 : 1,
        }}
        transition={{
          delay: phase === "init" ? 0 : 0.2,
          duration: 1.2,
          ease: [0.16, 1, 0.3, 1],
        }}
        className="relative z-40 flex flex-col items-center text-center pointer-events-auto"
        style={{
          maxWidth: isMobile ? 240 : 520,
          padding: isMobile ? "0 12px" : "0 24px",
        }}
      >
        {/* Headline — matching original design */}
        <h1 className="flex flex-col items-center justify-center tracking-tight mb-4 md:mb-5">
          <span
            className="font-normal"
            style={{
              fontSize: isMobile ? 20 : 36,
              color: "#94A3B8",
              marginBottom: isMobile ? 4 : 12,
            }}
          >
            The future of
          </span>
          <span
            className="font-semibold leading-[1.1]"
            style={{
              fontSize: isMobile ? 28 : 56,
              color: "#0F172A",
            }}
          >
            Running Events
          </span>
        </h1>

        {/* Sub-headline */}
        <p
          className="font-medium leading-relaxed text-center"
          style={{
            fontSize: isMobile ? 11 : 15,
            color: "#64748B",
            maxWidth: isMobile ? 220 : 420,
            marginBottom: isMobile ? 24 : 36,
          }}
        >
          Satu ekosistem digital untuk manajemen registrasi,
          pengambilan racepack QR, hingga akurasi live timing kit iZT.
        </p>

        {/* CTA Buttons */}
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate("/event")}
            className="cursor-pointer font-semibold rounded-full shadow-lg transition-colors"
            style={{
              padding: isMobile ? "10px 20px" : "14px 32px",
              fontSize: isMobile ? 11 : 14,
              background: "#0F172A",
              color: "#FFFFFF",
            }}
          >
            Lihat Event
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              document.getElementById("platform")?.scrollIntoView({ behavior: "smooth" });
            }}
            className="cursor-pointer font-semibold rounded-full transition-colors"
            style={{
              padding: isMobile ? "10px 20px" : "14px 32px",
              fontSize: isMobile ? 11 : 14,
              background: "transparent",
              color: "#0F172A",
              border: "1.5px solid rgba(15,23,42,0.2)",
            }}
          >
            Lihat Platform
          </motion.button>
        </div>
      </motion.div>

      {/* ─── Bottom fade-out gradient ─── */}
      <div
        className="absolute bottom-0 left-0 w-full pointer-events-none"
        style={{
          height: 100,
          background: "linear-gradient(to top, #F1F3F6 0%, transparent 100%)",
        }}
      />
    </section>
  );
}
