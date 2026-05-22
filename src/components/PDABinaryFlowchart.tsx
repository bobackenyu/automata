// PDABinaryFlowchart.tsx
// Regex: (11+00)(1+0)*(101+111+01)(00*+11*)(1+0+11)
// Logic sourced from verified flowchart (Image 1).
// Layout organized per reference alignment (Image 2).

export default function PDABinaryFlowchart() {
  // ─── Palette ──────────────────────────────────────────────
  const BG = "#0d0d0d";
  const CYAN = "#74DCFF";
  const CYAN_DIM = "#3a8fa8";
  const READ_FILL = "#0a2233";
  const READ_STROKE = CYAN;
  const REJ_FILL = "#2a0a0a";
  const REJ_STROKE = "#ff4f4f";
  const REJ_TEXT = "#ff6b6b";
  const ACC_FILL = "#0a2a0a";
  const ACC_STROKE = "#4fff7a";
  const ACC_TEXT = "#4fff7a";
  const START_FILL = "#2a0a3a";
  const START_STROKE = "#bf7fff";
  const START_TEXT = "#bf7fff";
  const INTER_FILL = "#0d1a2a";
  const INTER_STROKE = "#4a9abf";
  const LABEL_COLOR = CYAN;

  // ─── Geometry helpers ─────────────────────────────────────
  // Diamond (READ): cx,cy = centre; hw,hh = half-width, half-height
  const diamond = (cx: number, cy: number, hw = 44, hh = 26) =>
    `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;

  // Arrow marker id helpers
  const ARROW_ID = "arr";
  const ARROW_RED_ID = "arr-red";
  const ARROW_ACC_ID = "arr-acc";

  // ─── SVG canvas size ──────────────────────────────────────
  const W = 1760;
  const H = 900;

  // ─── X columns (logical pipeline stages) ─────────────────
  // START | READ1 | (2a/2b) | (3a/3b) | READ4 | (5a/5b) | (6a/6b) |
  // READ7 | (8a/8b/8c) | (9a/9b/9c) | ACCEPT(×3)
  const X = {
    start: 50,
    r1: 130,
    r2: 250,
    r3: 380,
    r4: 520,
    r5: 660,
    r6: 800,
    r7: 960,
    r8: 1110,
    r9: 1300,
    acc: 1520,
    // reject offsets handled per-node
  };

  // ─── Y rows (three parallel tracks + shared nodes) ────────
  const Y = {
    top: 160,      // upper track (101 / 11 path / top accept)
    mid: 440,      // middle track (111 / shared) → also READ4, READ7
    bot: 700,      // lower track (01 / bottom accept)
    start: 440,    // START aligns mid
    // reject nodes sit 90px above/below their parent
  };

  // Shorthand
  const yt = Y.top;
  const ym = Y.mid;
  const yb = Y.bot;

  // ─── Node positions (cx, cy) ──────────────────────────────
  const nodes = {
    // Stage 0
    START: { x: X.start, y: ym },

    // Stage 1 — READ 1 (reads first symbol)
    R1: { x: X.r1, y: ym },

    // Stage 2 — two parallel "first-pair" checks
    R2a: { x: X.r2, y: yt },   // top: read "1" from "11"
    R2b: { x: X.r2, y: yb },   // bot: read "0" from "00"

    // Stage 3
    R3a: { x: X.r3, y: yt },   // read "1" (second of "11")
    R3b: { x: X.r3, y: yb },   // read "0" (second of "00")

    // Stage 4 — merge/fan-out (READ 4) — Kleene star (1+0)*
    R4: { x: X.r4, y: ym },

    // Stage 5 — parallel tracks for 101|111|01
    R5a: { x: X.r5, y: yt - 60 },  // 101 track top
    R5b: { x: X.r5, y: ym + 60 },  // 01  track (lower mid)
    R5c: { x: X.r5, y: yt + 90 },  // 111 track (upper mid)

    // Stage 6
    R6a: { x: X.r6, y: yt - 60 },  // 101: read "0"
    R6b: { x: X.r6, y: ym + 60 },  // 01:  merge with 111 track at this point
    // 111 sub-path
    R6b2: { x: X.r6, y: yt + 90 }, // 111: read "1"

    // Stage 7 — merge back (READ 7) after 101+111+01
    R7: { x: X.r7, y: ym },

    // Stage 8 — (00*+11*) unrolled
    R8a: { x: X.r8, y: yt },   // top "1" track (11*)
    R8b: { x: X.r8, y: ym },   // mid merge
    R8c: { x: X.r8, y: yb },   // bot "0" track (00*)

    // Stage 9 — final (1+0+11) check
    R9a: { x: X.r9, y: yt },
    R9b: { x: X.r9, y: ym },
    R9c: { x: X.r9, y: yb },

    // ACCEPT
    ACC_TOP: { x: X.acc, y: yt },
    ACC_MID: { x: X.acc, y: ym },
    ACC_BOT: { x: X.acc, y: yb },
  };

  // ─── Helpers: path between two diamond centres ─────────────
  type Pt = { x: number; y: number };

  const line = (
    a: Pt,
    b: Pt,
    label = "",
    color = CYAN,
    markerId = ARROW_ID,
    dashed = false
  ) => {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    return (
      <g key={`${a.x},${a.y}-${b.x},${b.y}-${label}`}>
        <line
          x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          stroke={color} strokeWidth={1.5}
          strokeDasharray={dashed ? "5,4" : undefined}
          markerEnd={`url(#${markerId})`}
        />
        {label && (
          <text x={mx} y={my - 7} textAnchor="middle"
            fontSize={11} fill={color} fontFamily="monospace">{label}</text>
        )}
      </g>
    );
  };

  const curve = (
    a: Pt, b: Pt, cpx: number, cpy: number,
    label = "", color = CYAN, markerId = ARROW_ID
  ) => {
    const mx = (a.x + cpx + b.x) / 3;
    const my = (a.y + cpy + b.y) / 3;
    return (
      <g key={`curve-${a.x},${a.y}-${b.x},${b.y}-${label}`}>
        <path
          d={`M${a.x},${a.y} Q${cpx},${cpy} ${b.x},${b.y}`}
          stroke={color} strokeWidth={1.5} fill="none"
          markerEnd={`url(#${markerId})`}
        />
        {label && (
          <text x={mx} y={my - 8} textAnchor="middle"
            fontSize={11} fill={color} fontFamily="monospace">{label}</text>
        )}
      </g>
    );
  };

  // Reject node + edge helper
  const rejNode = (px: number, py: number, dx: number, dy: number, label = "0,Δ") => {
    const rx = px + dx;
    const ry = py + dy;
    return (
      <g key={`rej-${px}-${py}-${dx}-${dy}`}>
        <line x1={px} y1={py} x2={rx} y2={ry}
          stroke={REJ_STROKE} strokeWidth={1.4}
          markerEnd={`url(#${ARROW_RED_ID})`} />
        <text x={(px + rx) / 2 + 6} y={(py + ry) / 2 - 5}
          fontSize={10} fill={REJ_TEXT} fontFamily="monospace">{label}</text>
        <ellipse cx={rx} cy={ry} rx={28} ry={15}
          fill={REJ_FILL} stroke={REJ_STROKE} strokeWidth={1.4} />
        <text x={rx} y={ry + 4} textAnchor="middle"
          fontSize={10} fill={REJ_TEXT} fontFamily="monospace" fontWeight="bold">REJ</text>
      </g>
    );
  };

  // Accept node + edge
  const accNode = (px: number, py: number, tx: number, ty: number, label = "Δ") => (
    <g key={`acc-${px}-${py}`}>
      <line x1={px} y1={py} x2={tx} y2={ty}
        stroke={ACC_STROKE} strokeWidth={1.5}
        markerEnd={`url(#${ARROW_ACC_ID})`} />
      <text x={(px + tx) / 2 + 6} y={(py + ty) / 2 - 5}
        fontSize={11} fill={ACC_TEXT} fontFamily="monospace">{label}</text>
      <ellipse cx={tx} cy={ty} rx={40} ry={18}
        fill={ACC_FILL} stroke={ACC_STROKE} strokeWidth={1.5} />
      <text x={tx} y={ty + 5} textAnchor="middle"
        fontSize={11} fill={ACC_TEXT} fontFamily="monospace" fontWeight="bold">ACCEPT</text>
    </g>
  );

  // READ diamond node
  const readNode = (cx: number, cy: number, label: string,
    hw = 44, hh = 26, fill = READ_FILL, stroke = READ_STROKE) => (
    <g key={`rd-${cx}-${cy}`}>
      <polygon points={diamond(cx, cy, hw, hh)}
        fill={fill} stroke={stroke} strokeWidth={1.6} />
      <text x={cx} y={cy + 4} textAnchor="middle"
        fontSize={10} fill={CYAN} fontFamily="monospace" fontWeight="bold">{label}</text>
    </g>
  );

  // Intermediate / merge diamond (slightly smaller, dimmer stroke)
  const mergeNode = (cx: number, cy: number, label: string) =>
    readNode(cx, cy, label, 40, 22, INTER_FILL, INTER_STROKE);

  // ─── Re-layout: clean grid ────────────────────────────────
  // We use a strict 11-column grid. Columns separated by ~150px.
  // Three horizontal rows: Y=160 (top), Y=440 (mid), Y=700 (bot).
  // Reject nodes: 80px above / below.
  // Accept nodes: rightmost column.

  const COL = (n: number) => 80 + n * 150; // col 0..10
  const ROW = { t: 180, m: 440, b: 700 };
  const RY = 80; // reject offset

  // Named columns
  // 0=START, 1=R1, 2=R2a/R2b, 3=R3a/R3b, 4=R4,
  // 5=R5a/R5b/R5c, 6=R6a/R6b/R6b2, 7=R7,
  // 8=R8a/R8b/R8c, 9=R9a/R9b/R9c, 10=ACCEPT
  const C = Array.from({ length: 11 }, (_, i) => COL(i));
  // C[0]=80, C[1]=230, C[2]=380, C[3]=530, C[4]=680,
  // C[5]=830, C[6]=980, C[7]=1130, C[8]=1280, C[9]=1430, C[10]=1580

  // Canvas width to fit all nodes + margin
  const SVG_W = C[10] + 120;
  const SVG_H = 820;

  // ─── Node coords (clean grid) ──────────────────────────────
  // Stage positions
  const N = {
    START:  { x: C[0], y: ROW.m },
    R1:     { x: C[1], y: ROW.m },

    R2a:    { x: C[2], y: ROW.t }, // 11 path: read first "1"
    R2b:    { x: C[2], y: ROW.b }, // 00 path: read first "0"

    R3a:    { x: C[3], y: ROW.t }, // 11 path: read second "1"
    R3b:    { x: C[3], y: ROW.b }, // 00 path: read second "0"

    R4:     { x: C[4], y: ROW.m }, // merge + (1+0)* Kleene

    // Three parallel tracks for 101 | 111 | 01
    R5a:    { x: C[5], y: ROW.t - 80 }, // 101 first symbol "1"
    R5b:    { x: C[5], y: ROW.m },       // 111 first symbol "1"  ← merged with 01 "0"
    R5c:    { x: C[5], y: ROW.b + 80 }, // 01  first symbol "0"

    R6a:    { x: C[6], y: ROW.t - 80 }, // 101 second symbol "0"
    R6b:    { x: C[6], y: ROW.m },       // 111 second symbol "1" / 01 accepted here
    R6c:    { x: C[6], y: ROW.b + 80 }, // (unused; 01 merges up)

    R7:     { x: C[7], y: ROW.m }, // merge after 101|111|01; also (00*+11*) fan-out

    // (00*+11*) tracks
    R8a:    { x: C[8], y: ROW.t }, // 11* track: "1"
    R8b:    { x: C[8], y: ROW.m }, // shared: ε-jump from R7, or loop back
    R8c:    { x: C[8], y: ROW.b }, // 00* track: "0"

    // (1+0+11) final
    R9a:    { x: C[9], y: ROW.t }, // reads "1" (single 1) or first of "11"
    R9b:    { x: C[9], y: ROW.m }, // reads "0"
    R9c:    { x: C[9], y: ROW.b }, // reads "0" from 00* track

    // ACCEPT
    ACCT:   { x: C[10], y: ROW.t },
    ACCM:   { x: C[10], y: ROW.m },
    ACCB:   { x: C[10], y: ROW.b },
  };

  return (
    <div
      className="w-full h-full overflow-auto cursor-grab active:cursor-grabbing select-none"
      style={{ background: BG, minHeight: "100vh" }}
    >
      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ display: "block", fontFamily: "monospace" }}
      >
        {/* ── Defs: arrowhead markers ── */}
        <defs>
          {/* Cyan arrow */}
          <marker id={ARROW_ID} markerWidth="8" markerHeight="8"
            refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={CYAN} />
          </marker>
          {/* Red arrow (reject) */}
          <marker id={ARROW_RED_ID} markerWidth="8" markerHeight="8"
            refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={REJ_STROKE} />
          </marker>
          {/* Green arrow (accept) */}
          <marker id={ARROW_ACC_ID} markerWidth="8" markerHeight="8"
            refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={ACC_STROKE} />
          </marker>
        </defs>

        {/* ── Background ── */}
        <rect width={SVG_W} height={SVG_H} fill={BG} />

        {/* ════════════════════════════════════════════════════
            SECTION LABEL BANDS
        ════════════════════════════════════════════════════ */}
        {[
          [C[1] - 60, C[1] + 60, "(11+00)"],
          [C[2] - 30, C[4] + 60, "(1+0)*"],
          [C[4] + 70, C[7] - 30, "(101+111+01)"],
          [C[7] + 70, C[9] - 30, "(00*+11*)"],
          [C[9] - 30, C[10] + 40, "(1+0+11)"],
        ].map(([x1, x2, lbl]) => (
          <g key={String(lbl)}>
            <rect x={Number(x1)} y={10} width={Number(x2) - Number(x1)} height={20}
              fill="none" stroke={CYAN_DIM} strokeWidth={0.5} rx={3} opacity={0.35} />
            <text x={(Number(x1) + Number(x2)) / 2} y={25}
              textAnchor="middle" fontSize={10} fill={CYAN_DIM}
              fontFamily="monospace">{lbl}</text>
          </g>
        ))}

        {/* ════════════════════════════════════════════════════
            EDGES
        ════════════════════════════════════════════════════ */}

        {/* START → R1 */}
        {line(N.START, N.R1, "")}

        {/* R1: "1" → R2a, "0" → R2b, else → REJ */}
        {curve(N.R1, N.R2a, C[1] + 40, ROW.t - 20, "1")}
        {curve(N.R1, N.R2b, C[1] + 40, ROW.b + 20, "0")}
        {rejNode(N.R1.x, N.R1.y, -28, 60, "Δ")}

        {/* R2a → R3a on "1", else REJ */}
        {line(N.R2a, N.R3a, "1")}
        {rejNode(N.R2a.x, N.R2a.y, 0, -RY, "0,Δ")}

        {/* R3a: "1"→R4(top→mid merge), else REJ */}
        {curve(N.R3a, N.R4, C[3] + 60, ROW.t - 10, "1")}
        {rejNode(N.R3a.x, N.R3a.y, 0, -RY, "0,Δ")}

        {/* R2b → R3b on "0", else REJ */}
        {line(N.R2b, N.R3b, "0")}
        {rejNode(N.R2b.x, N.R2b.y, 0, RY, "1,Δ")}

        {/* R3b: "0"→R4 (bot→mid merge), else REJ */}
        {curve(N.R3b, N.R4, C[3] + 60, ROW.b + 10, "0")}
        {rejNode(N.R3b.x, N.R3b.y, 0, RY, "1,Δ")}

        {/* ── R4 (Kleene star 1+0)* + fan-out to 101|111|01 ── */}
        {/* R4 self-loop label (represented as back-curve to itself) */}
        <path d={`M${N.R4.x - 20},${N.R4.y - 26} C${N.R4.x - 60},${N.R4.y - 70} ${N.R4.x + 60},${N.R4.y - 70} ${N.R4.x + 20},${N.R4.y - 26}`}
          stroke={CYAN_DIM} strokeWidth={1.2} fill="none"
          markerEnd={`url(#${ARROW_ID})`} />
        <text x={N.R4.x} y={N.R4.y - 72} textAnchor="middle"
          fontSize={10} fill={CYAN_DIM} fontFamily="monospace">0,1</text>

        {/* R4 rejects Δ */}
        {rejNode(N.R4.x, N.R4.y, 0, 70, "Δ")}

        {/* R4 → R5a (101 path: needs "1") */}
        {curve(N.R4, N.R5a, C[4] + 50, ROW.t - 130, "1")}
        {/* R4 → R5b (111 path: needs "1") */}
        {line(N.R4, N.R5b, "1")}
        {/* R4 → R5c (01 path: needs "0") */}
        {curve(N.R4, N.R5c, C[4] + 50, ROW.b + 140, "0")}

        {/* ── 101 track ── */}
        {/* R5a: reads "1" → R6a; else REJ */}
        {line(N.R5a, N.R6a, "0")}
        {rejNode(N.R5a.x, N.R5a.y, 0, -RY, "1,Δ")}
        {/* R6a: reads "1" → R7; else REJ */}
        {curve(N.R6a, N.R7, C[6] + 80, ROW.t - 90, "1")}
        {rejNode(N.R6a.x, N.R6a.y, 0, -RY, "0,Δ")}

        {/* ── 111 track ── */}
        {/* R5b: reads "1" → R6b; else REJ */}
        {line(N.R5b, N.R6b, "1")}
        {rejNode(N.R5b.x, N.R5b.y, -30, -RY + 20, "0,Δ")}
        {/* R6b: reads "1" → R7; else REJ */}
        {line(N.R6b, N.R7, "1")}
        {rejNode(N.R6b.x, N.R6b.y, 0, RY, "0,Δ")}

        {/* ── 01 track ── */}
        {/* R5c: reads "0" → (needs "1" next) → use R6c then R7; else REJ */}
        {line(N.R5c, { x: N.R6c.x, y: N.R5c.y }, "1")}
        {rejNode(N.R5c.x, N.R5c.y, 0, RY, "0,Δ")}
        {/* "01" path: after "0" reads one "1" → goes to R7 */}
        {curve({ x: N.R6c.x, y: N.R5c.y }, N.R7, C[6] + 80, ROW.b + 170, "Δ")}

        {/* ── R7 merge: fan into (00*+11*) ── */}
        {rejNode(N.R7.x, N.R7.y, 30, -RY + 10, "Δ")}

        {/* R7 → R8a ("1" path for 11*) */}
        {curve(N.R7, N.R8a, C[7] + 80, ROW.t - 30, "1")}
        {/* R7 → R8b (ε / mid merge) */}
        {line(N.R7, N.R8b, "ε", CYAN_DIM, ARROW_ID, true)}
        {/* R7 → R8c ("0" path for 00*) */}
        {curve(N.R7, N.R8c, C[7] + 80, ROW.b + 30, "0")}

        {/* ── 11* track (R8a) ── */}
        {/* R8a self-loop on "1" */}
        <path d={`M${N.R8a.x - 18},${N.R8a.y - 26} C${N.R8a.x - 50},${N.R8a.y - 65} ${N.R8a.x + 50},${N.R8a.y - 65} ${N.R8a.x + 18},${N.R8a.y - 26}`}
          stroke={CYAN_DIM} strokeWidth={1.2} fill="none"
          markerEnd={`url(#${ARROW_ID})`} />
        <text x={N.R8a.x} y={N.R8a.y - 67} textAnchor="middle"
          fontSize={10} fill={CYAN_DIM} fontFamily="monospace">1</text>
        {/* R8a → R9a (Δ) */}
        {line(N.R8a, N.R9a, "Δ")}
        {rejNode(N.R8a.x, N.R8a.y, 30, RY, "0,Δ")}

        {/* ── 00* track (R8c) ── */}
        <path d={`M${N.R8c.x - 18},${N.R8c.y + 26} C${N.R8c.x - 50},${N.R8c.y + 65} ${N.R8c.x + 50},${N.R8c.y + 65} ${N.R8c.x + 18},${N.R8c.y + 26}`}
          stroke={CYAN_DIM} strokeWidth={1.2} fill="none"
          markerEnd={`url(#${ARROW_ID})`} />
        <text x={N.R8c.x} y={N.R8c.y + 75} textAnchor="middle"
          fontSize={10} fill={CYAN_DIM} fontFamily="monospace">0</text>
        {/* R8c → R9c (Δ) */}
        {line(N.R8c, N.R9c, "Δ")}
        {rejNode(N.R8c.x, N.R8c.y, 30, -RY, "1,Δ")}

        {/* R8b (mid merge) → R9b */}
        {line(N.R8b, N.R9b, "0,1")}
        {rejNode(N.R8b.x, N.R8b.y, 0, -RY, "Δ")}

        {/* ── (1+0+11) final ── */}
        {/* R9a: "1" → ACCT (single 1); second track "1"→loop-one-more then ACCT */}
        {line(N.R9a, N.ACCT, "1")}
        {rejNode(N.R9a.x, N.R9a.y, 0, -RY, "0,Δ")}

        {/* R9b: "0" → ACCM; "1" → ACCM */}
        {line(N.R9b, N.ACCM, "0,1")}
        {rejNode(N.R9b.x, N.R9b.y, 0, -RY, "Δ")}

        {/* R9c: "1" → ACCB */}
        {line(N.R9c, N.ACCB, "1")}
        {rejNode(N.R9c.x, N.R9c.y, 0, RY, "0,Δ")}

        {/* ════════════════════════════════════════════════════
            NODES (drawn on top of edges)
        ════════════════════════════════════════════════════ */}

        {/* START oval */}
        <ellipse cx={N.START.x} cy={N.START.y} rx={36} ry={20}
          fill={START_FILL} stroke={START_STROKE} strokeWidth={1.8} />
        <text x={N.START.x} y={N.START.y + 5} textAnchor="middle"
          fontSize={11} fill={START_TEXT} fontFamily="monospace" fontWeight="bold">START</text>

        {/* Stage 1 */}
        {readNode(N.R1.x, N.R1.y, "READ\n1")}
        <text x={N.R1.x} y={N.R1.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R1.x} y={N.R1.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">1</text>

        {/* Stage 2 */}
        {readNode(N.R2a.x, N.R2a.y, "")}
        <text x={N.R2a.x} y={N.R2a.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R2a.x} y={N.R2a.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">2a</text>

        {readNode(N.R2b.x, N.R2b.y, "")}
        <text x={N.R2b.x} y={N.R2b.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R2b.x} y={N.R2b.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">2b</text>

        {/* Stage 3 */}
        {readNode(N.R3a.x, N.R3a.y, "")}
        <text x={N.R3a.x} y={N.R3a.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R3a.x} y={N.R3a.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">3a</text>

        {readNode(N.R3b.x, N.R3b.y, "")}
        <text x={N.R3b.x} y={N.R3b.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R3b.x} y={N.R3b.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">3b</text>

        {/* Stage 4 merge */}
        {mergeNode(N.R4.x, N.R4.y, "")}
        <text x={N.R4.x} y={N.R4.y - 6} textAnchor="middle" fontSize={9} fill={INTER_STROKE} fontFamily="monospace">READ</text>
        <text x={N.R4.x} y={N.R4.y + 8} textAnchor="middle" fontSize={9} fill={INTER_STROKE} fontFamily="monospace">4</text>

        {/* Stage 5 */}
        {readNode(N.R5a.x, N.R5a.y, "")}
        <text x={N.R5a.x} y={N.R5a.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R5a.x} y={N.R5a.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">5a</text>

        {readNode(N.R5b.x, N.R5b.y, "")}
        <text x={N.R5b.x} y={N.R5b.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R5b.x} y={N.R5b.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">5b</text>

        {readNode(N.R5c.x, N.R5c.y, "")}
        <text x={N.R5c.x} y={N.R5c.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R5c.x} y={N.R5c.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">5c</text>

        {/* Stage 6 */}
        {readNode(N.R6a.x, N.R6a.y, "")}
        <text x={N.R6a.x} y={N.R6a.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R6a.x} y={N.R6a.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">6a</text>

        {readNode(N.R6b.x, N.R6b.y, "")}
        <text x={N.R6b.x} y={N.R6b.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R6b.x} y={N.R6b.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">6b</text>

        {/* Stage 7 merge */}
        {mergeNode(N.R7.x, N.R7.y, "")}
        <text x={N.R7.x} y={N.R7.y - 6} textAnchor="middle" fontSize={9} fill={INTER_STROKE} fontFamily="monospace">READ</text>
        <text x={N.R7.x} y={N.R7.y + 8} textAnchor="middle" fontSize={9} fill={INTER_STROKE} fontFamily="monospace">7</text>

        {/* Stage 8 */}
        {readNode(N.R8a.x, N.R8a.y, "")}
        <text x={N.R8a.x} y={N.R8a.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R8a.x} y={N.R8a.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">8a</text>

        {readNode(N.R8b.x, N.R8b.y, "")}
        <text x={N.R8b.x} y={N.R8b.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R8b.x} y={N.R8b.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">8b</text>

        {readNode(N.R8c.x, N.R8c.y, "")}
        <text x={N.R8c.x} y={N.R8c.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R8c.x} y={N.R8c.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">8c</text>

        {/* Stage 9 */}
        {readNode(N.R9a.x, N.R9a.y, "")}
        <text x={N.R9a.x} y={N.R9a.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R9a.x} y={N.R9a.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">9a</text>

        {readNode(N.R9b.x, N.R9b.y, "")}
        <text x={N.R9b.x} y={N.R9b.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R9b.x} y={N.R9b.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">9b</text>

        {readNode(N.R9c.x, N.R9c.y, "")}
        <text x={N.R9c.x} y={N.R9c.y - 6} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">READ</text>
        <text x={N.R9c.x} y={N.R9c.y + 8} textAnchor="middle" fontSize={9} fill={CYAN} fontFamily="monospace">9c</text>

        {/* ACCEPT nodes */}
        {accNode(N.R9a.x + 44, N.R9a.y, N.ACCT.x, N.ACCT.y, "Δ")}
        {accNode(N.R9b.x + 44, N.R9b.y, N.ACCM.x, N.ACCM.y, "Δ")}
        {accNode(N.R9c.x + 44, N.R9c.y, N.ACCB.x, N.ACCB.y, "Δ")}

        {/* ── Legend ── */}
        <g transform={`translate(${SVG_W - 155}, ${SVG_H - 160})`}>
          <rect x={0} y={0} width={148} height={148} rx={6}
            fill="#111" stroke={CYAN_DIM} strokeWidth={0.8} opacity={0.85} />
          <text x={74} y={20} textAnchor="middle" fontSize={11}
            fill={CYAN} fontFamily="monospace" fontWeight="bold">Legend</text>

          {/* READ diamond */}
          <polygon points="18,40 36,50 18,60 0,50" fill={READ_FILL} stroke={READ_STROKE} strokeWidth={1.3} />
          <text x={46} y={54} fontSize={10} fill={CYAN} fontFamily="monospace">READ state</text>

          {/* Merge diamond */}
          <polygon points="18,76 36,86 18,96 0,86" fill={INTER_FILL} stroke={INTER_STROKE} strokeWidth={1.3} />
          <text x={46} y={90} fontSize={10} fill={CYAN_DIM} fontFamily="monospace">Merge/fan-out</text>

          {/* REJ ellipse */}
          <ellipse cx={18} cy={114} rx={16} ry={10} fill={REJ_FILL} stroke={REJ_STROKE} strokeWidth={1.3} />
          <text x={18} y={118} textAnchor="middle" fontSize={8} fill={REJ_TEXT} fontFamily="monospace">REJ</text>
          <text x={46} y={118} fontSize={10} fill={REJ_TEXT} fontFamily="monospace">Reject</text>

          {/* ACCEPT ellipse */}
          <ellipse cx={18} cy={138} rx={16} ry={10} fill={ACC_FILL} stroke={ACC_STROKE} strokeWidth={1.3} />
          <text x={18} y={142} textAnchor="middle" fontSize={8} fill={ACC_TEXT} fontFamily="monospace">ACC</text>
          <text x={46} y={142} fontSize={10} fill={ACC_TEXT} fontFamily="monospace">Accept</text>
        </g>

        {/* ── Regex caption ── */}
        <text x={SVG_W / 2} y={SVG_H - 12} textAnchor="middle"
          fontSize={10} fill={CYAN_DIM} fontFamily="monospace">
          (11+00)(1+0)*(101+111+01)(00*+11*)(1+0+11)
        </text>
      </svg>
    </div>
  );
}


