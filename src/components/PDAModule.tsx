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
//
//  Both regex choices share the same PDA structure.
//  The language modelled is any non-empty string over Σ that
//  satisfies the full regex pattern (validated at accept step).
//
//  Regex 1 (binary): (11+00)(1+0)*(101+111+01)(00*+11*)(1+0+11)
//    Σ = { 0, 1 }   Γ = { $, 0, 1 }
//
//  Regex 2 (alpha):  (a+b)(a+b)*(aa+bb)(ab+ba)(a+b)*(aba+baa)
//    Σ = { a, b }   Γ = { $, A, B }
//
//  7-tuple  (Q, Σ, Γ, δ, q₀, Z₀, F)
//  Q  = { q0, q1, q2, q_accept, q_reject }
//  q₀ = q0
//  Z₀ = $
//  F  = { q_accept }
//
//  δ (informal):
//   q0, first symbol, $ → q1  push sym on $        [start]
//   q1, symbol,       _ → q1  push sym              [read loop]
//   q1, ε,            _ → q2  noop                  [end of input]
//   q2, ε,            _ → q_accept | q_reject       [regex check]
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

  // ── helpers ──────────────────────────────────────────────
  const push = (stack: string[], sym: string): string[] => [sym, ...stack];
  const snap = (stack: string[]) => [...stack];

  // ── initial config ───────────────────────────────────────
  let stack: string[] = ["$"];
  let state: PDAState = "q0";

  steps.push({
    step: n++,
    state,
    symbolRead: "—",
    stackOp: "noop",
    stackSnapshot: snap(stack),
    remainingInput: input,
    description: "Initial configuration. Stack initialised with Z₀ = $.",
  });

  // ── reject: empty ────────────────────────────────────────
  if (input.length === 0) {
    state = "q_reject";
    steps.push({
      step: n++,
      state,
      symbolRead: "ε",
      stackOp: "noop",
      stackSnapshot: snap(stack),
      remainingInput: "",
      description: "Empty string — language requires at least one symbol. Reject.",
    });
    return { accepted: false, steps };
  }

  // ── reject: invalid alphabet ─────────────────────────────
  for (const ch of input) {
    if (!cfg.alphabet.includes(ch)) {
      state = "q_reject";
      steps.push({
        step: n++,
        state,
        symbolRead: ch,
        stackOp: "noop",
        stackSnapshot: snap(stack),
        remainingInput: input,
        description: `Symbol '${ch}' ∉ Σ = ${cfg.sigma}. Reject.`,
      });
      return { accepted: false, steps };
    }
  }

  // ── q0 → q1: read first symbol ───────────────────────────
  const first = input[0];
  const firstSym = cfg.symToStack(first);
  stack = push(stack, firstSym);
  state = "q1";
  steps.push({
    step: n++,
    state,
    symbolRead: first,
    stackOp: `push ${firstSym}`,
    stackSnapshot: snap(stack),
    remainingInput: input.slice(1),
    description: `δ(q0, ${first}, $) → (q1, push '${firstSym}'). Transition to reading state.`,
  });

  // ── q1 loop: read remaining symbols ──────────────────────
  for (let i = 1; i < input.length; i++) {
    const ch = input[i];
    const sym = cfg.symToStack(ch);
    stack = push(stack, sym);
    steps.push({
      step: n++,
      state,
      symbolRead: ch,
      stackOp: `push ${sym}`,
      stackSnapshot: snap(stack),
      remainingInput: input.slice(i + 1),
      description: `δ(q1, ${ch}, ${stack[1]}) → (q1, push '${sym}'). Continue reading input.`,
    });
  }

  // ── q1 → q2: input exhausted (ε-transition) ──────────────
  state = "q2";
  steps.push({
    step: n++,
    state,
    symbolRead: "ε",
    stackOp: "noop",
    stackSnapshot: snap(stack),
    remainingInput: "",
    description:
      "ε-transition: all input consumed. Move to q2 to verify regex pattern against full string.",
  });

  // ── q2 → accept/reject: full regex validation ────────────
  const accepted = cfg.validate(input);
  state = accepted ? "q_accept" : "q_reject";

  if (accepted) {
    // pop everything down to $
    while (stack.length > 1) stack.shift();
    stack.shift(); // pop $
  }

  steps.push({
    step: n++,
    state,
    symbolRead: "ε",
    stackOp: accepted ? "pop $" : "noop",
    stackSnapshot: snap(stack),
    remainingInput: "",
    description: accepted
      ? `String satisfies the regex pattern. Pop Z₀ ($). Move to q_accept. ✓`
      : `String does not satisfy the full regex pattern. Move to q_reject. ✗`,
  });

  return { accepted, steps };
}

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
  const [result, setResult] = useState<SimResult | null>(null);
  const [lastInput, setLastInput] = useState<string>("");
  const [showTrace, setShowTrace] = useState(false);

  const cfg = getConfig(selectedRegex);

  // Re-run whenever a row's Simulate fires
  useEffect(() => {
    if (!lastSimulated || lastSimulated.input.trim() === "") {
      setResult(null);
      setLastInput("");
      setShowTrace(false);
      return;
    }
    const trimmed = lastSimulated.input.trim();
    setLastInput(trimmed);
    setResult(runPDA(trimmed, selectedRegex));
    setShowTrace(false);
  }, [lastSimulated, selectedRegex]);

  // Reset on regex switch
  useEffect(() => {
    setResult(null);
    setLastInput("");
    setShowTrace(false);
  }, [selectedRegex]);

  const lastStep = result?.steps[result.steps.length - 1];
  const displayStack =
    result && lastStep ? lastStep.stackSnapshot : ["$"];

  // ── Tuple rows ──────────────────────────────────────────
  const tupleRows: [string, string][] = [
    ["Q", "{ q0, q1, q2, q_accept, q_reject }"],
    ["Σ", cfg.sigma],
    ["Γ", cfg.gamma],
    ["δ", "see transition rules below"],
    ["q₀", "q0"],
    ["Z₀", "$ (bottom-of-stack marker)"],
    ["F", "{ q_accept }"],
  ];

  // ── Transition rule rows ────────────────────────────────
  const transitionRows = [
    {
      from: "q0",
      read: cfg.alphabet.join(" | "),
      top: "$",
      to: "q1",
      push: "sym · $",
      note: "Start — read first symbol",
    },
    {
      from: "q1",
      read: cfg.alphabet[0],
      top: "any",
      to: "q1",
      push: cfg.symToStack(cfg.alphabet[0]),
      note: "Continue reading",
    },
    {
      from: "q1",
      read: cfg.alphabet[1],
      top: "any",
      to: "q1",
      push: cfg.symToStack(cfg.alphabet[1]),
      note: "Continue reading",
    },
    {
      from: "q1",
      read: "ε",
      top: "any",
      to: "q2",
      push: "—",
      note: "Input exhausted",
    },
    {
      from: "q2",
      read: "ε",
      top: "$",
      to: "q_accept / q_reject",
      push: "pop $ on accept",
      note: "Regex verification",
    },
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
          <span
            className={`shrink-0 text-[11px] font-bold px-3 py-0.5 rounded border ${
              result.accepted
                ? "bg-green-100 text-green-700 border-green-400"
                : "bg-red-100 text-red-700 border-red-400"
            }`}
          >
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

      {/* ── Transition Function ── */}
      <div className="bg-white rounded-lg border border-gray-300 p-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
          Transition Function (δ)
        </p>
        <div className="flex flex-col gap-1.5">
          {transitionRows.map((r, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono text-[10px] bg-[#1a1a1a] text-white px-3 py-2 rounded"
            >
              <span className="text-[#74DCFF] font-bold">{r.from}</span>
              <span className="text-gray-500">,</span>
              <span className="text-yellow-300">{r.read}</span>
              <span className="text-gray-500">,</span>
              <span className="text-purple-300">{r.top}</span>
              <span className="text-gray-400 mx-1">→</span>
              <span className="text-[#74DCFF] font-bold">{r.to}</span>
              <span className="text-gray-500 mx-1">|</span>
              <span className="text-green-300">push {r.push}</span>
              <span className="ml-auto text-gray-500 text-[9px] italic">
                {r.note}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Simulation output ── */}
      {result ? (
        <div className="flex gap-3 flex-1 min-h-0">

          {/* Live Stack */}
          <div className="bg-white rounded-lg border border-gray-300 p-3 flex flex-col items-center gap-1 min-w-[68px]">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">
              Stack
            </p>
            {displayStack.length === 0 ? (
              <span className="text-gray-400 text-[10px] mt-2">empty</span>
            ) : (
              displayStack.map((sym, i) => (
                <div
                  key={i}
                  className={`w-10 h-7 flex items-center justify-center rounded text-[11px] font-mono font-bold border transition-all ${
                    i === 0
                      ? "bg-[#1a1a1a] border-[#74DCFF] text-[#74DCFF] scale-105"
                      : "bg-gray-100 border-gray-300 text-gray-700"
                  }`}
                >
                  {sym}
                </div>
              ))
            )}
            <div className="w-11 h-px bg-gray-400 mt-1" />
            <span className="text-[9px] text-gray-400">Z₀</span>
          </div>

          {/* Result + trace */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">

            {/* Result banner */}
            <div
              className={`p-3 rounded-lg border text-[11px] font-mono ${
                result.accepted
                  ? "bg-green-50 border-green-300 text-green-800"
                  : "bg-red-50 border-red-300 text-red-800"
              }`}
            >
              <p className="font-bold text-sm">
                {result.accepted ? "✓ ACCEPTED" : "✗ REJECTED"}
              </p>
              <p className="opacity-75 mt-0.5 break-all">
                &quot;{lastInput}&quot; → final state:{" "}
                <span className="font-bold">{lastStep?.state}</span>
              </p>
            </div>

            {/* State pill */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-300 text-[11px] font-mono">
              <span className="text-gray-400">Current state:</span>
              <span className="font-bold text-[#1a1a1a]">
                {lastStep?.state}
              </span>
              <span className="ml-auto text-gray-400">
                {result.steps.length} step
                {result.steps.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Trace toggle */}
            <button
              onClick={() => setShowTrace((p) => !p)}
              className="text-left text-[11px] font-semibold text-[#1a1a1a] hover:text-[#74DCFF] underline underline-offset-2 transition-colors px-1"
            >
              {showTrace ? "▲ Hide" : "▼ Show"} step-by-step trace
            </button>

            {/* Trace table */}
            {showTrace && (
              <div className="overflow-auto rounded-lg border border-gray-300 bg-white flex-1">
                <table className="w-full text-[10px] text-left">
                  <thead className="bg-gray-100 text-gray-500 uppercase tracking-wider sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 whitespace-nowrap">#</th>
                      <th className="px-2 py-1.5 whitespace-nowrap">State</th>
                      <th className="px-2 py-1.5 whitespace-nowrap">Read</th>
                      <th className="px-2 py-1.5 whitespace-nowrap">Op</th>
                      <th className="px-2 py-1.5 whitespace-nowrap">Stack</th>
                      <th className="px-2 py-1.5 whitespace-nowrap">Remaining</th>
                      <th className="px-2 py-1.5">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.steps.map((s) => (
                      <tr
                        key={s.step}
                        className={`border-t border-gray-200 align-top ${
                          s.state === "q_accept"
                            ? "bg-green-50"
                            : s.state === "q_reject"
                            ? "bg-red-50"
                            : s.step % 2 === 0
                            ? "bg-white"
                            : "bg-gray-50"
                        }`}
                      >
                        <td className="px-2 py-1.5 text-gray-400 font-mono">
                          {s.step}
                        </td>
                        <td className="px-2 py-1.5 font-mono font-bold text-[#1a1a1a] whitespace-nowrap">
                          {s.state}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-yellow-700 whitespace-nowrap">
                          {s.symbolRead}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-purple-700 whitespace-nowrap">
                          {s.stackOp}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-blue-700 whitespace-nowrap">
                          {s.stackSnapshot.length > 0
                            ? s.stackSnapshot.join(" ")
                            : "∅"}
                        </td>
                        <td className="px-2 py-1.5 font-mono text-gray-500 whitespace-nowrap">
                          {s.remainingInput === "" ? "ε" : s.remainingInput}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600 leading-relaxed">
                          {s.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Idle placeholder */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 text-sm font-medium">
              No simulation running
            </p>
            <p className="text-gray-400 text-xs mt-1">
              Type a string in any row and click{" "}
              <span className="font-semibold text-[#1a1a1a]">Simulate</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDAModule;
