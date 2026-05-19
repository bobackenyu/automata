import { useEffect, useMemo, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronUp } from "lucide-react"; 

// Graph Imports
import { ReactFlow, Background, BackgroundVariant, Controls, useReactFlow, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// DFA Imports
import { CircleNode } from "./CircleNode";
import { DfaAbNodes, Dfa01Nodes } from "../constants/DfaNodes"
import { DfaAbEdges, Dfa01Edges } from "../constants/DfaEdges"
import { DfaAbConfig, Dfa01Config } from "@/constants/DfaConfig";
import { cfgEngine01, cfgEngineAB, type TraceStep } from "../lib/CfgEngine";

// CFG Imports
import { CfgVisualizer } from "./CfgVisualizer";
import { Cfg01Grammar, CfgABGrammar } from "../constants/CfgGrammars";

// PDA Imports
import PDAModule from "./PDAModule";

type ModelType = "dfa" | "cfg" | "pda";
type RegexChoice = "regex1" | "regex2";

interface TestRow {
  id: number;
  input: string;
  status: "VALID" | "INVALID" | "READY" | "No string" | "PROCESSING";
}

type Props = {
  selectedRegex: RegexChoice;
  selectedModel: ModelType;
  handleNavigate: (id: string) => void; 
};

type ValidateDfaProps = {
  q0: string,
  sigma: Set<string>,
  delta: Record<string, string>,
  F: Set<string>
  word: string
}

const nodeTypes = {
    circle: CircleNode,
};


/**
 * DEMO graph generator.
 */
function getDemoGraph(selectedRegex: RegexChoice) {
  if (selectedRegex === "regex2") {
    const nodes = Dfa01Nodes
    const edges = Dfa01Edges

    return { nodes, edges };
  }
  const nodes = DfaAbNodes
  const edges = DfaAbEdges

  return { nodes, edges };
}

function validateDfa({q0, sigma, delta, F, word}: ValidateDfaProps){
  console.log("i got this values", q0, sigma, delta, F, word)
  let q = q0
    let path = []
    for (const w of word) {
        
        if (!sigma.has(w)){ // catches invalid symbol
            return {isValid: false, path: path, info: 'char not in the symbol'}
        }

        let old_q = q
        q = delta[`${q},${w}`]
        let edge_path = `${old_q}-${w}-${q}`
        path.push(edge_path)
    }
    
    if (F.has(q)) {
        return {isValid: true, path: path, info: 'Succesfully compiled the whole string with the final result of an Valid String'}
    } else {
        return {isValid: false, path: path, info: "Succesfully compiled the whole string with the final result of an Invalid String"}
    }
}

// Simulate the Automata 
export function AutomataSimulator({ selectedRegex, selectedModel, handleNavigate }: Props) {
  // DFA States
  const initialGraph = useMemo(() => getDemoGraph(selectedRegex), [selectedRegex]);
  const [displayNodes, setNodes, onNodesChange] = useNodesState(initialGraph.nodes)
  const [displayEdges, setEdges, onEdgesChange] = useEdgesState(initialGraph.edges)

  // CFG States
  const [cfgSteps, setCfgSteps] = useState<TraceStep[]>([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [cfgError, setCfgError] = useState<string | null>(null);

  // PDA States
  const [lastSimulatedPda, setLastSimulatedPda] = useState<{ input: string; rowId: number } | null>(null);

  // Cancel State
  const simulationRef = useRef<number>(0)

  // Keep the state (node, edge) sync in case of regex changes
  useEffect (() => {
    setNodes(initialGraph.nodes)
    setEdges(initialGraph.edges)
  }, [initialGraph, setNodes, setEdges])

  
  // Defines the number of test rows
  const [rows, setRows] = useState<TestRow[]>(
    Array.from({ length: 10 }, (_, i) => ({
      id: i,
      input: "",
      status: "No string",
    }))
  );

  // Dfa Values based on the selected Regex
  const dfaValues = useMemo(() => {
    if (selectedRegex == 'regex1')  return DfaAbConfig
    if (selectedRegex == 'regex2') return Dfa01Config

    return Dfa01Config

  }, [selectedRegex]);

  // -- Graph FitView --
  const { fitView } = useReactFlow();

  useEffect(() => {
    const handleResize = () => fitView();

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [fitView])

  useEffect(() => {
    const timer = setTimeout(() => {
      fitView({duration: 400}); 
    }, 50);

    return () => clearTimeout(timer);
  }, [selectedRegex, selectedModel, fitView])


  const handleInputChange = (id: number, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id === id) {
          return {
            ...row,
            input: value,
            status: value.length === 0 ? "No string" : "READY",
          };
        }
        return row;
      })
    );
  }; 

  // Handler for PDA callback to update row UI
  const handlePdaResult = (rowId: number, isValid: boolean) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId ? { ...r, status: isValid ? "VALID" : "INVALID" } : r
      )
    );
  };

  // Animation Delay
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Main Simulation Function
  const handleSimulate = async (rowId: number, input: string) => {
    const currentSimId = ++simulationRef.current;
    let status: TestRow["status"] = "No string";
    
    if (input.length === 0) {
      status = "No string";
    } else {

      // Set the status to processing (and reset old processing status)
      setRows((prev) =>
        prev.map((r) => {
          if (r.status === "PROCESSING") return { ...r, status: r.input.length === 0 ? "No string" : "READY" };
          if (r.id === rowId) return { ...r, status: "PROCESSING" };
          return r;
        }
        )
      );

      if (selectedModel == 'dfa') {
        let {isValid, path} = validateDfa({...dfaValues, word: input} )
        
        // --- Clear Previous Node/Edge State ---
        setNodes((nds) => nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isHighlighting: false,
            isHighlighted: false,
            isValid: null,
          }
        })))
        setEdges((dgs) => dgs.map((d) => ({
          ...d,
          animated: false,
          style: {...d.style, stroke: '#57565657', strokeWidth: 3}
        })))

        // --- Highlight the starting state ---
        setNodes((nds) => nds.map((n) =>
          n.id === dfaValues.q0 ? { ...n, data: {...n.data, isHighlighting: true}} : n
        ))

        await sleep(400)
        // if the simulation id changes, cancel the simulation
        if (currentSimId != simulationRef.current) return;

        // --- Start Traversal ---
        for (const edgePath of path) {
          const sourceId = edgePath.split('-')[0];
          const targetId = edgePath.split('-')[2];

          // Animate the edge
          const edgeToAnimate = displayEdges.find(e => e.source === sourceId && e.target === targetId);
          if (edgeToAnimate) {
            setEdges((dgs) => dgs.map((e) => 
              e.id === edgeToAnimate.id
                ? {...e, animated: true, style: { ...e.style, stroke: '#74DCFF', strokeWidth: 5 } }
                : e
            ));
          }

          await sleep(250);
          // If the simulation id change, cancel the simulation
          if (currentSimId != simulationRef.current) return;

          // Update Nodes (Old Nodes -> isHighlighted, Target Nodes -> isHighlighting)
          setNodes((nds) => nds.map((n) => {
            if (n.id === targetId) {
              return { ...n, data: { ...n.data,   isHighlighting: true, isHighlighted: false } }
            }
            if (n.id === sourceId){
              return { ...n, data: { ...n.data, isHighlighting: false, isHighlighted: true } }
            }
            return n
          }));

          await sleep(100)
          // If the simulation id change, cancel the simulation
          if (currentSimId != simulationRef.current) return;

          // Stop edge pulse, but keep the color
          if (edgeToAnimate) {
            setEdges((dgs) => dgs.map((e) => 
              e.id === edgeToAnimate.id ? { ...e, animated: false, style: {...e.style, stroke: '#3b82f6'}} : e
            ))
          }

          await sleep(100)
          // If the simulation id change, cancel the simulation
          if (currentSimId != simulationRef.current) return;
        }

        // Set isValid state
        const lastNodeId = path.length > 0 ? (path[path.length - 1]).split('-')[2] : dfaValues.q0
        if (isValid) {
          setNodes((nds) => nds.map((n) => 
            n.id === lastNodeId
            ? {...n, data: {...n.data, isHighlighting: false, isValid: true}}
            : n
          ));
        } else {
          setNodes((nds) => nds.map((n) => 
            n.id === lastNodeId
            ? {...n, data: {...n.data, isHighlighting: false, isValid: false}}
            : n
          ));
        }

        status = isValid ? "VALID" : "INVALID";
      } else if (selectedModel == 'cfg') {
        // Reset CFG States
        setCfgSteps([]);
        setCurrentStep(-1);
        setCfgError(null);

        const engine = selectedRegex == 'regex2' ? cfgEngine01 : cfgEngineAB
        const result = engine.trace(input)

        if (result.success) {
          setCfgSteps(result.steps ?? []);
          
          // --- Animate Loop ---
          const steps = result.steps ?? [];
          for (let i = 0; i < steps.length; i++) {
            setCurrentStep(i);
            await sleep(500);

            // Allow cancellation mid-animation
            if (currentSimId != simulationRef.current) return;
          }
          status = "VALID";
        } else {
          setCfgError(result.error || "String rejected by grammar.");
          status = "INVALID";
        }
      } else if (selectedModel === 'pda') {
        // Pass the row data down to PDAModule, let it update its internal state
        setLastSimulatedPda({ input, rowId });
        status = "PROCESSING"; // Stays PROCESSING until the callback updates it
      }
    } 

    // Update the status (only if it wasn't interrupted). 
    // We omit PDA because its status is handled asynchronously via callback.
    if (currentSimId === simulationRef.current && selectedModel !== 'pda') {
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, status } : r))
      );
    }
    
  };

  // --- Reset graph when changing regex and model ---
  useEffect(() => {
    simulationRef.current++

    // Reset DFA Graph 
    setNodes((nds) => nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isHighlighting: false,
          isHighlighted: false,
          isValid: null,
        }
      })))

      setEdges((dgs) => dgs.map((d) => ({
        ...d,
        animated: false,
        style: {...d.style, stroke: '#57565657', strokeWidth: 3}
      })))

      // Reset CFG States 
      setCfgSteps([]);
      setCurrentStep(-1);
      setCfgError(null);

      // Reset PDA States
      setLastSimulatedPda(null);

  }, [selectedRegex, selectedModel])

  // Reset status when changing regex
  useEffect(() => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        status: r.input.length === 0 ? "No string" : "READY",
      }))
    );
  }, [selectedRegex]);

  const regexLabel = selectedRegex === "regex2"
    ? "(11+00) (1+0)* (101+111+01) (00*+11*) (1+0+11)"
    : "(a+b) (a+b)* (aa+bb) (ab+ba) (a+b)* (aba+baa)";

  return (
    <div>
      {/* Header Container with Arrow pointing Up */}
      <div className="flex items-center gap-3 ml-7 mb-10 mt-35 group">
        <h2 id="configuration" className="text-2xl font-semibold text-left tracking-wide">
          Regex & Automata Configuration
        </h2>
        <button
          onClick={() => handleNavigate("selector")}
          className="p-1 rounded-full cursor-pointer relative overflow-hidden hover:bg-gray-200"
          aria-label="Scroll to Configuration"
        >
          <ChevronUp
            size={28}
            className="text-[#74DCFF] stroke-[4]"
            style={{
              animation: 'bounce 0.3s ease-in-out infinite alternate',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.animation = 'none')}
            onMouseLeave={(e) =>
              (e.currentTarget.style.animation = 'bounce 0.3s ease-in-out infinite alternate')
            }
          />
          <style>
            {`
              @keyframes bounce {
                0% { transform: translateY(0); }
                100% { transform: translateY(4px); }
              }
            `}
          </style>
        </button>
      </div>

      <div className="grid grid-cols-[360px_1fr] gap-12 w-full max-w-full bg-white py-4 px-7 pt-1 overflow-x-hidden">
        {/* Left Column */}
        <div className="min-w-0">
          <div className="grid grid-cols-[1.2fr_0.8fr_1fr] gap-4 mb-6">
            <span className="font-semibold text-md tracking-wider text-center text-gray-400">Enter Strings</span>
            <span className="font-semibold text-md tracking-wider text-center text-gray-400">Status</span>
            <span></span>
          </div>

          <div className="space-y-5">
            {rows.map((row) => (
              <div key={row.id} className="grid grid-cols-[1.2fr_0.8fr_1fr] gap-4 items-center">
                <Input
                  placeholder="Type a string"
                  value={row.input}
                  onChange={(e) => handleInputChange(row.id, e.target.value)}
                  className="bg-gray-100 border-none rounded-none h-10 placeholder:text-gray-400 focus-visible:ring-1 focus-visible:ring-gray-300"
                />
                <span className={`text-[12px] font-bold tracking-tight truncate ${
                  row.status === "VALID" ? "text-green-600" : row.status === "INVALID" ? "text-red-600" : row.status === "READY" ? "text-yellow-600" : row.status === "PROCESSING" ? "processing-pulse" : "text-gray-300"
                }`}>
                  {row.status === "No string" ? "NO STRING" : row.status}
                </span>
                <Button
                  variant="secondary"
                  disabled={row.input === "" || row.status === "PROCESSING"}
                  onClick={() => handleSimulate(row.id, row.input)}
                  className="text-s bg-[#1a1a1a] text-white hover:bg-[#74DCFF] hover:text-black rounded-lg h-10 shadow-sm cursor-pointer transition-all disabled:opacity-20"
                >
                  Simulate
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div className="min-w-0">
          <div className="flex justify-between items-center mb-6">
            <span className="font-semibold text-md tracking-wider text-gray-400">
              Transition Diagram
            </span>
            <span className="font-semibold text-md tracking-wider text-gray-400">
              Selected RegEx:{" "}
              <span className="text-gray-600 font-normal ml-2">{regexLabel}</span>
            </span>
          </div>
          <div className="w-full h-[580px] bg-[#D9D9D9] border border-gray-200 overflow-hidden">
            {selectedModel === "dfa" ? (
              <ReactFlow 
                nodes={displayNodes}
                nodeTypes = {nodeTypes}
                edges={displayEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodesDraggable={false}
                panOnDrag 
                zoomOnScroll 
                zoomOnPinch 
                nodesConnectable={false}
                fitView
                fitViewOptions={{ padding: 20}}
              >
                <Background 
                  color="#515151" // This is the color of the dots/lines
                  variant={BackgroundVariant.Dots} 
                  style={{ backgroundColor: '#000000' }} // This is the actual canvas color
                />
                <Controls />
              </ReactFlow>
            ) : selectedModel === "cfg" ? (
              <CfgVisualizer
                steps={cfgSteps}
                grammarFormal={selectedRegex === "regex2" ? Cfg01Grammar.formal : CfgABGrammar.formal}
                currentStepIndex={currentStep}
                errorMsg={cfgError}
                isSimulationComplete={status === "VALID" || (currentStep === cfgSteps.length - 1 && !cfgError)}
              />
            ) : (
              <PDAModule 
                lastSimulated={lastSimulatedPda}
                selectedRegex={selectedRegex}
                onSimulationComplete={handlePdaResult}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}