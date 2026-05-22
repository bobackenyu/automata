import React, { useRef, useState, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Node {
  id: string;
  x: number;
  y: number;
  type: "start" | "read" | "accept" | "reject" | "racc";
  label: string;
  sub?: string;
}

interface Edge {
  from: string;
  to: string;
  label: string;
  /** Optional explicit control-point offsets [cx1,cy1,cx2,cy2] for cubic bezier */
  cp?: [number, number, number, number];
  /** For self-loops provide a loop direction hint */
  loop?: "top" | "bottom" | "left" | "right";
  /** label offset from midpoint */
  lx?: number;
  ly?: number;
}

// ─── Layout constants ────────────────────────────────────────────────────────
const DW = 54;   // diamond half-width
const DH = 30;   // diamond half-height
const RX = 28;   // read-node rx ellipse
const RY = 16;   // read-node ry ellipse (but diamond is used)
const CYN = "#74DCFF";
const RED = "#FF4444";
const GRN = "#00FF99";
const PUR = "#9B59B6";
const DARK = "#0d0d0d";
const GRID_W = 2000;
const GRID_H = 820;

// ─── Node definitions (x,y = center) ────────────────────────────────────────
const NODES: Node[] = [
  // Spine
  { id: "START",  x: 60,   y: 410, type: "start",  label: "START" },
  { id: "R1",     x: 180,  y: 410, type: "read",   label: "READ", sub: "1" },

  // Upper path (11)
  { id: "R2a",    x: 320,  y: 270, type: "read",   label: "READ", sub: "2a" },
  { id: "R3a",    x: 460,  y: 270, type: "read",   label: "READ", sub: "3a" },

  // Lower path (00)
  { id: "R2b",    x: 320,  y: 550, type: "read",   label: "READ", sub: "2b" },
  { id: "R3b",    x: 460,  y: 550, type: "read",   label: "READ", sub: "3b" },

  // (1+0)* convergence / middle hub
  { id: "R4",     x: 620,  y: 410, type: "read",   label: "READ", sub: "4" },

  // (101+111+01) upper sub-path
  { id: "R5a",    x: 760,  y: 270, type: "read",   label: "READ", sub: "5a" },
  { id: "R6a",    x: 900,  y: 270, type: "read",   label: "READ", sub: "6a" },

  // (101+111+01) lower sub-path
  { id: "R5b",    x: 760,  y: 550, type: "read",   label: "READ", sub: "5b" },
  { id: "R6b",    x: 900,  y: 550, type: "read",   label: "READ", sub: "6b" },

  // (00*+11*) section
  { id: "R7",     x: 1060, y: 410, type: "read",   label: "READ", sub: "7" },
  { id: "R8a",    x: 1200, y: 270, type: "read",   label: "READ", sub: "8a" },
  { id: "R8b",    x: 1200, y: 410, type: "read",   label: "READ", sub: "8b" },
  { id: "R8c",    x: 1200, y: 550, type: "read",   label: "READ", sub: "8c" },

  // (1+0+11) terminals → ACCEPT
  { id: "R9a",    x: 1380, y: 270, type: "read",   label: "READ", sub: "9a" },
  { id: "R9b",    x: 1380, y: 410, type: "read",   label: "READ", sub: "9b" },
  { id: "R9c",    x: 1380, y: 550, type: "read",   label: "READ", sub: "9c" },

  // ACCEPT nodes
  { id: "ACC_a",  x: 1560, y: 270, type: "accept", label: "ACCEPT" },
  { id: "ACC_b",  x: 1560, y: 410, type: "accept", label: "ACCEPT" },
  { id: "ACC_c",  x: 1560, y: 550, type: "accept", label: "ACCEPT" },

  // REJECT nodes — one per failed branch
  { id: "REJ_R1_d",  x: 180,  y: 530, type: "reject", label: "REJECT" },  // Δ from R1
  { id: "REJ_R2a",   x: 320,  y: 150, type: "reject", label: "REJECT" },  // bad bit after 1
  { id: "REJ_R2b",   x: 320,  y: 670, type: "reject", label: "REJECT" },  // bad bit after 0
  { id: "REJ_R3a",   x: 460,  y: 150, type: "reject", label: "REJECT" },
  { id: "REJ_R3b",   x: 460,  y: 670, type: "reject", label: "REJECT" },
  { id: "REJ_R4",    x: 620,  y: 530, type: "reject", label: "REJECT" },  // Δ
  { id: "REJ_R5a",   x: 760,  y: 150, type: "reject", label: "REJECT" },
  { id: "REJ_R5b",   x: 760,  y: 670, type: "reject", label: "REJECT" },
  { id: "REJ_R6a",   x: 900,  y: 150, type: "reject", label: "REJECT" },
  { id: "REJ_R6b",   x: 900,  y: 670, type: "reject", label: "REJECT" },
  { id: "REJ_R7",    x: 1060, y: 270, type: "reject", label: "REJECT" },
  { id: "REJ_R8a",   x: 1200, y: 150, type: "reject", label: "REJECT" },
  { id: "REJ_R8b_t", x: 1200, y: 290, type: "reject", label: "REJECT" },
  { id: "REJ_R8c",   x: 1200, y: 670, type: "reject", label: "REJECT" },
  { id: "REJ_R9a",   x: 1380, y: 150, type: "reject", label: "REJECT" },
  { id: "REJ_R9b",   x: 1380, y: 290, type: "reject", label: "REJECT" },
  { id: "REJ_R9c",   x: 1380, y: 670, type: "reject", label: "REJECT" },
];

// ─── Edge definitions ────────────────────────────────────────────────────────
const EDGES: Edge[] = [
  // START → R1
  { from: "START", to: "R1",   label: "" },

  // R1 branches
  { from: "R1", to: "R2a",         label: "1" },
  { from: "R1", to: "R2b",         label: "0" },
  { from: "R1", to: "REJ_R1_d",    label: "Δ" },

  // Upper (11) path
  { from: "R2a", to: "R3a",        label: "1" },
  { from: "R2a", to: "REJ_R2a",    label: "0,Δ" },
  { from: "R3a", to: "R4",         label: "" ,  lx: 0, ly: -12 },
  { from: "R3a", to: "REJ_R3a",    label: "Δ" },

  // Lower (00) path
  { from: "R2b", to: "R3b",        label: "0" },
  { from: "R2b", to: "REJ_R2b",    label: "1,Δ" },
  { from: "R3b", to: "R4",         label: "" },
  { from: "R3b", to: "REJ_R3b",    label: "Δ" },

  // R4 self-loop (1+0)*
  { from: "R4",  to: "R4",         label: "0,1", loop: "top" },

  // R4 → branching to (101+111+01)
  { from: "R4",  to: "R5a",        label: "1" },
  { from: "R4",  to: "R5b",        label: "0" },
  { from: "R4",  to: "REJ_R4",     label: "Δ" },

  // Upper (101 / 111) sub-path
  { from: "R5a", to: "R6a",        label: "0,1" },
  { from: "R5a", to: "REJ_R5a",    label: "Δ" },
  { from: "R6a", to: "R7",         label: "1" },
  { from: "R6a", to: "REJ_R6a",    label: "0,Δ" },

  // Lower (01) sub-path
  { from: "R5b", to: "R6b",        label: "1" },
  { from: "R5b", to: "REJ_R5b",    label: "0,Δ" },
  { from: "R6b", to: "R7",         label: "1" },
  { from: "R6b", to: "REJ_R6b",    label: "0,Δ" },

  // R7 → (00*+11*) section
  { from: "R7",  to: "R8a",        label: "1" },
  { from: "R7",  to: "R8c",        label: "0" },
  { from: "R7",  to: "REJ_R7",     label: "Δ" },

  // R8a (11* path)
  { from: "R8a", to: "R8a",        label: "1", loop: "top" },
  { from: "R8a", to: "R9a",        label: "1", lx: 0, ly: -12 },
  { from: "R8a", to: "REJ_R8a",    label: "0,Δ" },

  // R8b middle neutral
  { from: "R8b", to: "R9b",        label: "0,1" },
  { from: "R8b", to: "REJ_R8b_t",  label: "Δ" },

  // R8c (00* path)
  { from: "R8c", to: "R8c",        label: "0", loop: "bottom" },
  { from: "R8c", to: "R9c",        label: "0" },
  { from: "R8c", to: "REJ_R8c",    label: "1,Δ" },

  // R7 → R8b (neutral middle, epsilon / short path)
  { from: "R7",  to: "R8b",        label: "ε" },

  // Final (1+0+11) terminals
  { from: "R9a", to: "ACC_a",      label: "1" },
  { from: "R9a", to: "REJ_R9a",    label: "0,Δ" },

  { from: "R9b", to: "ACC_b",      label: "0,1" },
  { from: "R9b", to: "REJ_R9b",    label: "Δ" },

  { from: "R9c", to: "ACC_c",      label: "1" },
  { from: "R9c", to: "REJ_R9c",    label: "0,Δ" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function nodeById(id: string): Node {
  const n = NODES.find((n) => n.id === id);
  if (!n) throw new Error(`Node not found: ${id}`);
  return n;
}

/** Get border point of a node in direction of angle θ (radians) */
function borderPoint(n: Node, θ: number): [number, number] {
  if (n.type === "start" || n.type === "accept" || n.type === "racc") {
    // ellipse
    const rx = n.type === "start" ? 36 : 44;
    const ry = 18;
    return [n.x + rx * Math.cos(θ), n.y + ry * Math.sin(θ)];
  }
  if (n.type === "reject") {
    // small ellipse
    return [n.x + 34 * Math.cos(θ), n.y + 16 * Math.sin(θ)];
  }
  // diamond — find intersection of ray from center with diamond edges
  const dx = Math.cos(θ);
  const dy = Math.sin(θ);
  // Diamond vertices: top, right, bottom, left
  const hw = DW, hh = DH;
  // Parametric: P = center + t*(dx,dy)
  // Edges: top-right, right-bottom, bottom-left, left-top
  const edges: [[number,number],[number,number]][] = [
    [[0, -hh], [hw, 0]],
    [[hw, 0],  [0,  hh]],
    [[0,  hh], [-hw, 0]],
    [[-hw, 0], [0, -hh]],
  ];
  let best: [number,number] = [n.x + dx * hw, n.y + dy * hh];
  let tMin = Infinity;
  for (const [[ax, ay], [bx, by]] of edges) {
    // Ray: P = t*(dx,dy),  Line: Q = (ax,ay) + s*((bx-ax),(by-ay))
    const ex = bx - ax, ey = by - ay;
    const denom = dx * ey - dy * ex;
    if (Math.abs(denom) < 1e-8) continue;
    const t = (ax * ey - ay * ex) / denom;
    const s = (ax * dy - ay * dx) / denom;
    if (t > 1e-6 && s >= 0 && s <= 1 && t < tMin) {
      tMin = t;
      best = [n.x + t * dx, n.y + t * dy];
    }
  }
  return best;
}

function angle(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

// ─── SVG sub-components ──────────────────────────────────────────────────────
function Diamond({ n }: { n: Node }) {
  const pts = `${n.x},${n.y - DH} ${n.x + DW},${n.y} ${n.x},${n.y + DH} ${n.x - DW},${n.y}`;
  return (
    <g>
      <polygon points={pts} fill="#0a1a2a" stroke={CYN} strokeWidth={1.5} />
      <text x={n.x} y={n.y - 6} textAnchor="middle" fill={CYN} fontSize={9} fontFamily="monospace" fontWeight="bold">
        {n.label}
      </text>
      <text x={n.x} y={n.y + 8} textAnchor="middle" fill={CYN} fontSize={8} fontFamily="monospace">
        {n.sub}
      </text>
    </g>
  );
}

function StartNode({ n }: { n: Node }) {
  return (
    <g>
      <ellipse cx={n.x} cy={n.y} rx={36} ry={18} fill="#2a0a4a" stroke={PUR} strokeWidth={1.5} />
      <text x={n.x} y={n.y + 4} textAnchor="middle" fill={PUR} fontSize={9} fontFamily="monospace" fontWeight="bold">
        {n.label}
      </text>
    </g>
  );
}

function AcceptNode({ n }: { n: Node }) {
  return (
    <g>
      <ellipse cx={n.x} cy={n.y} rx={44} ry={18} fill="#003322" stroke={GRN} strokeWidth={2} />
      <ellipse cx={n.x} cy={n.y} rx={40} ry={14} fill="none" stroke={GRN} strokeWidth={0.8} />
      <text x={n.x} y={n.y + 4} textAnchor="middle" fill={GRN} fontSize={9} fontFamily="monospace" fontWeight="bold">
        {n.label}
      </text>
    </g>
  );
}

function RejectNode({ n }: { n: Node }) {
  return (
    <g>
      <ellipse cx={n.x} cy={n.y} rx={34} ry={16} fill="#2a0000" stroke={RED} strokeWidth={1.5} />
      <text x={n.x} y={n.y + 4} textAnchor="middle" fill={RED} fontSize={9} fontFamily="monospace" fontWeight="bold">
        {n.label}
      </text>
    </g>
  );
}

function renderNode(n: Node) {
  switch (n.type) {
    case "start":  return <StartNode key={n.id} n={n} />;
    case "accept":
    case "racc":   return <AcceptNode key={n.id} n={n} />;
    case "reject": return <RejectNode key={n.id} n={n} />;
    default:       return <Diamond key={n.id} n={n} />;
  }
}

// ─── Arrow marker ─────────────────────────────────────────────────────────────
function Defs() {
  return (
    <defs>
      <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill={CYN} />
      </marker>
      <marker id="arr-red" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill={RED} />
      </marker>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

// ─── Edge renderer ───────────────────────────────────────────────────────────
function EdgeLine({ e }: { e: Edge }) {
  const fromN = nodeById(e.from);
  const toN   = nodeById(e.to);
  const isRej = toN.type === "reject";
  const color = isRej ? RED : CYN;
  const marker = isRej ? "url(#arr-red)" : "url(#arr)";

  // Self-loop
  if (e.from === e.to) {
    const lx = e.loop === "bottom" ? fromN.x : fromN.x;
    const ly = e.loop === "bottom" ? fromN.y + DH : fromN.y - DH;
    const r  = e.loop === "bottom" ? 28 : 28;
    const sweep = e.loop === "bottom" ? 1 : 0;
    // Arc from left border-top to right border-top via top
    const x1 = fromN.x - 20, y1 = ly;
    const x2 = fromN.x + 20, y2 = ly;
    const path = `M${x1},${y1} A${r},${r} 0 1,${sweep} ${x2},${y2}`;
    const mx = lx, my = e.loop === "bottom" ? ly + 38 : ly - 38;
    return (
      <g>
        <path d={path} fill="none" stroke={color} strokeWidth={1.2} markerEnd={marker} />
        <text x={mx + (e.lx ?? 0)} y={my + (e.ly ?? 0)} textAnchor="middle" fill={color} fontSize={9} fontFamily="monospace">{e.label}</text>
      </g>
    );
  }

  const θ = angle(fromN.x, fromN.y, toN.x, toN.y);
  const θ_rev = θ + Math.PI;
  let [x1, y1] = borderPoint(fromN, θ);
  let [x2, y2] = borderPoint(toN, θ_rev);

  let pathD: string;
  let mx: number, my: number;

  if (e.cp) {
    const [cx1, cy1, cx2, cy2] = e.cp;
    pathD = `M${x1},${y1} C${cx1},${cy1} ${cx2},${cy2} ${x2},${y2}`;
    mx = (x1 + x2) / 2; my = (y1 + y2) / 2;
  } else {
    pathD = `M${x1},${y1} L${x2},${y2}`;
    mx = (x1 + x2) / 2; my = (y1 + y2) / 2;
  }

  return (
    <g>
      <path d={pathD} fill="none" stroke={color} strokeWidth={1.2} markerEnd={marker} />
      {e.label && (
        <text x={mx + (e.lx ?? 0)} y={my + (e.ly ?? 0) - 5} textAnchor="middle" fill={color} fontSize={9} fontFamily="monospace">{e.label}</text>
      )}
    </g>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
const PDABinaryFlowchart: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [scroll, setScroll] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ mx: number; my: number; sx: number; sy: number } | null>(null);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      sx: containerRef.current.scrollLeft,
      sy: containerRef.current.scrollTop,
    };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !dragStart.current || !containerRef.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    containerRef.current.scrollLeft = dragStart.current.sx - dx;
    containerRef.current.scrollTop  = dragStart.current.sy - dy;
  }, [isDragging]);

  const onMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStart.current = null;
  }, []);

  return (
    <div style={{ background: DARK, width: "100%", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "10px 20px",
        borderBottom: `1px solid ${CYN}22`,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexShrink: 0,
      }}>
        <span style={{ color: CYN, fontFamily: "monospace", fontSize: 13, fontWeight: "bold" }}>
          Pushdown Automaton
        </span>
        <span style={{ color: "#666", fontFamily: "monospace", fontSize: 11 }}>
          (11+00)(1+0)* (101+111+01)(00*+11*)(1+0+11)
        </span>
        <span style={{ marginLeft: "auto", color: "#444", fontFamily: "monospace", fontSize: 10 }}>
          drag to pan · scroll to zoom
        </span>
      </div>

      {/* Scrollable canvas */}
      <div
        ref={containerRef}
        className="w-full h-full overflow-auto cursor-grab active:cursor-grabbing select-none"
        style={{ flex: 1, overflow: "auto", cursor: isDragging ? "grabbing" : "grab", userSelect: "none" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg
          width={GRID_W}
          height={GRID_H}
          viewBox={`0 0 ${GRID_W} ${GRID_H}`}
          style={{ display: "block", background: DARK }}
        >
          <Defs />

          {/* Subtle grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40,0 L0,0 L0,40" fill="none" stroke="#ffffff08" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={GRID_W} height={GRID_H} fill="url(#grid)" />

          {/* Section labels */}
          {[
            { x: 120, label: "(11+00)" },
            { x: 560, label: "(1+0)*" },
            { x: 830, label: "(101+111+01)" },
            { x: 1130, label: "(00*+11*)" },
            { x: 1380, label: "(1+0+11)" },
            { x: 1560, label: "ACCEPT" },
          ].map((s, i) => (
            <text key={i} x={s.x} y={24} textAnchor="middle" fill={CYN + "55"} fontSize={10} fontFamily="monospace" fontStyle="italic">
              {s.label}
            </text>
          ))}

          {/* Edges (drawn under nodes) */}
          {EDGES.map((e, i) => <EdgeLine key={i} e={e} />)}

          {/* Nodes */}
          {NODES.map((n) => renderNode(n))}
        </svg>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", gap: 24, padding: "8px 20px",
        borderTop: `1px solid ${CYN}22`,
        flexShrink: 0,
      }}>
        {[
          { color: PUR, label: "START" },
          { color: CYN, label: "READ state" },
          { color: GRN, label: "ACCEPT" },
          { color: RED, label: "REJECT" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: l.color }} />
            <span style={{ color: l.color, fontFamily: "monospace", fontSize: 10 }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PDABinaryFlowchart;

