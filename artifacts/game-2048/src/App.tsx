import { useEffect, useRef, useState } from "react";
import { loadWasm, createGame, createGameWithConfig, makeMove, type GameState, type Direction, type Node, type Edge, type EdgeType, type GameConfig } from "./wasmBridge";

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

function drawBoard(canvas: HTMLCanvasElement, state: GameState) {
  const ctx = canvas.getContext("2d")!;
  const size = canvas.width;
  const padding = 12;
  const gap = 8;
  const [rows, cols] = state.active_board.dim;
  const cellSize = (size - padding * 2 - gap * (Math.max(rows, cols) - 1)) / Math.max(rows, cols);
  // Board width/height based on actual dimensions
  const boardW = padding * 2 + cols * cellSize + (cols - 1) * gap;
  const boardH = padding * 2 + rows * cellSize + (rows - 1) * gap;

  ctx.fillStyle = "#bbada0";
  ctx.beginPath();
  ctx.roundRect(0, 0, boardW, boardH, 8);
  ctx.fill();

  // Build grid from sparse board
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const cell of state.active_board.tiles) {
    grid[cell.pos.r][cell.pos.c] = cell.tile;
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = grid[r][c];
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

/* ── Focused graph renderer (real data from WASM) ──────────────────────── */
function drawFocusedGraph(canvas: HTMLCanvasElement, state: GameState) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, w, h);

  const { nodes, edges } = state.graph;
  const cursorSink = state.cursor.sink_id;

  // Gather neighborhood: predecessors (edges -> cursorSink) and successors (cursorSink -> edges)
  const predIds = new Set<number>();
  const succIds = new Set<number>();
  for (const e of edges) {
    if (e.to === cursorSink) predIds.add(e.from);
    if (e.from === cursorSink) succIds.add(e.to);
  }

  // Build display nodes: predecessor(s), current, successor(s)
  const displayNodes: Array<{
    node: Node;
    isCurrent: boolean;
    edgeColor: string;
    edgeLabel?: string;
  }> = [];

  const findNode = (id: number) => nodes.find((n) => n.node_id === id);

  // Predecessors
  for (const pid of predIds) {
    const n = findNode(pid);
    if (n) displayNodes.push({ node: n, isCurrent: false, edgeColor: "#4cc9f0" });
  }

  // Current
  const cur = findNode(cursorSink);
  if (cur) displayNodes.push({ node: cur, isCurrent: true, edgeColor: "#4cc9f0" });

  // Successors — deduplicate by node_id, label by first move edge direction
  for (const sid of succIds) {
    const n = findNode(sid);
    if (!n) continue;
    // Find the Move edge label
    const moveEdge = edges.find((e) => e.from === cursorSink && e.to === sid && "Move" in (e.edge_type as any));
    const label = moveEdge
      ? (moveEdge.edge_type as { Move: { direction: string } }).Move.direction.toLowerCase()
      : "spawn";
    displayNodes.push({ node: n, isCurrent: false, edgeColor: "#f72585", edgeLabel: label });
  }

  if (displayNodes.length === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("No graph data yet", w / 2, h / 2);
    return;
  }

  // Assign positions: current center, preds above, succs below
  const positions = new Map<number, { x: number; y: number }>();
  const cx = w / 2;
  const cy = h / 2 + 12;
  const levelGap = 100;

  // Count predecessors and successors for horizontal spacing
  const preds = displayNodes.filter((d) => !d.isCurrent && predIds.has(d.node.node_id));
  const succs = displayNodes.filter((d) => !d.isCurrent && succIds.has(d.node.node_id));

  if (preds.length > 0) {
    const startX = cx - (preds.length - 1) * 60;
    preds.forEach((d, i) => {
      positions.set(d.node.node_id, { x: startX + i * 120, y: cy - levelGap });
    });
  }
  positions.set(cursorSink, { x: cx, y: cy });
  if (succs.length > 0) {
    const startX = cx - (succs.length - 1) * 50;
    succs.forEach((d, i) => {
      positions.set(d.node.node_id, { x: startX + i * 100, y: cy + levelGap + 20 });
    });
  }

  // Draw edges
  const drawEdge = (fromId: number, toId: number, label?: string, color = "rgba(255,255,255,0.25)") => {
    const a = positions.get(fromId);
    const b = positions.get(toId);
    if (!a || !b) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    if (label) {
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(mx - tw / 2, my - 7, tw, 14);
      ctx.fillStyle = color;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, mx, my);
    }
  };

  // Pred edges
  for (const pid of predIds) drawEdge(pid, cursorSink, "spawn", "#4cc9f0");
  // Succ edges
  for (const d of succs) {
    const label = d.edgeLabel;
    drawEdge(cursorSink, d.node.node_id, label, d.edgeColor);
  }

  // Draw nodes
  const miniSize = 44;
  const cellSize = (miniSize - 4) / 4;

  for (const d of displayNodes) {
    const pos = positions.get(d.node.node_id)!;
    const { x, y } = pos;
    const isCur = d.isCurrent;

    // Grid for mini board
    const [mRows, mCols] = d.node.board.dim;
    const grid: number[][] = Array.from({ length: mRows }, () => Array(mCols).fill(0));
    for (const cell of d.node.board.tiles) {
      grid[cell.pos.r][cell.pos.c] = cell.tile;
    }

    // Glow for current
    if (isCur) {
      ctx.save();
      ctx.shadowColor = d.edgeColor;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = d.edgeColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - miniSize / 2, y - miniSize / 2, miniSize, miniSize, 4);
      ctx.stroke();
      ctx.restore();
    }

    // Mini board bg
    ctx.fillStyle = isCur ? "#2a2a45" : "#1e1e30";
    ctx.strokeStyle = isCur ? d.edgeColor : "rgba(255,255,255,0.15)";
    ctx.lineWidth = isCur ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(x - miniSize / 2, y - miniSize / 2, miniSize, miniSize, 4);
    ctx.fill();
    ctx.stroke();

    // Mini tiles
    for (let r = 0; r < mRows; r++) {
      for (let c = 0; c < mCols; c++) {
        const val = grid[r][c];
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

    // Label
    ctx.fillStyle = isCur ? d.edgeColor : "rgba(255,255,255,0.45)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    const labelText = isCur ? "current" : (d.edgeLabel ?? "node");
    ctx.fillText(labelText, x, y + miniSize / 2 + 14);
  }

  // Legend
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Game ${state.active_game_id} · Node ${cursorSink} · Score ${state.cursor.score} · ${state.cursor.status}`, 12, h - 12);
}

/* ── Main App ──────────────────────────────────────────────────── */
export default function App() {
  const boardRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [config, setConfig] = useState<GameConfig>({ rows: 4, cols: 4 });

  useEffect(() => {
    loadWasm().then(() => createGameWithConfig(config)).then((s) => setState(s));
  }, []);

  useEffect(() => {
    if (!state) return;
    if (boardRef.current) drawBoard(boardRef.current, state);
    if (graphRef.current) drawFocusedGraph(graphRef.current, state);
  }, [state]);

  const handleMove = async (dir: Direction) => {
    if (!state || state.cursor.status === "Terminated") return;
    try {
      const resp = await makeMove(state.active_game_id, dir);
      setState(resp.game_state);
    } catch (e) {
      console.error("move failed:", e);
    }
  };

  // Keyboard handler
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
        w: "Up", s: "Down", a: "Left", d: "Right",
        W: "Up", S: "Down", A: "Left", D: "Right",
      };
      if (map[e.key]) {
        e.preventDefault();
        handleMove(map[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  // Touch / swipe handler (attached to board canvas)
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // stop pull-to-refresh and page scroll
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const start = touchStart.current;
    if (!start || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const threshold = 24; // px
    if (Math.max(absDx, absDy) < threshold) return; // tap, not swipe
    if (absDx > absDy) {
      handleMove(dx > 0 ? "Right" : "Left");
    } else {
      handleMove(dy > 0 ? "Down" : "Up");
    }
    touchStart.current = null;
  };

  const startNewGame = async (rows: number, cols: number) => {
    const newConfig = { rows, cols };
    setConfig(newConfig);
    const s = await createGameWithConfig(newConfig);
    setState(s);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf8ef", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", fontFamily: "'Clear Sans', Arial, sans-serif" }}>
      <h1 style={{ color: "#776e65", fontSize: 36, fontWeight: 800, margin: "0 0 4px" }}>2048</h1>
      <p style={{ color: "#9b8f82", fontSize: 14, margin: "0 0 24px" }}>
        Rust/WASM · Phase 2 — real data model + WASM bridge
      </p>

      {/* Dimension selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <span style={{ color: "#776e65", fontSize: 13, fontWeight: 600 }}>Board size:</span>
        {[[3,3], [4,4], [5,5]].map(([r, c]) => (
          <button
            key={`${r}x${c}`}
            onClick={() => startNewGame(r, c)}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: "none",
              background: config.rows === r && config.cols === c ? "#8f7a66" : "#bbada0",
              color: "#f9f6f2",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {r}×{c}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
        {/* Board Panel */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: 360, alignItems: "center" }}>
            <span style={{ color: "#776e65", fontWeight: 700, fontSize: 15 }}>Board</span>
            <span style={{ background: "#bbada0", color: "#f9f6f2", fontWeight: 700, padding: "4px 14px", borderRadius: 4, fontSize: 14 }}>
              SCORE: {state?.cursor.score ?? 0}
            </span>
          </div>
          <canvas
            ref={boardRef}
            width={360}
            height={360}
            style={{ borderRadius: 8, display: "block", touchAction: "none" }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          />
          <div className="arrow-buttons" style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {["↑","↓","←","→"].map((dir) => (
              <button
                key={dir}
                disabled={state?.cursor.status === "Terminated"}
                onClick={() => {
                  const dmap: Record<string, Direction> = { "↑": "Up", "↓": "Down", "←": "Left", "→": "Right" };
                  handleMove(dmap[dir]);
                }}
                style={{ width: 44, height: 44, borderRadius: 6, border: "none", background: "#bbada0", color: "#f9f6f2", fontSize: 18, fontWeight: 700, cursor: state?.cursor.status === "Terminated" ? "not-allowed" : "pointer", opacity: state?.cursor.status === "Terminated" ? 0.5 : 1 }}
              >
                {dir}
              </button>
            ))}
          </div>
        </div>

        {/* Graph Panel */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: 440, alignItems: "center" }}>
            <span style={{ color: "#776e65", fontWeight: 700, fontSize: 15 }}>Local Graph</span>
            <span style={{ color: "#9b8f82", fontSize: 12 }}>
              {state ? `${state.graph.nodes.length} nodes · ${state.graph.edges.length} edges` : "loading…"}
            </span>
          </div>
          <canvas ref={graphRef} width={440} height={360} style={{ borderRadius: 8, display: "block", border: "2px solid #cdc1b4" }} />
        </div>
      </div>

      <div style={{ marginTop: 32, padding: "16px 24px", background: "#ede0c8", borderRadius: 8, maxWidth: 600, width: "100%" }}>
        <h3 style={{ color: "#776e65", margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Phase 2 Status</h3>
        <ul style={{ color: "#776e65", fontSize: 13, margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Rust types: Board, Cell, Node, Edge, GameCursor, GraphSnapshot</li>
          <li>WASM exports: <code>create_game()</code>, <code>make_move(req)</code>, <code>get_state(id)</code></li>
          <li>JS bridge: <code>wasmBridge.ts</code> — typed JSON contract matching Rust structs</li>
          <li>Graph panel: renders real neighborhood from WASM graph snapshot</li>
        </ul>
      </div>
    </div>
  );
}
