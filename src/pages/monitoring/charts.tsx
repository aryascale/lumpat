import { useState } from 'react';

export interface ChartPoint {
  t: number;
  v: number;
}

function fmtTimeLabel(t: number, withDate: boolean) {
  const d = new Date(t * 60000);
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  if (!withDate) return time;
  return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })} ${time}`;
}

export function AreaChart({
  points,
  height = 220,
  accent = '#e5484d',
  valueLabel = 'requests',
}: {
  points: ChartPoint[];
  height?: number;
  accent?: string;
  valueLabel?: string;
}) {
  const [hover, setHover] = useState<{ i: number; xPct: number; yPct: number } | null>(null);
  const n = points.length;
  const max = Math.max(1, ...points.map((p) => p.v));
  const withDate = n > 180;

  const linePath = points
    .map((p, i) => {
      const x = n === 1 ? 0 : (i / (n - 1)) * 1000;
      const y = 96 - (p.v / max) * 88;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const areaPath = n > 0 ? `${linePath} L1000,100 L0,100 Z` : '';
  const gradId = `grad-${accent.replace('#', '')}`;

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const i = Math.round(relX * (n - 1));
    const yPct = 96 - (points[i].v / max) * 88;
    setHover({ i, xPct: (i / (n - 1)) * 100, yPct });
  };

  const labelIndices: number[] = [];
  const labelCount = Math.min(6, n);
  for (let k = 0; k < labelCount; k++) {
    labelIndices.push(Math.round((k / (labelCount - 1 || 1)) * (n - 1)));
  }

  return (
    <div
      className="relative select-none"
      style={{ height }}
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
    >
      {[25, 50, 75].map((pct) => (
        <div key={pct} className="absolute left-0 right-0 border-t border-white/[0.06]" style={{ top: `${pct}%` }} />
      ))}
      <div className="absolute -top-1 right-0 text-[10px] text-slate-500 font-mono">{max}</div>

      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {areaPath && <path d={areaPath} fill={`url(#${gradId})`} />}
        {linePath && (
          <path d={linePath} fill="none" stroke={accent} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
        )}
      </svg>

      {hover && (
        <>
          <div className="absolute top-0 bottom-0 w-px bg-white/20" style={{ left: `${hover.xPct}%` }} />
          <div
            className="absolute w-2.5 h-2.5 rounded-full border-2 border-[#0a0c10] -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${hover.xPct}%`, top: `${hover.yPct}%`, background: accent }}
          />
          <div
            className="absolute -translate-x-1/2 -translate-y-[calc(100%+10px)] pointer-events-none z-10"
            style={{ left: `min(max(${hover.xPct}%, 60px), calc(100% - 60px))` }}
          >
            <div className="bg-[#14171d] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs shadow-xl whitespace-nowrap">
              <div className="text-slate-400 font-mono">{fmtTimeLabel(points[hover.i].t, withDate)}</div>
              <div className="text-slate-100 font-semibold font-mono">
                {points[hover.i].v.toLocaleString('id-ID')} <span className="text-slate-500 font-normal">{valueLabel}</span>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="absolute -bottom-5 left-0 right-0 flex justify-between text-[10px] text-slate-500 font-mono">
        {labelIndices.map((idx) => (
          <span key={idx}>{fmtTimeLabel(points[idx].t, withDate)}</span>
        ))}
      </div>
    </div>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  segments,
  size = 150,
  thickness = 16,
  centerValue,
  centerLabel,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerValue: string;
  centerLabel: string;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
        {total > 0 &&
          segments
            .filter((s) => s.value > 0)
            .map((seg) => {
              const frac = seg.value / total;
              const dash = `${frac * c} ${c}`;
              const el = (
                <circle
                  key={seg.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset * c}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  className="transition-all duration-500"
                />
              );
              offset += frac;
              return el;
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-slate-100 font-mono">{centerValue}</span>
        <span className="text-[10px] text-slate-500 uppercase tracking-wider">{centerLabel}</span>
      </div>
    </div>
  );
}

export function BarMeter({
  label,
  percent,
  sub,
  warn = 60,
  danger = 85,
}: {
  label: string;
  percent: number;
  sub?: string;
  warn?: number;
  danger?: number;
}) {
  const p = Math.min(100, Math.max(0, percent));
  const color = p >= danger ? 'bg-red-500' : p >= warn ? 'bg-amber-400' : 'bg-emerald-400';
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs text-slate-400">{label}</span>
        <span className="text-sm font-semibold font-mono text-slate-100">{p.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${p}%` }} />
      </div>
      {sub && <div className="mt-1 text-[10px] text-slate-500 font-mono">{sub}</div>}
    </div>
  );
}

export function LatencyBars({ items }: { items: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-xs text-slate-400 font-mono">{item.label}</span>
            <span className="text-sm font-semibold font-mono text-slate-100">{item.value} ms</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
            <div
              className="h-full rounded-full bg-sky-400/80 transition-all duration-500"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
