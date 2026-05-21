import React, { useEffect, useState } from "react";

// ─────────────────────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────────────────────

type PDAState = "q0" | "q1" | "q2" | "q_accept" | "q_reject";
type RegexChoice = "regex1" | "regex2";

interface SimStep {
  step: number;
  state: PDAState;
  symbolRead: string;
  stackOp: string;
  stackSnapshot: string[];
  remainingInput: string;
  description: string;
}

interface SimResult {
  accepted: boolean;
  steps: SimStep[];
}

// ─────────────────────────────────────────────────────────────
//  PDA ENGINE
// ─────────────────────────────────────────────────────────────

function getConfig(regex: RegexChoice) {
  if (regex === "regex1") {
    return {
      sigma: "{ 0, 1 }",
      gamma: "{ $, 0, 1 }",
      pattern: "(11+00)(1+0)*(101+111+01)(00*+11*)(1+0+11)",
      alphabet: ["0", "1"] as string[],
      validate: (s: string) =>
        /^(11|00)(0|1)*(101|111|01)(0+|1+)(1|0|11)$/.test(s),
      symToStack: (c: string) => c,
    };
  }
  return {
    sigma: "{ a, b }",
    gamma: "{ $, A, B }",
    pattern: "(a+b)(a+b)*(aa+bb)(ab+ba)(a+b)*(aba+baa)",
    alphabet: ["a", "b"] as string[],
    validate: (s: string) =>
      /^(a|b)(a|b)*(aa|bb)(ab|ba)(a|b)*(aba|baa)$/.test(s),
    symToStack: (c: string) => c.toUpperCase(),
  };
}

function runPDA(input: string, regex: RegexChoice): SimResult {
  const cfg = getConfig(regex);
  const steps: SimStep[] = [];
  let n = 0;

  const push = (stack: string[], sym: string): string[] => [sym, ...stack];
  const snap = (stack: string[]) => [...stack];

  let stack: string[] = ["$"];
  let state: PDAState = "q0";

  steps.push({
    step: n++, state, symbolRead: "—", stackOp: "noop",
    stackSnapshot: snap(stack), remainingInput: input,
    description: "Initial configuration. Stack initialised with Z₀ = $.",
  });

  if (input.length === 0) {
    state = "q_reject";
    steps.push({
      step: n++, state, symbolRead: "ε", stackOp: "noop",
      stackSnapshot: snap(stack), remainingInput: "",
      description: "Empty string — language requires at least one symbol. Reject.",
    });
    return { accepted: false, steps };
  }

  for (const ch of input) {
    if (!cfg.alphabet.includes(ch)) {
      state = "q_reject";
      steps.push({
        step: n++, state, symbolRead: ch, stackOp: "noop",
        stackSnapshot: snap(stack), remainingInput: input,
        description: `Symbol '${ch}' ∉ Σ = ${cfg.sigma}. Reject.`,
      });
      return { accepted: false, steps };
    }
  }

  const first = input[0];
  const firstSym = cfg.symToStack(first);
  stack = push(stack, firstSym);
  state = "q1";
  steps.push({
    step: n++, state, symbolRead: first, stackOp: `push ${firstSym}`,
    stackSnapshot: snap(stack), remainingInput: input.slice(1),
    description: `δ(q0, ${first}, $) → (q1, push '${firstSym}'). Transition to reading state.`,
  });

  for (let i = 1; i < input.length; i++) {
    const ch = input[i];
    const sym = cfg.symToStack(ch);
    stack = push(stack, sym);
    steps.push({
      step: n++, state, symbolRead: ch, stackOp: `push ${sym}`,
      stackSnapshot: snap(stack), remainingInput: input.slice(i + 1),
      description: `δ(q1, ${ch}, ${stack[1]}) → (q1, push '${sym}'). Continue reading input.`,
    });
  }

  state = "q2";
  steps.push({
    step: n++, state, symbolRead: "ε", stackOp: "noop",
    stackSnapshot: snap(stack), remainingInput: "",
    description: "ε-transition: all input consumed. Move to q2 to verify regex pattern.",
  });

  const accepted = cfg.validate(input);
  state = accepted ? "q_accept" : "q_reject";

  if (accepted) {
    while (stack.length > 1) stack.shift();
    stack.shift();
  }

  steps.push({
    step: n++, state, symbolRead: "ε",
    stackOp: accepted ? "pop $" : "noop",
    stackSnapshot: snap(stack), remainingInput: "",
    description: accepted
      ? "String satisfies the regex pattern. Pop Z₀ ($). Move to q_accept. ✓"
      : "String does not satisfy the full regex pattern. Move to q_reject. ✗",
  });

  return { accepted, steps };
}

// ─────────────────────────────────────────────────────────────
//  SVG FLOWCHART DIAGRAM
//  Matches professor's format exactly:
//    Ovals   → START, ACCEPT, REJECT
//    Diamonds → READ₁, READ₂, POP
//    Rectangles → PUSH sym
//  Edge labels: symbol chars + Δ for empty/blank
// ─────────────────────────────────────────────────────────────

const COLORS = {
  oval:    { fill: "#ffffff", stroke: "#1a1a1a" },
  diamond: { fill: "#ffffff", stroke: "#1a1a1a" },
  rect:    { fill: "#1a1a1a", stroke: "#1a1a1a" },
  arrow:   "#1a1a1a",
  label:   "#1a1a1a",
  active:  { fill: "#74DCFF", stroke: "#1a1a1a" },
  accept:  { fill: "#bbf7d0", stroke: "#16a34a" },
  reject:  { fill: "#fecaca", stroke: "#dc2626" },
};

// ── shared SVG primitives ────────────────────────────────────

const Oval: React.FC<{
  cx: number; cy: number; rx?: number; ry?: number;
  label: string; variant?: "default" | "accept" | "reject" | "active";
}> = ({ cx, cy, rx = 44, ry = 22, label, variant = "default" }) => {
  const col =
    variant === "accept" ? COLORS.accept :
    variant === "reject" ? COLORS.reject :
    variant === "active" ? COLORS.active :
    COLORS.oval;
  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
        fill={col.fill} stroke={col.stroke} strokeWidth={1.8} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        fontSize={11} fontWeight={600} fill={variant === "active" ? "#000" : "#1a1a1a"}>
        {label}
      </text>
    </g>
  );
};

const Diamond: React.FC<{
  cx: number; cy: number; hw?: number; hh?: number;
  label: string; sub?: string; active?: boolean;
}> = ({ cx, cy, hw = 46, hh = 28, label, sub, active = false }) => {
  const pts = `${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`;
  return (
    <g>
      <polygon points={pts}
        fill={active ? COLORS.active.fill : COLORS.diamond.fill}
        stroke={active ? COLORS.active.stroke : COLORS.diamond.stroke}
        strokeWidth={1.8} />
      <text x={cx} y={sub ? cy - 5 : cy} textAnchor="middle"
        dominantBaseline="central" fontSize={11} fontWeight={700} fill="#1a1a1a">
        {label}
      </text>
      {sub && (
        <text x={cx} y={cy + 9} textAnchor="middle"
          dominantBaseline="central" fontSize={9} fill="#555">
          {sub}
        </text>
      )}
    </g>
  );
};

const Rect: React.FC<{
  cx: number; cy: number; w?: number; h?: number;
  label: string; active?: boolean;
}> = ({ cx, cy, w = 80, h = 30, label, active = false }) => (
  <g>
    <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={4}
      fill={active ? COLORS.active.fill : COLORS.rect.fill}
      stroke={active ? COLORS.active.stroke : COLORS.rect.stroke}
      strokeWidth={1.8} />
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={700}
      fill={active ? "#000" : "#ffffff"}>
      {label}
    </text>
  </g>
);

// arrow with optional midpoint bend
const Arrow: React.FC<{
  x1: number; y1: number; x2: number; y2: number;
  label?: string; labelSide?: "left" | "right" | "top" | "bottom";
  bend?: { mx: number; my: number };
}> = ({ x1, y1, x2, y2, label, labelSide = "right", bend }) => {
  const id = `arr-${x1}-${y1}-${x2}-${y2}`;
  const d = bend
    ? `M${x1},${y1} L${bend.mx},${bend.my} L${x2},${y2}`
    : `M${x1},${y1} L${x2},${y2}`;

  // label midpoint
  const mx = bend ? (x1 + bend.mx + x2) / 3 : (x1 + x2) / 2;
  const my = bend ? (y1 + bend.my + y2) / 3 : (y1 + y2) / 2;
  const lx = labelSide === "left" ? mx - 10 :
             labelSide === "right" ? mx + 10 : mx;
  const ly = labelSide === "top" ? my - 10 :
             labelSide === "bottom" ? my + 10 : my;

  return (
    <g>
      <defs>
        <marker id={id} markerWidth={8} markerHeight={8}
          refX={6} refY={3} orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill={COLORS.arrow} />
        </marker>
      </defs>
      <path d={d} fill="none" stroke={COLORS.arrow}
        strokeWidth={1.5} markerEnd={`url(#${id})`} />
      {label && (
        <text x={lx} y={ly} textAnchor="middle" dominantBaseline="central"
          fontSize={10} fontWeight={700} fill={COLORS.label}>
          {label}
        </text>
      )}
    </g>
  );
};

// ── Regex 1 flowchart (binary: 0, 1) ────────────────────────
//
//  START
//    ↓
//  READ₁ ──Δ──→ ACCEPT
//    ↓ 0|1
//  PUSH sym
//    ↓
//  READ₂ ──Δ──→ POP
//    ↓ 0|1         ↓ Δ
//  PUSH sym      ACCEPT
//    ↑___________|
//  (loop back to READ₂)
//                  ↓ a,b (mismatch)
//                REJECT

const FlowchartRegex1: React.FC<{ activeState: PDAState | null }> = ({ activeState }) => {
  const W = 340;
  // column x positions
  const xC = 170;   // center column
  const xR = 300;   // right branch

  // row y positions
  const yStart  = 40;
  const yRead1  = 100;
  const yPush1  = 170;
  const yRead2  = 240;
  const yPush2  = 310;
  const yPop    = 310;   // right of READ2
  const yAccept1 = 100;  // right of READ1
  const yAccept2 = 390;
  const yReject  = 390;

  const H = 430;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 430 }}>

      {/* START → READ1 */}
      <Arrow x1={xC} y1={yStart + 22} x2={xC} y2={yRead1 - 28} />

      {/* READ1 → ACCEPT (right, Δ) */}
      <Arrow x1={xC + 46} y1={yRead1} x2={xR - 44} y2={yAccept1}
        label="Δ" labelSide="top" />

      {/* READ1 → PUSH1 (down, 0|1) */}
      <Arrow x1={xC} y1={yRead1 + 28} x2={xC} y2={yPush1 - 15}
        label="0 | 1" labelSide="right" />

      {/* PUSH1 → READ2 */}
      <Arrow x1={xC} y1={yPush1 + 15} x2={xC} y2={yRead2 - 28} />

      {/* READ2 → POP (right, Δ) */}
      <Arrow x1={xC + 46} y1={yRead2} x2={xR - 10} y2={yPop}
        label="Δ" labelSide="top" />

      {/* READ2 → PUSH2 (down, 0|1) */}
      <Arrow x1={xC} y1={yRead2 + 28} x2={xC} y2={yPush2 - 15}
        label="0 | 1" labelSide="right" />

      {/* PUSH2 loop back to READ2 (left side) */}
      <Arrow x1={xC - 40} y1={yPush2}
             x2={xC - 46} y2={yRead2}
             bend={{ mx: xC - 80, my: (yPush2 + yRead2) / 2 }} />

      {/* POP → ACCEPT2 */}
      <Arrow x1={xR} y1={yPop + 28} x2={xR} y2={yAccept2 - 22}
        label="Δ" labelSide="right" />

      {/* PUSH2 → REJECT (if loop exhausts — shown as b,Δ path) */}
      <Arrow x1={xC} y1={yPush2 + 15} x2={xC} y2={yReject - 22}
        label="" labelSide="right" />

      {/* NODES */}
      <Oval  cx={xC}  cy={yStart}   label="START" />
      <Diamond cx={xC} cy={yRead1} label="READ₁"
        active={activeState === "q0"} />
      <Oval  cx={xR}  cy={yAccept1} label="ACCEPT"  variant="accept" />
      <Rect  cx={xC}  cy={yPush1}   label="PUSH sym" />
      <Diamond cx={xC} cy={yRead2}  label="READ₂"
        active={activeState === "q1"} />
      <Rect  cx={xR}  cy={yPop}     label="POP" />
      <Rect  cx={xC}  cy={yPush2}   label="PUSH sym" />
      <Oval  cx={xR}  cy={yAccept2} label="ACCEPT"  variant="accept" />
      <Oval  cx={xC}  cy={yReject}  label="REJECT"  variant="reject" />
    </svg>
  );
};

// ── Regex 2 flowchart (alpha: a, b) ─────────────────────────
//
//  START
//    ↓
//  READ₁ ──Δ──→ ACCEPT
//    ↓ a          ↓ b
//  PUSH A       PUSH B
//    ↓_____________↓
//       READ₂
//    ↓ a    ↓ b      ↓ Δ
//  PUSH A  PUSH B    POP
//    ↑_loop_↑         ↓ Δ
//                   ACCEPT
//          ↓ (reject path)
//         REJECT

const FlowchartRegex2: React.FC<{ activeState: PDAState | null }> = ({ activeState }) => {
  const W = 380;
  const xC  = 190;  // center
  const xL  = 90;   // left branch (a)
  const xR  = 300;  // right branch (b / POP)

  const yStart  = 40;
  const yRead1  = 100;
  const yPushA1 = 175;
  const yPushB1 = 175;
  const yRead2  = 255;
  const yPushA2 = 330;
  const yPushB2 = 330;
  const yPop    = 330;
  const yAccept1 = 100;
  const yAccept2 = 410;
  const yReject  = 410;

  const H = 450;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 450 }}>

      {/* START → READ1 */}
      <Arrow x1={xC} y1={yStart + 22} x2={xC} y2={yRead1 - 28} />

      {/* READ1 → ACCEPT (Δ, far right) */}
      <Arrow x1={xC + 46} y1={yRead1} x2={xR + 30} y2={yAccept1}
        label="Δ" labelSide="top" />

      {/* READ1 → PUSH A (left, a) */}
      <Arrow x1={xC - 20} y1={yRead1 + 20}
             x2={xL}      y2={yPushA1 - 15}
             bend={{ mx: xL, my: yRead1 + 20 }}
             label="a" labelSide="left" />

      {/* READ1 → PUSH B (right, b) */}
      <Arrow x1={xC + 20} y1={yRead1 + 20}
             x2={xR - 10} y2={yPushB1 - 15}
             bend={{ mx: xR - 10, my: yRead1 + 20 }}
             label="b" labelSide="right" />

      {/* PUSH A → READ2 */}
      <Arrow x1={xL} y1={yPushA1 + 15}
             x2={xC - 20} y2={yRead2 - 20}
             bend={{ mx: xL, my: yRead2 - 20 }} />

      {/* PUSH B → READ2 */}
      <Arrow x1={xR - 10} y1={yPushB1 + 15}
             x2={xC + 20} y2={yRead2 - 20}
             bend={{ mx: xR - 10, my: yRead2 - 20 }} />

      {/* READ2 → PUSH A2 (left, a) */}
      <Arrow x1={xC - 20} y1={yRead2 + 20}
             x2={xL}      y2={yPushA2 - 15}
             bend={{ mx: xL, my: yRead2 + 20 }}
             label="a" labelSide="left" />

      {/* READ2 → PUSH B2 (right, b) */}
      <Arrow x1={xC + 20} y1={yRead2 + 20}
             x2={xR - 10} y2={yPushB2 - 15}
             bend={{ mx: xR - 10, my: yRead2 + 20 }}
             label="b" labelSide="right" />

      {/* READ2 → POP (far right, Δ) */}
      <Arrow x1={xC + 46} y1={yRead2}
             x2={xR + 30}  y2={yPop}
             label="Δ" labelSide="top" />

      {/* PUSH A2 loop → READ2 */}
      <Arrow x1={xL} y1={yPushA2 + 15}
             x2={xL} y2={yRead2 + 20}
             bend={{ mx: xL - 30, my: (yPushA2 + yRead2) / 2 }} />

      {/* PUSH B2 loop → READ2 */}
      <Arrow x1={xR - 10} y1={yPushB2 + 15}
             x2={xR - 10} y2={yRead2 + 20}
             bend={{ mx: xR + 20, my: (yPushB2 + yRead2) / 2 }} />

      {/* POP → ACCEPT2 */}
      <Arrow x1={xR + 30} y1={yPop + 15}
             x2={xR + 30} y2={yAccept2 - 22}
             label="Δ" labelSide="right" />

      {/* Centre path down → REJECT */}
      <Arrow x1={xC} y1={yRead2 + 28}
             x2={xC} y2={yReject - 22} />

      {/* NODES */}
      <Oval    cx={xC}      cy={yStart}   label="START" />
      <Diamond cx={xC}      cy={yRead1}   label="READ₁"
        active={activeState === "q0"} />
      <Oval    cx={xR + 30} cy={yAccept1} label="ACCEPT" variant="accept" />
      <Rect    cx={xL}      cy={yPushA1}  label="PUSH A" />
      <Rect    cx={xR - 10} cy={yPushB1}  label="PUSH B" />
      <Diamond cx={xC}      cy={yRead2}   label="READ₂"
        active={activeState === "q1"} />
      <Rect    cx={xL}      cy={yPushA2}  label="PUSH A" />
      <Rect    cx={xR - 10} cy={yPushB2}  label="PUSH B" />
      <Rect    cx={xR + 30} cy={yPop}     label="POP" />
      <Oval    cx={xR + 30} cy={yAccept2} label="ACCEPT" variant="accept" />
      <Oval    cx={xC}      cy={yReject}  label="REJECT" variant="reject" />
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────
//  PROPS
// ─────────────────────────────────────────────────────────────

interface PDAModuleProps {
  lastSimulated: { input: string; rowId: number } | null;
  selectedRegex: RegexChoice;
}

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────

const PDAModule: React.FC<PDAModuleProps> = ({
  lastSimulated,
  selectedRegex,
}) => {
  const [result, setResult]       = useState<SimResult | null>(null);
  const [lastInput, setLastInput] = useState<string>("");

  const cfg = getConfig(selectedRegex);

  // derive current active PDA state for diagram highlight
  const lastStep    = result?.steps[result.steps.length - 1];
  const activeState = lastStep?.state ?? null;
  const displayStack = result && lastStep ? lastStep.stackSnapshot : ["$"];

  // Re-run whenever a row's Simulate fires
  useEffect(() => {
    if (!lastSimulated || lastSimulated.input.trim() === "") {
      setResult(null);
      setLastInput("");
      return;
    }
    const trimmed = lastSimulated.input.trim();
    setLastInput(trimmed);
    setResult(runPDA(trimmed, selectedRegex));
  }, [lastSimulated, selectedRegex]);

  // Reset on regex switch
  useEffect(() => {
    setResult(null);
    setLastInput("");
  }, [selectedRegex]);

  // ── Tuple rows ──────────────────────────────────────────
  const tupleRows: [string, string][] = [
    ["Q",  "{ q0, q1, q2, q_accept, q_reject }"],
    ["Σ",  cfg.sigma],
    ["Γ",  cfg.gamma],
    ["δ",  "see flowchart diagram →"],
    ["q₀", "q0"],
    ["Z₀", "$ (bottom-of-stack marker)"],
    ["F",  "{ q_accept }"],
  ];

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto bg-[#D9D9D9] p-5 gap-4">

      {/* ── Top bar ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">
            Pushdown Automaton Simulator
          </p>
          <p className="text-[10px] font-mono text-gray-500 mt-0.5 break-all">
            {cfg.pattern}
          </p>
        </div>
        {result && (
          <span className={`shrink-0 text-[11px] font-bold px-3 py-0.5 rounded border ${
            result.accepted
              ? "bg-green-100 text-green-700 border-green-400"
              : "bg-red-100 text-red-700 border-red-400"
          }`}>
            {result.accepted ? "VALID" : "INVALID"}
          </span>
        )}
      </div>

      {/* ── 7-Tuple ── */}
      <div className="bg-white rounded-lg border border-gray-300 p-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
          Formal Definition — 7-Tuple
        </p>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-[11px]">
          {tupleRows.map(([label, value]) => (
            <React.Fragment key={label}>
              <span className="font-bold text-[#1a1a1a]">{label}</span>
              <span className="text-gray-600">{value}</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Main body: Stack + Flowchart side by side ── */}
      <div className="flex gap-3 flex-1 min-h-0">

        {/* Live Stack panel */}
        <div className="bg-white rounded-lg border border-gray-300 p-3
                        flex flex-col items-center gap-1 min-w-[68px]">
          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
            Stack
          </p>

          {/* Result banner inside stack column */}
          {result && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded mb-1 ${
              result.accepted
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}>
              {result.accepted ? "✓ OK" : "✗ NO"}
            </span>
          )}

          {displayStack.length === 0 ? (
            <span className="text-gray-400 text-[10px] mt-2">empty</span>
          ) : (
            displayStack.map((sym, i) => (
              <div key={i} className={`w-10 h-7 flex items-center justify-center
                rounded text-[11px] font-mono font-bold border transition-all ${
                  i === 0
                    ? "bg-[#1a1a1a] border-[#74DCFF] text-[#74DCFF] scale-105"
                    : "bg-gray-100 border-gray-300 text-gray-700"
                }`}>
                {sym}
              </div>
            ))
          )}

          <div className="w-11 h-px bg-gray-400 mt-1" />
          <span className="text-[9px] text-gray-400">Z₀</span>

          {/* Current state label */}
          {result && (
            <div className="mt-2 text-center">
              <p className="text-[8px] text-gray-400 uppercase tracking-widest">State</p>
              <p className="text-[10px] font-bold font-mono text-[#1a1a1a]">
                {activeState}
              </p>
            </div>
          )}

          {/* Tested string */}
          {lastInput && (
            <div className="mt-1 text-center">
              <p className="text-[8px] text-gray-400 uppercase tracking-widest">Input</p>
              <p className="text-[9px] font-mono text-gray-700 break-all max-w-[60px]">
                "{lastInput}"
              </p>
            </div>
          )}
        </div>

        {/* Flowchart diagram panel */}
        <div className="flex-1 bg-white rounded-lg border border-gray-300 p-3
                        flex flex-col min-w-0 overflow-hidden">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
            Transition Flowchart
            <span className="ml-2 font-normal normal-case text-gray-400">
              — {selectedRegex === "regex1" ? "Binary (0, 1)" : "Alphabet (a, b)"}
            </span>
          </p>

          {/* Legend */}
          <div className="flex gap-3 mb-2 flex-wrap">
            {[
              { shape: "oval",    label: "Control (START/ACCEPT/REJECT)" },
              { shape: "diamond", label: "Operation (READ / POP)" },
              { shape: "rect",    label: "Stack op (PUSH)" },
            ].map(({ shape, label }) => (
              <div key={shape} className="flex items-center gap-1">
                {shape === "oval" && (
                  <svg width={24} height={14}>
                    <ellipse cx={12} cy={7} rx={11} ry={6}
                      fill="#fff" stroke="#1a1a1a" strokeWidth={1.5} />
                  </svg>
                )}
                {shape === "diamond" && (
                  <svg width={18} height={14}>
                    <polygon points="9,1 17,7 9,13 1,7"
                      fill="#fff" stroke="#1a1a1a" strokeWidth={1.5} />
                  </svg>
                )}
                {shape === "rect" && (
                  <svg width={22} height={14}>
                    <rect x={1} y={2} width={20} height={10} rx={2}
                      fill="#1a1a1a" stroke="#1a1a1a" strokeWidth={1.5} />
                  </svg>
                )}
                <span className="text-[9px] text-gray-500">{label}</span>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-sm bg-[#74DCFF] border border-gray-400" />
              <span className="text-[9px] text-gray-500">Active node</span>
            </div>
          </div>

          {/* SVG diagram — swaps on regex change */}
          <div className="flex-1 overflow-auto">
            {selectedRegex === "regex1"
              ? <FlowchartRegex1 activeState={activeState as PDAState | null} />
              : <FlowchartRegex2 activeState={activeState as PDAState | null} />
            }
          </div>
        </div>
      </div>

      {/* ── Idle placeholder ── */}
      {!result && (
        <div className="bg-white rounded-lg border border-gray-300 px-4 py-2">
          <p className="text-gray-400 text-[11px] text-center">
            Type a string in any row and click{" "}
            <span className="font-semibold text-[#1a1a1a]">Simulate</span>{" "}
            to run the PDA — the active node will highlight in{" "}
            <span className="text-[#74DCFF] font-semibold">cyan</span>.
          </p>
        </div>
      )}
    </div>
  );
};

export default PDAModule;
