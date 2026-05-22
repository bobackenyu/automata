import React from "react";

// ─────────────────────────────────────────────────────────────
//  PDAAlphabetFlowchart.tsx
//  Regex: (a+b)(a+b)*(aa+bb)(ab+ba)(a+b)*(aba+baa)
//
//  Fully hardcoded SVG — no external assets, no tracing.
//  Layout faithfully reproduces the React Flow blueprint.
//
//  FIX (v2): READ₁ → READ₂ transition now correctly accepts
//  BOTH 'a' and 'b' (label: "a, b") matching the (a+b)(a+b)*
//  prefix rule. Previously only 'b' was wired, causing valid
//  strings like "aa..." to fall into early REJECT.
//  READ₂ already branched correctly: 'a' → upper path (aa),
//  'b' → lower path (bb), so no structural change needed there.
// ─────────────────────────────────────────────────────────────

// ── Design tokens ────────────────────────────────────────────
const T = {
  bg:           "#0d0d0d",
  diamondFill:  "#0f1f3d",
  diamondStroke:"#74DCFF",
  startFill:    "#3b1f6e",
  startStroke:  "#a855f7",
  acceptFill:   "#14532d",
  acceptStroke: "#22c55e",
  rejectFill:   "#450a0a",
  rejectStroke: "#ef4444",
  arrowGrey:    "#6b7280",
  arrowRed:     "#ef4444",
  arrowGreen:   "#22c55e",
  nodeText:     "#74DCFF",
  edgeLabel:    "#e5e7eb",
  dimLabel:     "#9ca3af",
};

// ── SVG viewport ─────────────────────────────────────────────
const VW = 1380;
const VH = 630;

// ── Node centres [x, y] ──────────────────────────────────────
// Rows:  TOP=185  MID=315  BOT=445
// Columns follow left-to-right flow matching the screenshot.
const N = {
  start:    [68,  315] as [number,number],
  read1:    [178, 315] as [number,number],
  rejBelow1:[178, 455] as [number,number],  // Δ from READ₁, goes down

  read2:    [298, 315] as [number,number],
  rejLeft2: [248, 205] as [number,number],  // Δ from READ₂, goes upper-left

  read3a:   [398, 195] as [number,number],  // 'a' branch top
  read3b:   [398, 435] as [number,number],  // 'b' branch bot
  rejTop3a: [398, 110] as [number,number],
  rejBot3b: [398, 520] as [number,number],

  read4a:   [515, 195] as [number,number],
  read4b:   [515, 435] as [number,number],
  rejTop4a: [515, 110] as [number,number],
  rejBot4b: [515, 520] as [number,number],

  read5:    [628, 315] as [number,number],
  rejLeft5: [628, 205] as [number,number],  // Δ from READ₅

  read6a:   [755, 195] as [number,number],
  read6b:   [755, 435] as [number,number],
  rejTop6a: [755, 110] as [number,number],
  rejBot6b: [755, 520] as [number,number],

  read7a:   [880, 195] as [number,number],
  read7b:   [880, 435] as [number,number],
  rejTop7a: [880, 110] as [number,number],
  rejBot7b: [880, 520] as [number,number],

  racc:     [1010, 315] as [number,number],
  accept:   [1145, 315] as [number,number],
};

// Diamond geometry
const DW = 44;  // half-width
const DH = 28;  // half-height
// Oval geometry
const OR = { rx: 34, ry: 16 };   // standard
const OS = { rx: 32, ry: 15 };   // small reject

// ── Helpers ──────────────────────────────────────────────────

/** Arrowhead marker */
const Marker: React.FC<{ id: string; color: string }> = ({ id, color }) => (
  <marker id={id} markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
    <path d="M0,0 L0,6 L8,3 z" fill={color} />
  </marker>
);

/** Polyline arrow – accepts an array of [x,y] waypoints */
const Arrow: React.FC<{
  pts: [number,number][];
  marker: string;
  color: string;
}> = ({ pts, marker, color }) => {
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  return (
    <path d={d} fill="none" stroke={color} strokeWidth={1.5}
      markerEnd={`url(#${marker})`} />
  );
};

/** Edge label */
const EL: React.FC<{ x: number; y: number; text: string; red?: boolean }> = ({ x, y, text, red }) => (
  <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
    fontSize={11} fontWeight={700}
    fill={red ? "#f87171" : T.edgeLabel}>
    {text}
  </text>
);

/** Diamond (READ / R.ACC) node */
const Dmd: React.FC<{ cx: number; cy: number; top: string; bot?: string }> = ({ cx, cy, top, bot }) => {
  const pts = `${cx},${cy - DH} ${cx + DW},${cy} ${cx},${cy + DH} ${cx - DW},${cy}`;
  return (
    <g>
      <polygon points={pts}
        fill={T.diamondFill} stroke={T.diamondStroke} strokeWidth={1.8} />
      <text x={cx} y={bot ? cy - 5 : cy}
        textAnchor="middle" dominantBaseline="central"
        fontSize={9} fontWeight={700} fill={T.nodeText}>
        {top}
      </text>
      {bot && (
        <text x={cx} y={cy + 7}
          textAnchor="middle" dominantBaseline="central"
          fontSize={8} fill={T.nodeText}>
          {bot}
        </text>
      )}
    </g>
  );
};

/** Oval (START / ACCEPT / REJECT) node */
const Ovl: React.FC<{
  cx: number; cy: number; rx?: number; ry?: number;
  label: string;
  fill: string; stroke: string; textFill: string;
}> = ({ cx, cy, rx = OR.rx, ry = OR.ry, label, fill, stroke, textFill }) => (
  <g>
    <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
      fill={fill} stroke={stroke} strokeWidth={1.8} />
    <text x={cx} y={cy}
      textAnchor="middle" dominantBaseline="central"
      fontSize={9} fontWeight={800} fill={textFill} letterSpacing={0.4}>
      {label}
    </text>
  </g>
);

// Shorthand oval factories
const Reject = ({ cx, cy }: { cx: number; cy: number }) => (
  <Ovl cx={cx} cy={cy} rx={OS.rx} ry={OS.ry} label="REJECT"
    fill={T.rejectFill} stroke={T.rejectStroke} textFill="#f87171" />
);

// ── Main component ────────────────────────────────────────────

const PDAAlphabetFlowchart: React.FC = () => (
  <div
    className="w-full h-full overflow-auto cursor-grab active:cursor-grabbing select-none"
    style={{ background: T.bg, WebkitOverflowScrolling: "touch" as never }}
  >
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      width={VW} height={VH}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: "block", minWidth: VW }}
    >
      {/* ── Marker defs ── */}
      <defs>
        <Marker id="mg" color={T.arrowGrey}  />
        <Marker id="mr" color={T.arrowRed}   />
        <Marker id="mc" color="#22c55e"       />
      </defs>

      {/* ════════════════════════════════════════════════
          EDGES — drawn first so nodes render on top
          ════════════════════════════════════════════════ */}

      {/* START → READ₁  (a,b) */}
      <Arrow pts={[[N.start[0]+34, N.start[1]], [N.read1[0]-DW, N.read1[1]]]} marker="mg" color={T.arrowGrey} />
      <EL x={124} y={305} text="a, b" />

      {/* READ₁ → READ₂  (a, b) — both symbols advance; (a+b)(a+b)* means any first char is valid */}
      <Arrow pts={[[N.read1[0]+DW, N.read1[1]], [N.read2[0]-DW, N.read2[1]]]} marker="mg" color={T.arrowGrey} />
      <EL x={238} y={303} text="a, b" />

      {/* READ₁ → REJECT-below  (Δ — string ended after just one char; minimum length not met) */}
      <Arrow pts={[[N.read1[0], N.read1[1]+DH], [N.rejBelow1[0], N.rejBelow1[1]-OS.ry]]} marker="mr" color={T.arrowRed} />
      <EL x={166} y={387} text="Δ" red />

      {/* READ₂ → REJECT-left  (Δ, upper-left) */}
      <Arrow
        pts={[[N.read2[0]-18, N.read2[1]-DH], [N.rejLeft2[0]+OS.rx, N.rejLeft2[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={271} y={255} text="Δ" red />

      {/* READ₂ → READ 3a  (a, upper-right) */}
      <Arrow
        pts={[[N.read2[0]+20, N.read2[1]-DH], [N.read3a[0]-DW, N.read3a[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={341} y={242} text="a" />

      {/* READ₂ → READ 3b  (b, lower-right) */}
      <Arrow
        pts={[[N.read2[0]+20, N.read2[1]+DH], [N.read3b[0]-DW, N.read3b[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={341} y={388} text="b" />

      {/* READ 3a → REJECT top  (Δ) */}
      <Arrow pts={[[N.read3a[0], N.read3a[1]-DH], [N.rejTop3a[0], N.rejTop3a[1]+OS.ry]]} marker="mr" color={T.arrowRed} />
      <EL x={386} y={150} text="Δ" red />

      {/* READ 3a → READ 4a  (a) */}
      <Arrow pts={[[N.read3a[0]+DW, N.read3a[1]], [N.read4a[0]-DW, N.read4a[1]]]} marker="mg" color={T.arrowGrey} />
      <EL x={456} y={183} text="a" />

      {/* READ 3b → REJECT bot  (Δ) */}
      <Arrow pts={[[N.read3b[0], N.read3b[1]+DH], [N.rejBot3b[0], N.rejBot3b[1]-OS.ry]]} marker="mr" color={T.arrowRed} />
      <EL x={386} y={480} text="Δ" red />

      {/* READ 3b → READ 4b  (b) */}
      <Arrow pts={[[N.read3b[0]+DW, N.read3b[1]], [N.read4b[0]-DW, N.read4b[1]]]} marker="mg" color={T.arrowGrey} />
      <EL x={456} y={447} text="b" />

      {/* READ 4a → REJECT top  (Δ) */}
      <Arrow pts={[[N.read4a[0], N.read4a[1]-DH], [N.rejTop4a[0], N.rejTop4a[1]+OS.ry]]} marker="mr" color={T.arrowRed} />
      <EL x={503} y={150} text="Δ" red />

      {/* READ 4a → READ₅  (b, diagonal down to mid) */}
      <Arrow
        pts={[[N.read4a[0]+DW, N.read4a[1]], [N.read5[0]-12, N.read5[1]-DH]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={584} y={238} text="b" />

      {/* READ 4b → REJECT bot  (Δ) */}
      <Arrow pts={[[N.read4b[0], N.read4b[1]+DH], [N.rejBot4b[0], N.rejBot4b[1]-OS.ry]]} marker="mr" color={T.arrowRed} />
      <EL x={503} y={480} text="Δ" red />

      {/* READ 4b → READ₅  (a, diagonal up to mid) */}
      <Arrow
        pts={[[N.read4b[0]+DW, N.read4b[1]], [N.read5[0]-12, N.read5[1]+DH]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={584} y={392} text="a" />

      {/* READ₅ → REJECT-left  (Δ) */}
      <Arrow
        pts={[[N.read5[0]-18, N.read5[1]-DH], [N.rejLeft5[0], N.rejLeft5[1]+OS.ry]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={616} y={257} text="Δ" red />

      {/* READ₅ → READ 6a  (a, upper-right) */}
      <Arrow
        pts={[[N.read5[0]+20, N.read5[1]-DH], [N.read6a[0]-DW, N.read6a[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={694} y={242} text="a" />

      {/* READ₅ → READ 6b  (b, lower-right) */}
      <Arrow
        pts={[[N.read5[0]+20, N.read5[1]+DH], [N.read6b[0]-DW, N.read6b[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={694} y={388} text="b" />

      {/* READ 6a → REJECT top  (Δ) */}
      <Arrow pts={[[N.read6a[0], N.read6a[1]-DH], [N.rejTop6a[0], N.rejTop6a[1]+OS.ry]]} marker="mr" color={T.arrowRed} />
      <EL x={743} y={150} text="Δ" red />

      {/* READ 6a left-exit → REJECT at rejLeft5  ('a' label — wrong turn on top path) */}
      <Arrow
        pts={[[N.read6a[0]-DW, N.read6a[1]], [N.rejLeft5[0]+OS.rx, N.rejLeft5[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={695} y={197} text="a" red />

      {/* READ 6a → READ 7a  (b) */}
      <Arrow pts={[[N.read6a[0]+DW, N.read6a[1]], [N.read7a[0]-DW, N.read7a[1]]]} marker="mg" color={T.arrowGrey} />
      <EL x={817} y={183} text="b" />

      {/* READ 6b → REJECT bot  (Δ) */}
      <Arrow pts={[[N.read6b[0], N.read6b[1]+DH], [N.rejBot6b[0], N.rejBot6b[1]-OS.ry]]} marker="mr" color={T.arrowRed} />
      <EL x={743} y={480} text="Δ" red />

      {/* READ 6b → READ 7b  (b) */}
      <Arrow pts={[[N.read6b[0]+DW, N.read6b[1]], [N.read7b[0]-DW, N.read7b[1]]]} marker="mg" color={T.arrowGrey} />
      <EL x={817} y={447} text="b" />

      {/* READ 7a → REJECT top  (Δ) */}
      <Arrow pts={[[N.read7a[0], N.read7a[1]-DH], [N.rejTop7a[0], N.rejTop7a[1]+OS.ry]]} marker="mr" color={T.arrowRed} />
      <EL x={868} y={150} text="Δ" red />

      {/* READ 7a → R.ACC  (a, diagonal to mid) */}
      <Arrow
        pts={[[N.read7a[0]+DW, N.read7a[1]], [N.racc[0]-12, N.racc[1]-DH]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={953} y={238} text="a" />

      {/* READ 7b → REJECT bot  (Δ) */}
      <Arrow pts={[[N.read7b[0], N.read7b[1]+DH], [N.rejBot7b[0], N.rejBot7b[1]-OS.ry]]} marker="mr" color={T.arrowRed} />
      <EL x={868} y={480} text="Δ" red />

      {/* READ 7b → R.ACC  (a, diagonal to mid) */}
      <Arrow
        pts={[[N.read7b[0]+DW, N.read7b[1]], [N.racc[0]-12, N.racc[1]+DH]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={953} y={392} text="a" />

      {/* R.ACC → ACCEPT  (Δ) */}
      <Arrow
        pts={[[N.racc[0]+DW, N.racc[1]], [N.accept[0]-OR.rx, N.accept[1]]]}
        marker="mc" color="#22c55e"
      />
      <EL x={1077} y={303} text="Δ" />

      {/* ════════════════════════════════════════════════
          NODES — rendered on top of edges
          ════════════════════════════════════════════════ */}

      {/* START */}
      <Ovl cx={N.start[0]} cy={N.start[1]} label="START"
        fill={T.startFill} stroke={T.startStroke} textFill="#c084fc" />

      {/* ACCEPT */}
      <Ovl cx={N.accept[0]} cy={N.accept[1]} rx={40} ry={18} label="ACCEPT"
        fill={T.acceptFill} stroke={T.acceptStroke} textFill="#4ade80" />

      {/* REJECT nodes */}
      <Reject cx={N.rejBelow1[0]} cy={N.rejBelow1[1]} />
      <Reject cx={N.rejLeft2[0]}  cy={N.rejLeft2[1]}  />
      <Reject cx={N.rejTop3a[0]}  cy={N.rejTop3a[1]}  />
      <Reject cx={N.rejBot3b[0]}  cy={N.rejBot3b[1]}  />
      <Reject cx={N.rejTop4a[0]}  cy={N.rejTop4a[1]}  />
      <Reject cx={N.rejBot4b[0]}  cy={N.rejBot4b[1]}  />
      <Reject cx={N.rejLeft5[0]}  cy={N.rejLeft5[1]}  />
      <Reject cx={N.rejTop6a[0]}  cy={N.rejTop6a[1]}  />
      <Reject cx={N.rejBot6b[0]}  cy={N.rejBot6b[1]}  />
      <Reject cx={N.rejTop7a[0]}  cy={N.rejTop7a[1]}  />
      <Reject cx={N.rejBot7b[0]}  cy={N.rejBot7b[1]}  />

      {/* READ diamonds */}
      <Dmd cx={N.read1[0]}  cy={N.read1[1]}  top="READ" bot="₁" />
      <Dmd cx={N.read2[0]}  cy={N.read2[1]}  top="READ" bot="₂" />
      <Dmd cx={N.read3a[0]} cy={N.read3a[1]} top="READ 3a" />
      <Dmd cx={N.read3b[0]} cy={N.read3b[1]} top="READ 3b" />
      <Dmd cx={N.read4a[0]} cy={N.read4a[1]} top="READ 4a" />
      <Dmd cx={N.read4b[0]} cy={N.read4b[1]} top="READ 4b" />
      <Dmd cx={N.read5[0]}  cy={N.read5[1]}  top="READ" bot="₅" />
      <Dmd cx={N.read6a[0]} cy={N.read6a[1]} top="READ 6a" />
      <Dmd cx={N.read6b[0]} cy={N.read6b[1]} top="READ 6b" />
      <Dmd cx={N.read7a[0]} cy={N.read7a[1]} top="READ 7a" />
      <Dmd cx={N.read7b[0]} cy={N.read7b[1]} top="READ 7b" />
      <Dmd cx={N.racc[0]}   cy={N.racc[1]}   top="R.ACC" />

      {/* ── Diagram footer label ── */}
      <text x={VW / 2} y={VH - 14} textAnchor="middle"
        fontSize={10} fill={T.dimLabel} letterSpacing={0.3}>
        Pushdown Automaton · (a+b)(a+b)* (aa+bb)(ab+ba)(a+b)* (aba+baa)
      </text>
    </svg>
  </div>
);

export default PDAAlphabetFlowchart;
