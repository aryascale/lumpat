"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";

const items = [
    { image: "/Assets/landing2/PRO TIME DECODER.png", title: "Pro Time Decoder", subtitle: "CORE SYSTEM" },
    { image: "/Assets/landing2/MAGIC ANTENNA.png", title: "Magic Antenna", subtitle: "ANTENNA GRID" },
    { image: "/Assets/landing2/Active Chip.png", title: "Active Chip", subtitle: "REUSABLE TAG" },
    { image: "/Assets/landing2/RUNNING Chip.png", title: "Running Chip", subtitle: "DISPOSABLE TAG" },
    { image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=800&auto=format&fit=crop", title: "System Sync", subtitle: "INTEGRATION" },
    { image: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=800&auto=format&fit=crop", title: "Live Tracking", subtitle: "SOFTWARE" },
    { image: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?q=80&w=800&auto=format&fit=crop", title: "Cloud Portal", subtitle: "WEB PLATFORM" },
    { image: "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?q=80&w=800&auto=format&fit=crop", title: "Analytics", subtitle: "DATA METRICS" },
    { image: "https://images.unsplash.com/photo-1504639725590-34d0984388bd?q=80&w=800&auto=format&fit=crop", title: "Support", subtitle: "24/7 SERVICE" },
];

export const CoolBentoEffect = ({ className }: { className?: string }) => {
    const [activeRow, setActiveRow] = useState(1);
    const [activeCol, setActiveCol] = useState(1);

    const gridTemplateRows = [
        activeRow === 0 ? "3fr" : "1fr",
        activeRow === 1 ? "3fr" : "1fr",
        activeRow === 2 ? "3fr" : "1fr",
    ].join(" ");

    const gridTemplateColumns = [
        activeCol === 0 ? "3fr" : "1fr",
        activeCol === 1 ? "3fr" : "1fr",
        activeCol === 2 ? "3fr" : "1fr",
    ].join(" ");

    return (
        <div className={cn("flex items-center justify-center p-4 w-full h-full min-h-[400px]", className)}>
            <motion.div
                className="grid gap-3 w-full h-full max-w-[900px] max-h-[700px] aspect-[4/3]"
                animate={{
                    gridTemplateRows,
                    gridTemplateColumns,
                }}
                onMouseLeave={() => {
                    setActiveRow(1);
                    setActiveCol(1);
                }}
                transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
            >
                {Array.from({ length: 9 }).map((_, i) => {
                    const row = Math.floor(i / 3);
                    const col = i % 3;
                    const isActive = activeRow === row && activeCol === col;

                    return (
                        <motion.div
                            key={i}
                            layout
                            className={cn(
                                "relative overflow-hidden rounded-2xl cursor-pointer group border border-zinc-200/50 shadow-lg transition-shadow duration-500",
                                isActive ? "z-20 shadow-2xl scale-[1.02]" : "z-0 opacity-80 grayscale-[0.5] hover:opacity-100 hover:grayscale-0"
                            )}
                            onMouseEnter={() => {
                                setActiveRow(row);
                                setActiveCol(col);
                            }}
                        >
                            <motion.div
                                layout
                                className="absolute inset-0 w-full h-full bg-white flex items-center justify-center p-4 transition-transform duration-700 group-hover:scale-110"
                            >
                                <img
                                    src={items[i].image}
                                    alt={items[i].title}
                                    className="max-w-full max-h-full object-contain"
                                    style={i < 4 ? { filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.2))' } : { objectFit: 'cover', width: '100%', height: '100%' }}
                                />
                            </motion.div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-30 transition-opacity duration-500" />

                            <div className="absolute bottom-4 left-4 z-30 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                                <p className="text-white text-[10px] font-black tracking-[0.2em] uppercase mb-1">
                                    {items[i].subtitle}
                                </p>
                                <h3 className="text-white text-sm font-bold truncate max-w-[150px]">
                                    {items[i].title}
                                </h3>
                            </div>

                            {/* Glow effect for active item */}
                            {isActive && (
                                <motion.div
                                    layoutId="active-glow"
                                    className="absolute inset-0 ring-2 ring-red-500/50 pointer-events-none"
                                />
                            )}
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
};

export default CoolBentoEffect;
