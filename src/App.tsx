import { useState, useEffect, useRef } from "react";

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

interface Bubble {
  id: number;
  x: number;
  y: number;
  r: number;
  speed: number;
  opacity: number;
}

// ── Coil condenser geometry ──────────────────────────────────────────────────
// Vertical coil, centered at x=490, starting y=170, each loop is an ellipse
const COIL_CX = 490;
const COIL_TOP = 178;
const COIL_RX = 38;       // half-width of each ellipse
const COIL_RY = 14;       // half-height (depth perspective)
const COIL_PITCH = 30;    // vertical gap between loop centers
const COIL_COUNT = 7;     // number of full loops

// Build the coil path as a series of connected half-ellipses (serpentine)
function buildCoilPath(): string {
  // We trace the CENTER path of the coil tube going down
  // Alternating: right arc (top half) → drop → left arc (bottom half) → drop ...
  let d = "";
  for (let i = 0; i < COIL_COUNT; i++) {
    const cy = COIL_TOP + i * COIL_PITCH;
    if (i === 0) {
      // Start at top-left of first loop
      d += `M ${COIL_CX - COIL_RX},${cy}`;
    }
    // Right-going arc (top of ellipse going right)
    d += ` A ${COIL_RX} ${COIL_RY} 0 0 1 ${COIL_CX + COIL_RX},${cy}`;
    // Drop to bottom of this loop (half pitch down)
    const cy2 = cy + COIL_PITCH / 2;
    d += ` A ${COIL_RX} ${COIL_RY} 0 0 1 ${COIL_CX - COIL_RX},${cy2}`;
  }
  return d;
}
const COIL_PATH = buildCoilPath();

// Total approximate length of the coil path for stroke-dasharray animation
const COIL_TOTAL_LENGTH = COIL_COUNT * 2 * Math.PI * Math.sqrt((COIL_RX ** 2 + COIL_RY ** 2) / 2) + 10;

export default function App() {
  const [running, setRunning] = useState(false);
  const [temp, setTemp] = useState(25);
  const [flaskLevel, setFlaskLevel] = useState(70);
  const [collectLevel, setCollectLevel] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [drops, setDrops] = useState<{ id: number; y: number; opacity: number }[]>([]);
  const [vaporOffset, setVaporOffset] = useState(0);
  const [coilOffset, setCoilOffset] = useState(0);
  const [waterOffset, setWaterOffset] = useState(0);
  const [flameFlicker, setFlameFlicker] = useState(1);
  const [step, setStep] = useState(0);
  const nextId = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastTime = useRef<number>(0);

  const handleReset = () => {
    setRunning(false);
    setTemp(25);
    setFlaskLevel(70);
    setCollectLevel(0);
    setBubbles([]);
    setDrops([]);
    setVaporOffset(0);
    setCoilOffset(0);
    setWaterOffset(0);
    setStep(0);
  };

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = (ts: number) => {
      const dt = Math.min((ts - lastTime.current) / 1000, 0.1);
      lastTime.current = ts;

      setTemp((t) => {
        const target = 78.4;
        return t < target ? clamp(t + dt * 4, 25, target) : target;
      });

      setFlaskLevel((fl) => (fl > 10 ? fl - dt * 0.4 : fl));
      setCollectLevel((cl) => (cl < 95 ? cl + dt * 0.35 : cl));

      setBubbles((bs) => {
        let next = bs
          .map((b) => ({
            ...b,
            y: b.y - b.speed * dt * 80,
            opacity: b.y < 268 ? b.opacity - 0.07 : b.opacity,
          }))
          .filter((b) => b.opacity > 0);
        if (next.length < 14 && Math.random() < 0.4) {
          next = [
            ...next,
            {
              id: nextId.current++,
              x: 188 + (Math.random() - 0.5) * 56,
              y: 320,
              r: 2 + Math.random() * 4,
              speed: 0.5 + Math.random() * 0.8,
              opacity: 0.75,
            },
          ];
        }
        return next;
      });

      // Vapor in inlet tube
      setVaporOffset((v) => (v + dt * 70) % 40);
      // Vapor traveling through coil
      setCoilOffset((v) => (v + dt * 55) % 30);
      // Cooling water animation (flows upward = offset decreasing)
      setWaterOffset((v) => (v - dt * 35 + 200) % 200);

      setDrops((ds) => {
        let next = ds
          .map((d) => ({
            ...d,
            y: d.y + dt * 130,
            opacity: d.y > 590 ? d.opacity - 0.09 : d.opacity,
          }))
          .filter((d) => d.opacity > 0);
        if (next.length < 5 && Math.random() < 0.28) {
          next = [...next, { id: nextId.current++, y: 508, opacity: 1 }];
        }
        return next;
      });

      setFlameFlicker(0.88 + Math.random() * 0.24);

      setStep(() => {
        if (temp < 50) return 0;
        if (temp < 78) return 1;
        return 2;
      });

      rafRef.current = requestAnimationFrame(tick);
    };
    lastTime.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running, temp]);

  const boiling = temp >= 78.4;
  const vaporVisible = temp > 55;

  const flaskLiquidY = 265 + (1 - flaskLevel / 100) * 75;
  const collectH = (collectLevel / 100) * 72;
  const collectY = 608 - collectH;

  const steps = [
    { label: "Đun nóng hỗn hợp rượu – nước", color: "#f59e0b" },
    { label: "Hơi ethanol bay qua ống sinh hàn ruột gà", color: "#3b82f6" },
    { label: "Hơi ngưng tụ, ethanol chảy vào bình hứng", color: "#10b981" },
  ];

  // Coil bounding box for jacket
  const jacketTop = COIL_TOP - COIL_RY - 10;
  const jacketBot = COIL_TOP + COIL_COUNT * COIL_PITCH + COIL_RY + 2;
  const jacketLeft = COIL_CX - COIL_RX - 20;
  const jacketRight = COIL_CX + COIL_RX + 20;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800 flex flex-col items-center py-8 px-4 font-sans">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight drop-shadow">
          🧪 Thiết Bị Chưng Cất Đơn Giản
        </h1>
        <p className="mt-1 text-blue-300 text-sm md:text-base">
          Hỗn hợp Rượu (Ethanol) – Nước &nbsp;|&nbsp; Ống sinh hàn kiểu{" "}
          <span className="font-semibold text-cyan-300">Ruột Gà (Coil Condenser)</span>
          &nbsp;|&nbsp; Điểm sôi ethanol:{" "}
          <span className="font-semibold text-yellow-300">78,4 °C</span>
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-6xl items-start justify-center">
        {/* SVG Diagram */}
        <div className="flex-shrink-0 bg-white/5 border border-white/10 rounded-3xl p-4 shadow-2xl backdrop-blur">
          <svg
            width="680"
            height="700"
            viewBox="0 0 680 700"
            className="w-full max-w-[680px]"
            style={{ fontFamily: "sans-serif" }}
          >
            <defs>
              {/* Flask glass */}
              <radialGradient id="glassGrad" cx="38%" cy="38%">
                <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.12" />
              </radialGradient>
              {/* Liquid in flask */}
              <linearGradient id="liquidGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.92" />
              </linearGradient>
              {/* Flame */}
              <radialGradient id="flameGrad" cx="50%" cy="80%">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
              </radialGradient>
              {/* Condenser jacket */}
              <linearGradient id="jacketGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.18" />
                <stop offset="40%" stopColor="#bae6fd" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.18" />
              </linearGradient>
              {/* Collected liquid */}
              <linearGradient id="collectGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.88" />
              </linearGradient>
              {/* Water flow in jacket – blue shimmer */}
              <linearGradient id="waterFlowGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.0" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
              </linearGradient>

              {/* Clip paths */}
              <clipPath id="flaskClip">
                <path d="M163,252 Q163,236 188,234 Q213,232 213,252 L228,345 Q238,378 188,382 Q138,378 148,345 Z" />
              </clipPath>
              <clipPath id="beakerClip">
                <rect x="436" y="540" width="72" height="72" />
              </clipPath>
              {/* Clip the jacket rectangle to round corners */}
              <clipPath id="jacketClip">
                <rect
                  x={jacketLeft}
                  y={jacketTop}
                  width={jacketRight - jacketLeft}
                  height={jacketBot - jacketTop}
                  rx="12"
                />
              </clipPath>
            </defs>

            {/* Grid */}
            {Array.from({ length: 15 }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 50} x2="680" y2={i * 50} stroke="white" strokeOpacity="0.025" />
            ))}
            {Array.from({ length: 14 }).map((_, i) => (
              <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="700" stroke="white" strokeOpacity="0.025" />
            ))}

            {/* ═══════════════════════════════════
                GIÁ ĐỠ SẮT (Iron stand)
            ═══════════════════════════════════ */}
            {/* Base plate */}
            <rect x="56" y="608" width="162" height="13" rx="4" fill="#94a3b8" />
            {/* Vertical rod */}
            <rect x="114" y="248" width="9" height="360" rx="3" fill="#64748b" />
            {/* Horizontal arm */}
            <rect x="114" y="325" width="76" height="8" rx="3" fill="#64748b" />
            {/* Clamp ring on arm */}
            <ellipse cx="190" cy="329" rx="11" ry="6" fill="none" stroke="#94a3b8" strokeWidth="3" />
            {/* Clamp screw */}
            <rect x="198" y="325" width="4" height="8" rx="1" fill="#78716c" />
            {/* Label */}
            <text x="56" y="472" textAnchor="end" fontSize="11" fill="#94a3b8" fontWeight="600">Giá đỡ</text>
            <line x1="58" y1="470" x2="114" y2="440" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />

            {/* ═══════════════════════════════════
                ĐÈN CỒN (Alcohol lamp)
            ═══════════════════════════════════ */}
            <rect x="152" y="562" width="72" height="48" rx="9" fill="#d97706" />
            <rect x="160" y="554" width="56" height="11" rx="3" fill="#b45309" />
            {/* liquid surface shimmer */}
            <rect x="165" y="558" width="46" height="3" rx="1" fill="#fbbf24" opacity="0.25" />
            {/* Wick holder */}
            <rect x="182" y="542" width="12" height="14" rx="3" fill="#92400e" />
            {/* Wick */}
            <rect x="186" y="530" width="5" height="16" rx="2" fill="#78716c" />
            {/* Flame */}
            {running && (
              <g transform={`translate(188,530)`}>
                <g transform={`scale(${flameFlicker}) translate(-10,-42)`}>
                  <ellipse cx="10" cy="30" rx="11" ry="30" fill="url(#flameGrad)" opacity="0.88" />
                  <ellipse cx="10" cy="36" rx="5.5" ry="18" fill="#fef08a" opacity="0.96" />
                  <ellipse cx="10" cy="40" rx="3" ry="10" fill="white" opacity="0.5" />
                </g>
              </g>
            )}
            {!running && (
              <circle cx="188" cy="530" r="3.5" fill="#f97316" opacity="0.4" />
            )}
            <text x="188" y="628" textAnchor="middle" fontSize="11" fill="#fde68a" fontWeight="600">
              Đèn cồn
            </text>

            {/* ═══════════════════════════════════
                BÌNH CẦU (Round-bottom flask)
            ═══════════════════════════════════ */}
            {/* Liquid */}
            <rect
              x="138"
              y={flaskLiquidY}
              width="102"
              height={345 - flaskLiquidY + 38}
              fill="url(#liquidGrad)"
              clipPath="url(#flaskClip)"
              opacity="0.88"
            />
            {/* Liquid surface shimmer */}
            {flaskLevel > 12 && (
              <ellipse
                cx="188"
                cy={flaskLiquidY}
                rx="40"
                ry="4"
                fill="#93c5fd"
                opacity="0.35"
              />
            )}

            {/* Bubbles */}
            {running &&
              bubbles.map((b) => (
                <circle
                  key={b.id}
                  cx={b.x}
                  cy={b.y}
                  r={b.r}
                  fill="none"
                  stroke="#bae6fd"
                  strokeWidth="1.5"
                  opacity={b.opacity}
                />
              ))}

            {/* Flask body outline */}
            <path
              d="M163,252 Q163,234 188,232 Q213,232 213,252 L230,345 Q242,382 188,385 Q134,382 146,345 Z"
              fill="url(#glassGrad)"
              stroke="#93c5fd"
              strokeWidth="2.5"
            />
            {/* Neck */}
            <rect x="176" y="198" width="24" height="56" rx="5" fill="url(#glassGrad)" stroke="#93c5fd" strokeWidth="2.5" />
            {/* Neck collar */}
            <rect x="172" y="195" width="32" height="8" rx="3" fill="#bae6fd" opacity="0.38" />
            {/* Side arm for vapor – angled tube */}
            <path d="M200,215 Q230,210 260,205 L295,196" fill="none" stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" />
            {/* Inner of side arm */}
            <path d="M200,215 Q230,210 260,205 L295,196" fill="none" stroke="#bae6fd" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            {/* Stopper */}
            <ellipse cx="188" cy="196" rx="14" ry="5.5" fill="#6b7280" opacity="0.72" />

            {/* Thermometer */}
            <rect x="181" y="152" width="5" height="50" rx="2.5" fill="#e2e8f0" opacity="0.55" stroke="#94a3b8" strokeWidth="0.5" />
            <circle cx="183" cy="204" r="4.5" fill="#ef4444" opacity="0.82" />
            <rect
              x="182"
              y={202 - (temp / 95) * 40}
              width="2.5"
              height={(temp / 95) * 40}
              rx="1"
              fill="#ef4444"
              opacity="0.84"
            />
            <text x="195" y="162" fontSize="10" fill="#fca5a5" fontWeight="700">
              {temp.toFixed(1)}°C
            </text>

            <text x="188" y="410" textAnchor="middle" fontSize="11" fill="#93c5fd" fontWeight="600">
              Bình cầu (hỗn hợp)
            </text>

            {/* ═══════════════════════════════════
                ỐNG NỐI HƠI → sinh hàn
            ═══════════════════════════════════ */}
            {/* Glass tube from side-arm to coil inlet */}
            <path
              d="M295,196 Q340,188 380,182 L452,175"
              fill="none"
              stroke="#93c5fd"
              strokeWidth="6"
              strokeLinecap="round"
            />
            <path
              d="M295,196 Q340,188 380,182 L452,175"
              fill="none"
              stroke="#bae6fd"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.45"
            />

            {/* Vapor dashes in inlet tube */}
            {vaporVisible && (
              <path
                d="M295,196 Q340,188 380,182 L452,175"
                fill="none"
                stroke="#c4b5fd"
                strokeWidth="3"
                strokeDasharray="12 10"
                strokeDashoffset={-vaporOffset}
                opacity="0.9"
              />
            )}
            {/* Arrow at entry */}
            {vaporVisible && (
              <polygon points="458,172 448,168 448,178" fill="#a78bfa" opacity="0.92" />
            )}

            {/* ═══════════════════════════════════
                ỐNG SINH HÀN RUỘT GÀ
                (Coil Condenser)
            ═══════════════════════════════════ */}

            {/* === Outer jacket glass === */}
            <rect
              x={jacketLeft}
              y={jacketTop}
              width={jacketRight - jacketLeft}
              height={jacketBot - jacketTop}
              rx="12"
              fill="url(#jacketGrad)"
              stroke="#7dd3fc"
              strokeWidth="2"
              opacity="0.85"
            />

            {/* === Cooling water fill inside jacket === */}
            <rect
              x={jacketLeft + 2}
              y={jacketTop + 2}
              width={jacketRight - jacketLeft - 4}
              height={jacketBot - jacketTop - 4}
              rx="11"
              fill="#0ea5e9"
              opacity="0.08"
              clipPath="url(#jacketClip)"
            />

            {/* Animated water shimmer bands flowing upward (counter-current) */}
            {[0, 40, 80, 120, 160].map((off, idx) => {
              const yPos = jacketTop + ((waterOffset + off) % (jacketBot - jacketTop + 60)) - 30;
              return (
                <rect
                  key={`ws${idx}`}
                  x={jacketLeft + 3}
                  y={yPos}
                  width={jacketRight - jacketLeft - 6}
                  height={28}
                  fill="url(#waterFlowGrad)"
                  clipPath="url(#jacketClip)"
                  opacity={running ? 0.55 : 0}
                />
              );
            })}

            {/* Vertical highlight lines on jacket glass */}
            <line
              x1={jacketLeft + 6}
              y1={jacketTop + 8}
              x2={jacketLeft + 6}
              y2={jacketBot - 8}
              stroke="white"
              strokeWidth="2"
              strokeOpacity="0.18"
              strokeLinecap="round"
            />
            <line
              x1={jacketRight - 6}
              y1={jacketTop + 8}
              x2={jacketRight - 6}
              y2={jacketBot - 8}
              stroke="white"
              strokeWidth="1"
              strokeOpacity="0.1"
              strokeLinecap="round"
            />

            {/* === COIL TUBE – back shadow for depth === */}
            <path
              d={COIL_PATH}
              fill="none"
              stroke="#0c4a6e"
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.55"
            />
            {/* === COIL TUBE – glass body === */}
            <path
              d={COIL_PATH}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.82"
            />
            {/* === COIL TUBE – inner highlight === */}
            <path
              d={COIL_PATH}
              fill="none"
              stroke="#e0f2fe"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.5"
            />
            {/* === VAPOR / CONDENSATE inside coil === */}
            {vaporVisible && (
              <path
                d={COIL_PATH}
                fill="none"
                stroke="#c084fc"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={`15 ${COIL_TOTAL_LENGTH}`}
                strokeDashoffset={-coilOffset * 8}
                opacity="0.85"
              />
            )}

            {/* === Vapor entry connector (top of coil) === */}
            {/* Short vertical tube from inlet pipe down to coil top-left */}
            <line
              x1={COIL_CX - COIL_RX}
              y1={COIL_TOP - 4}
              x2={COIL_CX - COIL_RX}
              y2={COIL_TOP + 4}
              stroke="#93c5fd"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Horizontal connector from inlet pipe to coil top */}
            <line
              x1="452"
              y1="175"
              x2={COIL_CX - COIL_RX}
              y2={COIL_TOP}
              stroke="#93c5fd"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Inner */}
            <line
              x1="452"
              y1="175"
              x2={COIL_CX - COIL_RX}
              y2={COIL_TOP}
              stroke="#bae6fd"
              strokeWidth="2"
              strokeLinecap="round"
              opacity="0.45"
            />

            {/* === Condensate outlet (bottom of coil) → drip tube === */}
            {/* coil ends at bottom-left: (COIL_CX - COIL_RX, COIL_TOP + COIL_COUNT*COIL_PITCH + COIL_PITCH/2) */}
            {(() => {
              const coilEndX = COIL_CX - COIL_RX;
              const coilEndY = COIL_TOP + COIL_COUNT * COIL_PITCH + COIL_PITCH / 2;
              const dropX = 508;
              return (
                <>
                  {/* Horizontal outlet tube */}
                  <line x1={coilEndX} y1={coilEndY} x2={dropX} y2={coilEndY}
                    stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" />
                  <line x1={coilEndX} y1={coilEndY} x2={dropX} y2={coilEndY}
                    stroke="#bae6fd" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
                  {/* Vertical drip tube down to beaker */}
                  <line x1={dropX} y1={coilEndY} x2={dropX} y2={506}
                    stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" />
                  <line x1={dropX} y1={coilEndY} x2={dropX} y2={506}
                    stroke="#bae6fd" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
                  {/* Elbow */}
                  <path d={`M${dropX},506 Q${dropX},516 ${dropX - 10},518 L472,518`}
                    fill="none" stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" />
                  {/* Into beaker */}
                  <line x1="472" y1="518" x2="472" y2="542"
                    stroke="#93c5fd" strokeWidth="6" strokeLinecap="round" />
                </>
              );
            })()}

            {/* === WATER IN pipe (bottom of jacket) === */}
            {/* Nước lạnh VÀO từ phía dưới (làm lạnh ngược chiều hơi) */}
            <line
              x1={jacketLeft - 2}
              y1={jacketBot - 14}
              x2={jacketLeft - 38}
              y2={jacketBot - 14}
              stroke="#0ea5e9"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <line
              x1={jacketLeft - 2}
              y1={jacketBot - 14}
              x2={jacketLeft - 38}
              y2={jacketBot - 14}
              stroke="#bae6fd"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.55"
            />
            {/* Arrow showing water flowing INTO jacket (right arrow) */}
            <polygon
              points={`${jacketLeft + 1},${jacketBot - 14} ${jacketLeft - 10},${jacketBot - 20} ${jacketLeft - 10},${jacketBot - 8}`}
              fill="#0ea5e9"
              opacity="0.9"
            />
            {/* Water IN label */}
            <text x={jacketLeft - 40} y={jacketBot - 19} textAnchor="end" fontSize="10" fill="#38bdf8" fontWeight="700">
              💧 Nước lạnh vào
            </text>
            <text x={jacketLeft - 40} y={jacketBot - 7} textAnchor="end" fontSize="9" fill="#7dd3fc">
              (từ dưới lên)
            </text>

            {/* === WATER OUT pipe (top of jacket) === */}
            {/* Nước ấm RA từ phía trên */}
            <line
              x1={jacketLeft - 2}
              y1={jacketTop + 14}
              x2={jacketLeft - 38}
              y2={jacketTop + 14}
              stroke="#fb923c"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <line
              x1={jacketLeft - 2}
              y1={jacketTop + 14}
              x2={jacketLeft - 38}
              y2={jacketTop + 14}
              stroke="#fed7aa"
              strokeWidth="2.5"
              strokeLinecap="round"
              opacity="0.55"
            />
            {/* Arrow showing water flowing OUT (left arrow) */}
            <polygon
              points={`${jacketLeft - 42},${jacketTop + 14} ${jacketLeft - 30},${jacketTop + 8} ${jacketLeft - 30},${jacketTop + 20}`}
              fill="#fb923c"
              opacity="0.9"
            />
            {/* Water OUT label */}
            <text x={jacketLeft - 46} y={jacketTop + 9} textAnchor="end" fontSize="10" fill="#fb923c" fontWeight="700">
              🌡️ Nước ấm ra
            </text>
            <text x={jacketLeft - 46} y={jacketTop + 21} textAnchor="end" fontSize="9" fill="#fdba74">
              (từ trên ra)
            </text>

            {/* === Condenser label === */}
            <text
              x={COIL_CX}
              y={jacketBot + 18}
              textAnchor="middle"
              fontSize="12"
              fill="#7dd3fc"
              fontWeight="700"
            >
              Ống sinh hàn ruột gà
            </text>
            <text
              x={COIL_CX}
              y={jacketBot + 31}
              textAnchor="middle"
              fontSize="10"
              fill="#38bdf8"
            >
              (Coil Condenser)
            </text>

            {/* === Liquid drops from outlet === */}
            {running &&
              drops.map((d) => (
                <ellipse
                  key={d.id}
                  cx="472"
                  cy={d.y}
                  rx="3.5"
                  ry="4.5"
                  fill="#a78bfa"
                  opacity={d.opacity}
                />
              ))}

            {/* ═══════════════════════════════════
                BÌNH HỨNG MẪU (Collection beaker)
            ═══════════════════════════════════ */}
            {/* Liquid collected */}
            <rect
              x="436"
              y={collectY}
              width="72"
              height={collectH}
              fill="url(#collectGrad)"
              clipPath="url(#beakerClip)"
            />
            {/* Liquid surface shimmer */}
            {collectLevel > 3 && (
              <ellipse cx="472" cy={collectY} rx="30" ry="3.5" fill="#c4b5fd" opacity="0.35" />
            )}

            {/* Beaker glass */}
            <path
              d="M436,540 L436,608 Q436,616 444,616 L500,616 Q508,616 508,608 L508,540 Z"
              fill="none"
              stroke="#93c5fd"
              strokeWidth="2.5"
            />
            {/* Beaker graduation marks */}
            {[0.25, 0.5, 0.75].map((f, i) => (
              <g key={i}>
                <line
                  x1="436" y1={608 - f * 72}
                  x2="446" y2={608 - f * 72}
                  stroke="#60a5fa" strokeWidth="1.2" opacity="0.65"
                />
                <text x="448" y={608 - f * 72 + 4} fontSize="8" fill="#60a5fa" opacity="0.7">
                  {Math.round(f * 50)}mL
                </text>
              </g>
            ))}

            {/* Volume text */}
            <text x="472" y="634" textAnchor="middle" fontSize="10" fill="#c4b5fd">
              {(collectLevel * 0.5).toFixed(1)} mL
            </text>
            <text x="472" y="648" textAnchor="middle" fontSize="11" fill="#c4b5fd" fontWeight="600">
              Bình hứng mẫu
            </text>
            {collectLevel > 5 && (
              <text
                x="472"
                y={collectY + collectH / 2 + 4}
                textAnchor="middle"
                fontSize="9"
                fill="#ede9fe"
                fontWeight="700"
              >
                Ethanol
              </text>
            )}

            {/* ═══════════════════════════════════
                TEMP GAUGE & BOILING BADGE
            ═══════════════════════════════════ */}
            <rect x="18" y="28" width="86" height="38" rx="9" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1.5" />
            <text x="61" y="43" textAnchor="middle" fontSize="9" fill="#93c5fd">Nhiệt độ</text>
            <text x="61" y="59" textAnchor="middle" fontSize="13" fill="#fbbf24" fontWeight="700">
              {temp.toFixed(1)} °C
            </text>

            {boiling && (
              <g>
                <rect x="115" y="28" width="108" height="38" rx="9" fill="#064e3b" stroke="#10b981" strokeWidth="1.5" />
                <text x="169" y="43" textAnchor="middle" fontSize="9" fill="#6ee7b7">Trạng thái</text>
                <text x="169" y="59" textAnchor="middle" fontSize="11" fill="#34d399" fontWeight="700">
                  🔥 Đang sôi!
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Info Panel */}
        <div className="flex flex-col gap-5 w-full max-w-sm">
          {/* Controls */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur shadow-lg">
            <h2 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              ⚙️ Điều khiển
            </h2>
            <div className="flex gap-3">
              <button
                onClick={() => setRunning((r) => !r)}
                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 shadow ${
                  running
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-green-500 hover:bg-green-600 text-white"
                }`}
              >
                {running ? "⏹ Dừng lại" : "▶ Bắt đầu đun"}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2.5 rounded-xl font-bold text-sm bg-slate-600 hover:bg-slate-500 text-white transition-all duration-200 shadow"
              >
                ↺ Reset
              </button>
            </div>
          </div>

          {/* Progress bars */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur shadow-lg">
            <h2 className="text-white font-bold text-lg mb-4">📊 Theo dõi</h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">🌡️ Nhiệt độ</span>
                  <span className="text-yellow-300 font-bold">{temp.toFixed(1)} °C</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-400 via-orange-400 to-red-500 rounded-full transition-all duration-300"
                    style={{ width: `${(temp / 100) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                  <span>25°C</span><span>78.4°C (bp)</span><span>100°C</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">🧫 Bình cầu</span>
                  <span className="text-blue-300 font-bold">{flaskLevel.toFixed(0)}%</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-300 rounded-full transition-all duration-300"
                    style={{ width: `${flaskLevel}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">🫙 Bình hứng</span>
                  <span className="text-violet-300 font-bold">{(collectLevel * 0.5).toFixed(1)} mL</span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-600 to-violet-300 rounded-full transition-all duration-300"
                    style={{ width: `${collectLevel}%` }}
                  />
                </div>
              </div>

              {/* Water status */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-300">💧 Nước làm lạnh</span>
                  <span className={`font-bold text-xs ${running ? "text-cyan-300" : "text-slate-500"}`}>
                    {running ? "⬆ Đang chảy ngược chiều" : "Chưa bơm"}
                  </span>
                </div>
                <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      running
                        ? "bg-gradient-to-r from-cyan-500 to-blue-400 animate-pulse"
                        : "bg-slate-600"
                    }`}
                    style={{ width: running ? "100%" : "0%" }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur shadow-lg">
            <h2 className="text-white font-bold text-lg mb-4">🔬 Quá trình</h2>
            <div className="space-y-3">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all duration-500 ${
                    running && step >= i
                      ? "bg-white/10 border border-white/20"
                      : "opacity-40"
                  }`}
                >
                  <div
                    className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  >
                    {i + 1}
                  </div>
                  <p className="text-slate-200 text-sm leading-snug">{s.label}</p>
                  {running && step >= i && (
                    <span className="ml-auto text-green-400 text-xs flex-shrink-0">✓</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Coil condenser theory */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur shadow-lg">
            <h2 className="text-white font-bold text-lg mb-3">🌀 Sinh hàn Ruột Gà</h2>
            <ul className="space-y-2 text-slate-300 text-sm leading-relaxed">
              <li>🔹 <strong className="text-cyan-200">Cấu tạo:</strong> Ống xoắn (coil) bên trong vỏ kính chứa nước làm lạnh.</li>
              <li>🔹 <strong className="text-cyan-200">Nước vào:</strong> từ phía dưới <span className="text-blue-300">(lạnh)</span>, ra phía trên <span className="text-orange-300">(ấm)</span> – ngược chiều hơi.</li>
              <li>🔹 <strong className="text-cyan-200">Diện tích tiếp xúc</strong> lớn hơn sinh hàn thẳng → hiệu quả làm lạnh cao hơn.</li>
              <li>🔹 Hơi ethanol đi trong ống xoắn, mất nhiệt → <strong className="text-violet-200">ngưng tụ thành lỏng</strong> chảy ra bình hứng.</li>
              <li>🔹 Điểm sôi ethanol <strong className="text-yellow-200">78,4 °C</strong> &lt; nước <strong className="text-yellow-200">100 °C</strong> → tách được ethanol trước.</li>
            </ul>
          </div>

          {/* Component list */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur shadow-lg">
            <h2 className="text-white font-bold text-lg mb-3">🗂️ Danh sách thiết bị</h2>
            <div className="grid grid-cols-1 gap-2">
              {[
                { icon: "🫙", name: "Bình cầu đáy tròn", note: "Chứa hỗn hợp rượu–nước" },
                { icon: "🕯️", name: "Đèn cồn", note: "Cung cấp nhiệt để đun sôi" },
                { icon: "🔩", name: "Giá đỡ sắt", note: "Giữ cố định các thiết bị" },
                { icon: "🌀", name: "Ống sinh hàn ruột gà", note: "Làm lạnh hơi → lỏng (coil condenser)" },
                { icon: "💧", name: "Đầu nước vào (dưới)", note: "Nước lạnh bơm vào từ phía dưới" },
                { icon: "🌡️", name: "Đầu nước ra (trên)", note: "Nước ấm thoát ra phía trên" },
                { icon: "🧪", name: "Bình hứng mẫu (beaker)", note: "Thu ethanol tinh khiết" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-white text-sm font-semibold">{item.name}</p>
                    <p className="text-slate-400 text-xs">{item.note}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-slate-500 text-xs">
        Mô phỏng thiết bị chưng cất hóa học • Ống sinh hàn ruột gà (Coil Condenser) • Chưng cất Ethanol–Water
      </div>
    </div>
  );
}
