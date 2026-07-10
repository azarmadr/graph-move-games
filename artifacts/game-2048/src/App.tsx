import { useEffect, useRef } from "react";

const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  0:    { bg: "#cdc1b4", fg: "#cdc1b4" },
  2:    { bg: "#eee4da", fg: "#776e65" },
  4:    { bg: "#ede0c8", fg: "#776e65" },
  8:    { bg: "#f2b179", fg: "#f9f6f2" },
  16:   { bg: "#f59563", fg: "#f9f6f2" },
  32:   { bg: "#f67c5f", fg: "#f9f6f2" },
  64:   { bg: "#f65e3b", fg: "#f9f6f2" },
  128:  { bg: "#edcf72", fg: "#f9f6f2" },
  256:  { bg: "#edcc61", fg: "#f9f6f2" },
  512:  { bg: "#edc850", fg: "#f9f6f2" },
  1024: { bg: "#edc53f", fg: "#f9f6f2" },
  2048: { bg: "#edc22e", fg: "#f9f6f2" },
};

/* ── Board renderer ────────────────────────────────────────────── */
function drawBoard(canvas: HTMLCanvasElement, board: number[][]) {
  const ctx = canvas.getContext("2d")!;
  const size = canvas.width;
  const padding = 12;
  const gap = 8;
  const cellSize = (size - padding * 2 - gap * 3) / 4;

  ctx.fillStyle = "#bbada0";
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 8);
  ctx.fill();

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = board[r][c];
      const x = padding + c * (cellSize + gap);
      const y = padding + r * (cellSize + gap);
      const colors = TILE_COLORS[val] ?? { bg: "#3c3a32", fg: "#f9f6f2" };

      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, 4);
      ctx.fill();

      if (val > 0) {
        ctx.fillStyle = colors.fg;
        const fontSize = val >= 1024 ? 20 : val >= 128 ? 24 : 28;
        ctx.font = `bold ${fontSize}px "Clear Sans", Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(val), x + cellSize / 2, y + cellSize / 2);
      }
    }
  }
}

/* ── Focused graph renderer (local neighborhood) ───────────────── */
interface NodeData {
  id: string;
  label: string;
  board: number[][];
  isCurrent: boolean;
  edgeColor: string;
  edgeLabel?: string;
}

function drawFocusedGraph(canvas: HTMLCanvasElement, currentBoard: number[][]) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, w, h);

  /* Build a plausible 2-deep neighborhood around the current board */
  const nodes: NodeData[] = [
    // Predecessors (above current)
    { id: "p0", label: "start", board: sampleStart(), isCurrent: false, edgeColor: "#4cc9f0", edgeLabel: "spawn" },
    // Current node (center)
    { id: "c0", label: "current", board: currentBoard, isCurrent: true, edgeColor: "#4cc9f0" },
    // Siblings (same predecessor, different direction)
    { id: "s1", label: "up",    board: [[0,0,2,0],[0,0,2,0],[0,0,0,0],[0,0,0,0]], isCurrent: false, edgeColor: "#7209b7", edgeLabel: "up" },
    // Successors (below current)
    { id: "c1", label: "right", board: [[0,0,4,16],[0,0,0,32],[0,0,0,4],[0,0,0,2]], isCurrent: false, edgeColor: "#f72585", edgeLabel: "right" },
    { id: "c2", label: "left",  board: [[2,4,8,16],[2,0,0,32],[4,0,0,4],[2,0,0,0]], isCurrent: false, edgeColor: "#f72585", edgeLabel: "left" },
    { id: "c3", label: "up",    board: [[2,4,8,16],[0,0,0,32],[0,0,0,4],[0,0,2,2]], isCurrent: false, edgeColor: "#f72585", edgeLabel: "up" },
    { id: "c4", label: "down",  board: [[0,0,0,0],[0,0,0,16],[2,4,8,32],[2,2,4,4]], isCurrent: false, edgeColor: "#f72585", edgeLabel: "down" },
  ];

  const levelGap = 100;
  const cx = w / 2;
  const cy = h / 2 + 12;

  const positions = new Map<string, { x: number; y: number }>();
  positions.set("c0", { x: cx, y: cy });                  // current, center
  positions.set("p0", { x: cx, y: cy - levelGap });      // predecessor, above
  positions.set("s1", { x: cx + 120, y: cy - levelGap }); // sibling, offset above
  positions.set("c1", { x: cx - 120, y: cy + levelGap }); // successors below
  positions.set("c2", { x: cx - 40,  y: cy + levelGap + 30 });
  positions.set("c3", { x: cx + 40,  y: cy + levelGap + 30 });
  positions.set("c4", { x: cx + 120, y: cy + levelGap });

  /* Draw edges */
  const drawEdge = (from: string, to: string, label?: string, color = "rgba(255,255,255,0.25)") => {
    const a = positions.get(from)!;
    const b = positions.get(to)!;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    if (label) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const pad = 2;
      const tw = ctx.measureText(label).width + pad * 4;
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(mx - tw / 2, my - 7, tw, 14);
      ctx.fillStyle = color;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, mx, my);
    }
  };

  // Predecessor -> current
  drawEdge("p0", "c0", "spawn", nodes[0].edgeColor);
  // Sibling branch (same predecessor)
  drawEdge("p0", "s1", "up", nodes[2].edgeColor);
  // Current -> successors
  drawEdge("c0", "c1", "right", nodes[3].edgeColor);
  drawEdge("c0", "c2", "left",  nodes[4].edgeColor);
  drawEdge("c0", "c3", "up",    nodes[5].edgeColor);
  drawEdge("c0", "c4", "down",  nodes[6].edgeColor);

  /* Draw nodes as mini boards or circles */
  const miniSize = 44;
  const cellSize = (miniSize - 4) / 4;

  for (const n of nodes) {
    const { x, y } = positions.get(n.id)!;
    const isCur = n.isCurrent;

    // Outer glow for current
    if (isCur) {
      ctx.save();
      ctx.shadowColor = n.edgeColor;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = n.edgeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - miniSize / 2, y - miniSize / 2, miniSize, miniSize, 4);
      ctx.stroke();
      ctx.restore();
    }

    // Mini board background
    ctx.fillStyle = isCur ? "#2a2a45" : "#1e1e30";
    ctx.strokeStyle = isCur ? n.edgeColor : "rgba(255,255,255,0.15)";
    ctx.lineWidth = isCur ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(x - miniSize / 2, y - miniSize / 2, miniSize, miniSize, 4);
    ctx.fill();
    ctx.stroke();

    // Mini tiles
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const val = n.board[r][c];
        const colors = TILE_COLORS[val] ?? { bg: "#3c3a32", fg: "#f9f6f2" };
        const tx = x - miniSize / 2 + 2 + c * (cellSize + 1);
        const ty = y - miniSize / 2 + 2 + r * (cellSize + 1);
        ctx.fillStyle = colors.bg;
        ctx.fillRect(tx, ty, cellSize, cellSize);
        if (val > 0 && val >= 8) {
          ctx.fillStyle = colors.fg;
          ctx.font = `bold ${cellSize > 10 ? 7 : 6}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(val), tx + cellSize / 2, ty + cellSize / 2);
        }
      }
    }

    // Label below node
    ctx.fillStyle = isCur ? n.edgeColor : "rgba(255,255,255,0.45)";
    ctx.font = `10px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(n.label, x, y + miniSize / 2 + 14);
  }

  // Legend
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.fillText("Focused graph: current node + immediate neighborhood", 12, h - 12);
}

function sampleStart(): number[][] {
  return [
    [0,0,0,0],
    [0,0,0,0],
    [0,0,0,0],
    [0,0,2,0],
  ];
}

/* ── Main App ──────────────────────────────────────────────────── */
export default function App() {
  const boardRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<HTMLCanvasElement>(null);

  const board = [
    [2, 4, 8, 16],
    [0, 0, 2, 32],
    [0, 0, 0, 4],
    [0, 0, 0, 2],
  ];

  useEffect(() => {
    if (boardRef.current) drawBoard(boardRef.current, board);
    if (graphRef.current) drawFocusedGraph(graphRef.current, board);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#faf8ef", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", fontFamily: "'Clear Sans', Arial, sans-serif" }}>
      <h1 style={{ color: "#776e65", fontSize: 36, fontWeight: 800, margin: "0 0 4px" }}>2048</h1>
      <p style={{ color: "#9b8f82", fontSize: 14, margin: "0 0 24px" }}>
        Rust/WASM · Phase 1 scaffold — focused local graph
      </p>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
        {/* Board Panel */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: 360, alignItems: "center" }}>
            <span style={{ color: "#776e65", fontWeight: 700, fontSize: 15 }}>Board</span>
            <span style={{ background: "#bbada0", color: "#f9f6f2", fontWeight: 700, padding: "4px 14px", borderRadius: 4, fontSize: 14 }}>
              SCORE: 0
            </span>
          </div>
          <canvas ref={boardRef} width={360} height={360} style={{ borderRadius: 8, display: "block" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {["↑","↓","←","→"].map((dir) => (
              <button key={dir} style={{ width: 44, height: 44, borderRadius: 6, border: "none", background: "#bbada0", color: "#f9f6f2", fontSize: 18, fontWeight: 700, cursor: "pointer" }}>
                {dir}
              </button>
            ))}
          </div>
        </div>

        {/* Graph Panel */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: 440, alignItems: "center" }}>
            <span style={{ color: "#776e65", fontWeight: 700, fontSize: 15 }}>Local Graph</span>
            <span style={{ color: "#9b8f82", fontSize: 12 }}>current + neighborhood</span>
          </div>
          <canvas ref={graphRef} width={440} height={360} style={{ borderRadius: 8, display: "block", border: "2px solid #cdc1b4" }} />
        </div>
      </div>

      <div style={{ marginTop: 32, padding: "16px 24px", background: "#ede0c8", borderRadius: 8, maxWidth: 600, width: "100%" }}>
        <h3 style={{ color: "#776e65", margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Phase 1 Status</h3>
        <ul style={{ color: "#776e65", fontSize: 13, margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Rust crate: <code>artifacts/game-2048/wasm-game/Cargo.toml</code></li>
          <li>Build: <code>pnpm --filter @workspace/game-2048 run build-wasm</code></li>
          <li>Frontend: Vite + React — canvas rendering ready</li>
          <li>Graph panel: <strong>focused local view</strong> (current node + immediate neighborhood)</li>
          <li>Phases 2–13: data model, move logic, WASM bridge, rendering</li>
        </ul>
      </div>
    </div>
  );
}
