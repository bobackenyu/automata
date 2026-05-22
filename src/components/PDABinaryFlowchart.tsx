import React from "react";

// ─────────────────────────────────────────────────────────────
//  PDABinaryFlowchart.tsx
//  Regex: (11+00)(1+0)*(101+111+01)(00*+11*)(1+0+11)
//
//  Fully hardcoded SVG — no external assets, no tracing.
//  Five-stage PDA pipeline, left-to-right:
//    S1: (11+00)          — two-char prefix gate
//    S2: (1+0)*           — self-loop (any length middle run)
//    S3: (101+111+01)     — three-branch pattern block
//    S4: (00*+11*)        — typed repeat loop
//    S5: (1+0+11)         — final token gate → ACCEPT
// ─────────────────────────────────────────────────────────────

// ── Design tokens ─────────────────────────────────────────────
const T = {
  bg:            "#0d0d0d",
  diamondFill:   "#0f1f3d",
  diamondStroke: "#74DCFF",
  loopFill:      "#0d2b1f",
  loopStroke:    "#34d399",   // green-tinted for the loop node
  startFill:     "#3b1f6e",
  startStroke:   "#a855f7",
  acceptFill:    "#14532d",
  acceptStroke:  "#22c55e",
  rejectFill:    "#450a0a",
  rejectStroke:  "#ef4444",
  arrowGrey:     "#6b7280",
  arrowRed:      "#ef4444",
  arrowGreen:    "#22c55e",
  arrowCyan:     "#74DCFF",
  nodeText:      "#74DCFF",
  loopText:      "#34d399",
  edgeLabel:     "#e5e7eb",
  dimLabel:      "#6b7280",
};

// ── SVG viewport ──────────────────────────────────────────────
const VW = 1660;
const VH = 760;

// ── Node geometry ─────────────────────────────────────────────
const DW = 42;   // diamond half-width
const DH = 27;   // diamond half-height
const OR = { rx: 36, ry: 17 };   // standard oval
const SR = { rx: 32, ry: 15 };   // small reject oval

// ── Node centre coordinates [x, y] ───────────────────────────
//  Main spine:  y = 370
//  Upper track: y = 195
//  Lower track: y = 545
//  Top rejects: y = 100
//  Bot rejects: y = 640
const N = {
  // ── Terminals ──
  start:       [60,  370] as [number, number],
  accept:      [1580, 370] as [number, number],

  // ── Stage 1: (11+00) ──
  s1:          [170, 370] as [number, number],   // READ first char
  s1b1:        [295, 195] as [number, number],   // READ second char (after '1')
  s1b0:        [295, 545] as [number, number],   // READ second char (after '0')
  rej_s1_d:    [170, 500] as [number, number],   // Δ too early at S1
  rej_s1b1_0:  [215, 100] as [number, number],   // '0' after first '1' (got "10") — REJECT
  rej_s1b1_d:  [340, 100] as [number, number],   // Δ at S1b1 — REJECT
  rej_s1b0_1:  [215, 640] as [number, number],   // '1' after first '0' (got "01") — REJECT
  rej_s1b0_d:  [340, 640] as [number, number],   // Δ at S1b0 — REJECT

  // ── Stage 2: (1+0)* loop ──
  loop:        [435, 370] as [number, number],   // self-loop node (green variant)

  // ── Stage 3: (101+111+01) ──
  s3br:        [560, 370] as [number, number],   // S3 branch gate
  rej_s3_d:    [560, 500] as [number, number],   // Δ at S3 gate — REJECT

  s3_1:        [670, 195] as [number, number],   // after reading '1' (101 or 111 path)
  s3_0:        [670, 545] as [number, number],   // after reading '0' (01 path)
  rej_s3_1_d:  [670, 100] as [number, number],   // Δ at S3_1 — REJECT
  rej_s3_0_x:  [745, 640] as [number, number],   // non-'1' at S3_0 — REJECT

  s3_10:       [785, 220] as [number, number],   // after reading '10' (→ need '1')
  s3_11:       [785, 140] as [number, number],   // after reading '11' (→ need '1')
  rej_s3_10_x: [870, 220] as [number, number],   // bad char at S3_10 — REJECT
  rej_s3_11_x: [870, 140] as [number, number],   // bad char at S3_11 — REJECT

  // ── Stage 4: (00*+11*) ──
  s4br:        [920, 370] as [number, number],   // S4 branch gate
  rej_s4_d:    [920, 500] as [number, number],   // Δ at S4 gate — REJECT

  s4_1loop:    [1035, 195] as [number, number],  // 1-run loop (after first '1')
  s4_0loop:    [1035, 545] as [number, number],  // 0-run loop (after first '0')

  // ── Stage 5: (1+0+11) ──
  s5br:        [1160, 370] as [number, number],  // S5 branch gate
  rej_s5_d:    [1160, 500] as [number, number],  // Δ at S5 gate — REJECT

  s5_1:        [1270, 195] as [number, number],  // after first '1' (could be "1" or "11")
  s5_0:        [1270, 545] as [number, number],  // after '0' (just "0")
  rej_s5_1_x:  [1270, 100] as [number, number],  // non-Δ,non-'1' after S5_1 — REJECT
  rej_s5_0_x:  [1270, 640] as [number, number],  // non-Δ after S5_0 — REJECT

  s5_11:       [1390, 195] as [number, number],  // after reading "11"
  rej_s5_11_x: [1390, 100] as [number, number],  // non-Δ after S5_11 — REJECT

  // ── Pre-accept ──
  racc:        [1465, 370] as [number, number],  // R.ACC
};

// ── Helpers ───────────────────────────────────────────────────

/** Arrowhead marker definition */
const Marker: React.FC<{ id: string; color: string }> = ({ id, color }) => (
  <marker id={id} markerWidth={8} markerHeight={8} refX={6} refY={3} orient="auto">
    <path d="M0,0 L0,6 L8,3 z" fill={color} />
  </marker>
);

/** Multi-waypoint arrow */
const Arrow: React.FC<{
  pts: [number, number][];
  marker: string;
  color: string;
  dashed?: boolean;
}> = ({ pts, marker, color, dashed }) => {
  const d = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  return (
    <path d={d} fill="none" stroke={color} strokeWidth={1.5}
      strokeDasharray={dashed ? "5,3" : undefined}
      markerEnd={`url(#${marker})`} />
  );
};

/** Edge label */
const EL: React.FC<{
  x: number; y: number; text: string;
  red?: boolean; cyan?: boolean; green?: boolean;
}> = ({ x, y, text, red, cyan, green }) => {
  const fill = red ? "#f87171" : cyan ? "#74DCFF" : green ? "#4ade80" : T.edgeLabel;
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={700} fill={fill}>
      {text}
    </text>
  );
};

/** Self-loop arc above a diamond node */
const SelfLoop: React.FC<{ cx: number; cy: number; color: string; markerId: string }> = ({
  cx, cy, color, markerId,
}) => {
  const r = 18;
  // Arc that starts from top-left of diamond, loops above, ends at top-right
  const x1 = cx - DW * 0.6;
  const y1 = cy - DH * 0.5;
  const x2 = cx + DW * 0.6;
  const y2 = y1;
  return (
    <path
      d={`M${x1},${y1} C${x1},${y1 - r * 2} ${x2},${y2 - r * 2} ${x2},${y2}`}
      fill="none" stroke={color} strokeWidth={1.5}
      markerEnd={`url(#${markerId})`}
    />
  );
};

/** Diamond node (READ / branch gates / R.ACC) */
const Dmd: React.FC<{
  cx: number; cy: number;
  line1: string; line2?: string;
  loop?: boolean;   // use green loop variant
}> = ({ cx, cy, line1, line2, loop }) => {
  const pts = `${cx},${cy - DH} ${cx + DW},${cy} ${cx},${cy + DH} ${cx - DW},${cy}`;
  const fill   = loop ? T.loopFill   : T.diamondFill;
  const stroke = loop ? T.loopStroke : T.diamondStroke;
  const tFill  = loop ? T.loopText   : T.nodeText;
  return (
    <g>
      <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={1.8} />
      <text x={cx} y={line2 ? cy - 5 : cy}
        textAnchor="middle" dominantBaseline="central"
        fontSize={9} fontWeight={700} fill={tFill}>
        {line1}
      </text>
      {line2 && (
        <text x={cx} y={cy + 7}
          textAnchor="middle" dominantBaseline="central"
          fontSize={8} fill={tFill}>
          {line2}
        </text>
      )}
    </g>
  );
};

/** Generic oval */
const Ovl: React.FC<{
  cx: number; cy: number; rx?: number; ry?: number;
  label: string; fill: string; stroke: string; textFill: string;
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

/** REJECT shorthand */
const Rej: React.FC<{ cx: number; cy: number }> = ({ cx, cy }) => (
  <Ovl cx={cx} cy={cy} rx={SR.rx} ry={SR.ry} label="REJECT"
    fill={T.rejectFill} stroke={T.rejectStroke} textFill="#f87171" />
);

// ── Stage section label ────────────────────────────────────────
const StageLabel: React.FC<{ x: number; text: string }> = ({ x, text }) => (
  <text x={x} y={22} textAnchor="middle"
    fontSize={9} fontWeight={600} fill="#374151" letterSpacing={0.3}>
    {text}
  </text>
);

// ── Vertical stage divider ─────────────────────────────────────
const Divider: React.FC<{ x: number }> = ({ x }) => (
  <line x1={x} y1={35} x2={x} y2={VH - 20}
    stroke="#1f2937" strokeWidth={1} strokeDasharray="4,4" />
);

// ── Main component ─────────────────────────────────────────────
const PDABinaryFlowchart: React.FC = () => (
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
      {/* ── Arrowhead markers ── */}
      <defs>
        <Marker id="mg"  color={T.arrowGrey}  />
        <Marker id="mr"  color={T.arrowRed}   />
        <Marker id="mc"  color={T.arrowGreen} />
        <Marker id="mcy" color={T.arrowCyan}  />
      </defs>

      {/* ── Stage dividers & labels ── */}
      <Divider x={120} />
      <Divider x={390} />
      <Divider x={510} />
      <Divider x={880} />
      <Divider x={1120} />
      <Divider x={1430} />

      <StageLabel x={63}   text="START" />
      <StageLabel x={250}  text="S1: (11+00)" />
      <StageLabel x={450}  text="S2: (1+0)*" />
      <StageLabel x={700}  text="S3: (101+111+01)" />
      <StageLabel x={1000} text="S4: (00*+11*)" />
      <StageLabel x={1275} text="S5: (1+0+11)" />
      <StageLabel x={1550} text="END" />

      {/* ══════════════════════════════════════════════════════
          EDGES  (all drawn before nodes)
          ══════════════════════════════════════════════════════ */}

      {/* ── START → S1 ── */}
      <Arrow pts={[[N.start[0]+OR.rx, N.start[1]], [N.s1[0]-DW, N.s1[1]]]}
        marker="mg" color={T.arrowGrey} />

      {/* ── S1 → S1b1  ('1', branch up) ── */}
      <Arrow
        pts={[[N.s1[0]+10, N.s1[1]-DH], [N.s1b1[0]-DW, N.s1b1[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={225} y={272} text="1" />

      {/* ── S1 → S1b0  ('0', branch down) ── */}
      <Arrow
        pts={[[N.s1[0]+10, N.s1[1]+DH], [N.s1b0[0]-DW, N.s1b0[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={225} y={468} text="0" />

      {/* ── S1 → REJ_S1_d  (Δ, down) ── */}
      <Arrow
        pts={[[N.s1[0], N.s1[1]+DH], [N.rej_s1_d[0], N.rej_s1_d[1]-SR.ry]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={158} y={437} text="Δ" red />

      {/* ── S1b1 → LOOP  ('1' = got "11", advance) ── */}
      <Arrow
        pts={[[N.s1b1[0]+DW, N.s1b1[1]], [N.loop[0]-DW, N.loop[1]]]}
        marker="mcy" color={T.arrowCyan}
      />
      <EL x={363} y={268} text="1" cyan />

      {/* ── S1b1 → REJ_S1b1_0  ('0' = got "10", REJECT) ── */}
      <Arrow
        pts={[[N.s1b1[0]-10, N.s1b1[1]-DH], [N.rej_s1b1_0[0]+SR.rx, N.rej_s1b1_0[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={248} y={143} text="0" red />

      {/* ── S1b1 → REJ_S1b1_d  (Δ, up-right) ── */}
      <Arrow
        pts={[[N.s1b1[0]+10, N.s1b1[1]-DH], [N.rej_s1b1_d[0]-SR.rx, N.rej_s1b1_d[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={320} y={143} text="Δ" red />

      {/* ── S1b0 → LOOP  ('0' = got "00", advance) ── */}
      <Arrow
        pts={[[N.s1b0[0]+DW, N.s1b0[1]], [N.loop[0]-DW, N.loop[1]]]}
        marker="mcy" color={T.arrowCyan}
      />
      <EL x={363} y={472} text="0" cyan />

      {/* ── S1b0 → REJ_S1b0_1  ('1' = got "01", REJECT) ── */}
      <Arrow
        pts={[[N.s1b0[0]-10, N.s1b0[1]+DH], [N.rej_s1b0_1[0]+SR.rx, N.rej_s1b0_1[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={248} y={597} text="1" red />

      {/* ── S1b0 → REJ_S1b0_d  (Δ) ── */}
      <Arrow
        pts={[[N.s1b0[0]+10, N.s1b0[1]+DH], [N.rej_s1b0_d[0]-SR.rx, N.rej_s1b0_d[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={320} y={597} text="Δ" red />

      {/* ── LOOP self-loop  (1, 0) ── */}
      <SelfLoop cx={N.loop[0]} cy={N.loop[1]} color={T.loopStroke} markerId="mg" />
      <EL x={435} y={323} text="1, 0" green />

      {/* ── LOOP → S3_BRANCH  (Δ, ε-transition) ── */}
      <Arrow
        pts={[[N.loop[0]+DW, N.loop[1]], [N.s3br[0]-DW, N.s3br[1]]]}
        marker="mg" color={T.arrowGrey} dashed
      />
      <EL x={497} y={358} text="Δ" />

      {/* ── S3_BRANCH → S3_1  ('1', upper) ── */}
      <Arrow
        pts={[[N.s3br[0]+15, N.s3br[1]-DH], [N.s3_1[0]-DW, N.s3_1[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={611} y={270} text="1" />

      {/* ── S3_BRANCH → S3_0  ('0', lower) ── */}
      <Arrow
        pts={[[N.s3br[0]+15, N.s3br[1]+DH], [N.s3_0[0]-DW, N.s3_0[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={611} y={470} text="0" />

      {/* ── S3_BRANCH → REJ_S3_d  (Δ) ── */}
      <Arrow
        pts={[[N.s3br[0], N.s3br[1]+DH], [N.rej_s3_d[0], N.rej_s3_d[1]-SR.ry]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={548} y={437} text="Δ" red />

      {/* ── S3_1 → S3_10  ('0') ── */}
      <Arrow
        pts={[[N.s3_1[0]+DW, N.s3_1[1]], [N.s3_10[0]-DW, N.s3_10[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={727} y={205} text="0" />

      {/* ── S3_1 → S3_11  ('1') ── */}
      <Arrow
        pts={[[N.s3_1[0]+10, N.s3_1[1]-DH], [N.s3_11[0]-DW, N.s3_11[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={722} y={162} text="1" />

      {/* ── S3_1 → REJ_S3_1_d  (Δ) ── */}
      <Arrow
        pts={[[N.s3_1[0]-10, N.s3_1[1]-DH], [N.rej_s3_1_d[0]+SR.rx, N.rej_s3_1_d[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={656} y={143} text="Δ" red />

      {/* ── S3_0 → S4_BRANCH  ('1' = completed "01") ── */}
      <Arrow
        pts={[[N.s3_0[0]+DW, N.s3_0[1]], [N.s4br[0]+10, N.s4br[1]+DH]]}
        marker="mcy" color={T.arrowCyan}
      />
      <EL x={798} y={486} text="1" cyan />

      {/* ── S3_0 → REJ_S3_0_x  (non-'1') ── */}
      <Arrow
        pts={[[N.s3_0[0]+10, N.s3_0[1]+DH], [N.rej_s3_0_x[0]-SR.rx, N.rej_s3_0_x[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={705} y={597} text="0, Δ" red />

      {/* ── S3_10 → S4_BRANCH  ('1' = completed "101") ── */}
      <Arrow
        pts={[[N.s3_10[0]+DW, N.s3_10[1]], [N.s4br[0]-10, N.s4br[1]-DH]]}
        marker="mcy" color={T.arrowCyan}
      />
      <EL x={862} y={284} text="1" cyan />

      {/* ── S3_10 → REJ_S3_10_x  (non-'1') ── */}
      <Arrow
        pts={[[N.s3_10[0]+DW, N.s3_10[1]], [N.rej_s3_10_x[0]-SR.rx, N.rej_s3_10_x[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={828} y={222} text="0, Δ" red />

      {/* ── S3_11 → S4_BRANCH  ('1' = completed "111") ── */}
      <Arrow
        pts={[
          [N.s3_11[0]+DW, N.s3_11[1]],
          [N.s4br[0], N.s4br[1]-DH-10],
        ]}
        marker="mcy" color={T.arrowCyan}
      />
      <EL x={854} y={222} text="1" cyan />

      {/* ── S3_11 → REJ_S3_11_x  (non-'1') ── */}
      <Arrow
        pts={[[N.s3_11[0]+DW, N.s3_11[1]], [N.rej_s3_11_x[0]-SR.rx, N.rej_s3_11_x[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={828} y={140} text="0, Δ" red />

      {/* ── S4_BRANCH → S4_1loop  ('1', upper) ── */}
      <Arrow
        pts={[[N.s4br[0]+15, N.s4br[1]-DH], [N.s4_1loop[0]-DW, N.s4_1loop[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={975} y={268} text="1" />

      {/* ── S4_BRANCH → S4_0loop  ('0', lower) ── */}
      <Arrow
        pts={[[N.s4br[0]+15, N.s4br[1]+DH], [N.s4_0loop[0]-DW, N.s4_0loop[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={975} y={472} text="0" />

      {/* ── S4_BRANCH → REJ_S4_d  (Δ) ── */}
      <Arrow
        pts={[[N.s4br[0], N.s4br[1]+DH], [N.rej_s4_d[0], N.rej_s4_d[1]-SR.ry]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={908} y={437} text="Δ" red />

      {/* ── S4_1loop self-loop  ('1') ── */}
      <SelfLoop cx={N.s4_1loop[0]} cy={N.s4_1loop[1]} color={T.loopStroke} markerId="mg" />
      <EL x={1035} y={148} text="1" green />

      {/* ── S4_1loop → S5_BRANCH  (Δ) ── */}
      <Arrow
        pts={[[N.s4_1loop[0]+DW, N.s4_1loop[1]], [N.s5br[0]-10, N.s5br[1]-DH]]}
        marker="mg" color={T.arrowGrey} dashed
      />
      <EL x={1097} y={268} text="Δ" />

      {/* ── S4_0loop self-loop  ('0') ── */}
      <SelfLoop cx={N.s4_0loop[0]} cy={N.s4_0loop[1]} color={T.loopStroke} markerId="mg" />
      <EL x={1035} y={592} text="0" green />

      {/* ── S4_0loop → S5_BRANCH  (Δ) ── */}
      <Arrow
        pts={[[N.s4_0loop[0]+DW, N.s4_0loop[1]], [N.s5br[0]-10, N.s5br[1]+DH]]}
        marker="mg" color={T.arrowGrey} dashed
      />
      <EL x={1097} y={472} text="Δ" />

      {/* ── S5_BRANCH → S5_1  ('1', upper) ── */}
      <Arrow
        pts={[[N.s5br[0]+15, N.s5br[1]-DH], [N.s5_1[0]-DW, N.s5_1[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={1213} y={268} text="1" />

      {/* ── S5_BRANCH → S5_0  ('0', lower) ── */}
      <Arrow
        pts={[[N.s5br[0]+15, N.s5br[1]+DH], [N.s5_0[0]-DW, N.s5_0[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={1213} y={472} text="0" />

      {/* ── S5_BRANCH → REJ_S5_d  (Δ) ── */}
      <Arrow
        pts={[[N.s5br[0], N.s5br[1]+DH], [N.rej_s5_d[0], N.rej_s5_d[1]-SR.ry]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={1148} y={437} text="Δ" red />

      {/* ── S5_1 → R.ACC  (Δ = just "1", valid end) ── */}
      <Arrow
        pts={[[N.s5_1[0]+DW, N.s5_1[1]], [N.racc[0]-10, N.racc[1]-DH]]}
        marker="mc" color={T.arrowGreen}
      />
      <EL x={1367} y={268} text="Δ" green />

      {/* ── S5_1 → S5_11  ('1' = building "11") ── */}
      <Arrow
        pts={[[N.s5_1[0]+10, N.s5_1[1]-DH], [N.s5_11[0]-DW, N.s5_11[1]]]}
        marker="mg" color={T.arrowGrey}
      />
      <EL x={1330} y={162} text="1" />

      {/* ── S5_1 → REJ_S5_1_x  (0, non-terminal) ── */}
      <Arrow
        pts={[[N.s5_1[0]-10, N.s5_1[1]-DH], [N.rej_s5_1_x[0]+SR.rx, N.rej_s5_1_x[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={1255} y={143} text="0" red />

      {/* ── S5_0 → R.ACC  (Δ = just "0", valid end) ── */}
      <Arrow
        pts={[[N.s5_0[0]+DW, N.s5_0[1]], [N.racc[0]-10, N.racc[1]+DH]]}
        marker="mc" color={T.arrowGreen}
      />
      <EL x={1367} y={472} text="Δ" green />

      {/* ── S5_0 → REJ_S5_0_x  (non-Δ) ── */}
      <Arrow
        pts={[[N.s5_0[0]+10, N.s5_0[1]+DH], [N.rej_s5_0_x[0]-SR.rx, N.rej_s5_0_x[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={1278} y={597} text="1, 0" red />

      {/* ── S5_11 → R.ACC  (Δ = got "11", valid end) ── */}
      <Arrow
        pts={[[N.s5_11[0]+DW, N.s5_11[1]], [N.racc[0]-10, N.racc[1]-DH-10]]}
        marker="mc" color={T.arrowGreen}
      />
      <EL x={1428} y={260} text="Δ" green />

      {/* ── S5_11 → REJ_S5_11_x  (non-Δ) ── */}
      <Arrow
        pts={[[N.s5_11[0]+DW, N.s5_11[1]], [N.rej_s5_11_x[0]-SR.rx, N.rej_s5_11_x[1]]]}
        marker="mr" color={T.arrowRed}
      />
      <EL x={1392} y={118} text="1, 0" red />

      {/* ── R.ACC → ACCEPT  (Δ) ── */}
      <Arrow
        pts={[[N.racc[0]+DW, N.racc[1]], [N.accept[0]-OR.rx, N.accept[1]]]}
        marker="mc" color={T.arrowGreen}
      />
      <EL x={1522} y={358} text="Δ" green />

      {/* ══════════════════════════════════════════════════════
          NODES  (rendered on top of all edges)
          ══════════════════════════════════════════════════════ */}

      {/* ── Terminals ── */}
      <Ovl cx={N.start[0]} cy={N.start[1]} label="START"
        fill={T.startFill} stroke={T.startStroke} textFill="#c084fc" />
      <Ovl cx={N.accept[0]} cy={N.accept[1]} rx={40} ry={18} label="ACCEPT"
        fill={T.acceptFill} stroke={T.acceptStroke} textFill="#4ade80" />

      {/* ── Stage 1 REJECT nodes ── */}
      <Rej cx={N.rej_s1_d[0]}   cy={N.rej_s1_d[1]}   />
      <Rej cx={N.rej_s1b1_0[0]} cy={N.rej_s1b1_0[1]} />
      <Rej cx={N.rej_s1b1_d[0]} cy={N.rej_s1b1_d[1]} />
      <Rej cx={N.rej_s1b0_1[0]} cy={N.rej_s1b0_1[1]} />
      <Rej cx={N.rej_s1b0_d[0]} cy={N.rej_s1b0_d[1]} />

      {/* ── Stage 3 REJECT nodes ── */}
      <Rej cx={N.rej_s3_d[0]}   cy={N.rej_s3_d[1]}   />
      <Rej cx={N.rej_s3_1_d[0]} cy={N.rej_s3_1_d[1]} />
      <Rej cx={N.rej_s3_0_x[0]} cy={N.rej_s3_0_x[1]} />
      <Rej cx={N.rej_s3_10_x[0]}cy={N.rej_s3_10_x[1]}/>
      <Rej cx={N.rej_s3_11_x[0]}cy={N.rej_s3_11_x[1]}/>

      {/* ── Stage 4 REJECT node ── */}
      <Rej cx={N.rej_s4_d[0]} cy={N.rej_s4_d[1]} />

      {/* ── Stage 5 REJECT nodes ── */}
      <Rej cx={N.rej_s5_d[0]}   cy={N.rej_s5_d[1]}   />
      <Rej cx={N.rej_s5_1_x[0]} cy={N.rej_s5_1_x[1]} />
      <Rej cx={N.rej_s5_0_x[0]} cy={N.rej_s5_0_x[1]} />
      <Rej cx={N.rej_s5_11_x[0]}cy={N.rej_s5_11_x[1]}/>

      {/* ── Stage 1 READ diamonds ── */}
      <Dmd cx={N.s1[0]}   cy={N.s1[1]}   line1="READ" line2="S1" />
      <Dmd cx={N.s1b1[0]} cy={N.s1b1[1]} line1="READ" line2="1b" />
      <Dmd cx={N.s1b0[0]} cy={N.s1b0[1]} line1="READ" line2="0b" />

      {/* ── Stage 2 LOOP diamond (green variant) ── */}
      <Dmd cx={N.loop[0]} cy={N.loop[1]} line1="LOOP" line2="1+0" loop />

      {/* ── Stage 3 READ diamonds ── */}
      <Dmd cx={N.s3br[0]}  cy={N.s3br[1]}  line1="READ" line2="S3" />
      <Dmd cx={N.s3_1[0]}  cy={N.s3_1[1]}  line1="READ" line2="3a" />
      <Dmd cx={N.s3_0[0]}  cy={N.s3_0[1]}  line1="READ" line2="3b" />
      <Dmd cx={N.s3_10[0]} cy={N.s3_10[1]} line1="READ" line2="3c" />
      <Dmd cx={N.s3_11[0]} cy={N.s3_11[1]} line1="READ" line2="3d" />

      {/* ── Stage 4 READ diamonds ── */}
      <Dmd cx={N.s4br[0]}     cy={N.s4br[1]}     line1="READ" line2="S4" />
      <Dmd cx={N.s4_1loop[0]} cy={N.s4_1loop[1]} line1="LOOP" line2="1*" loop />
      <Dmd cx={N.s4_0loop[0]} cy={N.s4_0loop[1]} line1="LOOP" line2="0*" loop />

      {/* ── Stage 5 READ diamonds ── */}
      <Dmd cx={N.s5br[0]}  cy={N.s5br[1]}  line1="READ" line2="S5" />
      <Dmd cx={N.s5_1[0]}  cy={N.s5_1[1]}  line1="READ" line2="5a" />
      <Dmd cx={N.s5_0[0]}  cy={N.s5_0[1]}  line1="READ" line2="5b" />
      <Dmd cx={N.s5_11[0]} cy={N.s5_11[1]} line1="READ" line2="5c" />

      {/* ── R.ACC ── */}
      <Dmd cx={N.racc[0]} cy={N.racc[1]} line1="R.ACC" />

      {/* ── Diagram footer ── */}
      <text x={VW / 2} y={VH - 12} textAnchor="middle"
        fontSize={10} fill={T.dimLabel} letterSpacing={0.3}>
        Pushdown Automaton · (11+00)(1+0)* (101+111+01)(00*+11*)(1+0+11)
      </text>
    </svg>
  </div>
);

export default PDABinaryFlowchart;
