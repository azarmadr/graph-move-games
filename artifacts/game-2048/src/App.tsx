import { useEffect, useRef, useState } from "react";
import { loadWasm, createGame, createGameWithConfig, makeMove, exportGraph, importGraph, type GameState, type Direction, type Node, type Edge, type GameConfig } from "./wasmBridge";

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
  const boardW = padding * 2 + cols * cellSize + (cols - 1) * gap;
  const boardH = padding * 2 + rows * cellSize + (rows - 1) * gap;

  ctx.fillStyle = "#bbada0";
  ctx.beginPath();
  ctx.roundRect(0, 0, boardW, boardH, 8);
  ctx.fill();

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

function isMoveKind(edge: Edge): { Move: { direction: Direction } } | null {
  return edge.kind.Move ? (edge.kind as { Move: { direction: Direction } }) : null;
}

function isSpawnKind(edge: Edge): { Spawn: { cells: any[] } } | null {
  return edge.kind.Spawn ? (edge.kind as { Spawn: { cells: any[] } }) : null;
}

function drawFocusedGraph(canvas: HTMLCanvasElement, state: GameState) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, w, h);

  const { nodes, edges } = state.graph;
  const currentId = state.game.current_node_id;
  const findNode = (id: string) => nodes.find((n) => n.node_id === id);

  // Build a vertical chain: ancestor -> merge -> current
  const current = findNode(currentId);
  if (!current) {
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("No graph data yet", w / 2, h / 2);
    return;
  }

  type DisplayNode = { node: Node; label: string; color: string; yOffset: number };
  const displayNodes: DisplayNode[] = [];

  // Current node
  displayNodes.push({ node: current, label: "current", color: "#4cc9f0", yOffset: 1 });

  // Merge nodes: edges pointing to current with Spawn kind
  const mergeIds = new Set<string>();
  for (const e of edges) {
    if (e.to === currentId && isSpawnKind(e)) {
      mergeIds.add(e.from);
    }
  }

  for (const mid of mergeIds) {
    const n = findNode(mid);
    if (n) displayNodes.push({ node: n, label: "merge", color: "#f72585", yOffset: 0 });
  }

  // Ancestor nodes: edges pointing to merge nodes with Move kind
  const ancestorIds = new Set<string>();
  for (const mid of mergeIds) {
    for (const e of edges) {
      if (e.to === mid && isMoveKind(e)) {
        ancestorIds.add(e.from);
      }
    }
  }
  for (const aid of ancestorIds) {
    const n = findNode(aid);
    if (n) displayNodes.push({ node: n, label: "before", color: "#a3a3a3", yOffset: -1 });
  }

  // Position nodes: y based on yOffset, x centered with spread
  const positions = new Map<string, { x: number; y: number }>();
  const cx = w / 2;
  const cy = h / 2 + 12;
  const levelGap = 90;

  const byLevel = (offset: number) => displayNodes.filter((d) => d.yOffset === offset);
  for (const offset of [-1, 0, 1]) {
    const levelNodes = byLevel(offset);
    if (levelNodes.length === 0) continue;
    const startX = cx - (levelNodes.length - 1) * 50;
    levelNodes.forEach((d, i) => {
      positions.set(d.node.node_id, { x: startX + i * 100, y: cy + offset * levelGap });
    });
  }

  const drawEdge = (fromId: string, toId: string, label: string, color: string) => {
    const a = positions.get(fromId);
    const b = positions.get(toId);
    if (!a || !b) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

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
  };

  // Draw edges between displayed nodes
  for (const e of edges) {
    if (!positions.has(e.from) || !positions.has(e.to)) continue;
    const move = isMoveKind(e);
    const spawn = isSpawnKind(e);
    if (move) {
      drawEdge(e.from, e.to, move.Move.direction.toLowerCase(), "#4cc9f0");
    } else if (spawn) {
      drawEdge(e.from, e.to, "spawn", "#f72585");
    }
  }

  // Draw nodes
  const miniSize = 44;
  const cellSize = (miniSize - 4) / 4;

  for (const d of displayNodes) {
    const pos = positions.get(d.node.node_id)!;
    const { x, y } = pos;
    const isCur = d.label === "current";

    const [mRows, mCols] = d.node.board.dim;
    const grid: number[][] = Array.from({ length: mRows }, () => Array(mCols).fill(0));
    for (const cell of d.node.board.tiles) {
      grid[cell.pos.r][cell.pos.c] = cell.tile;
    }

    if (isCur) {
      ctx.save();
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(x - miniSize / 2, y - miniSize / 2, miniSize, miniSize, 4);
      ctx.stroke();
      ctx.restore();
    }

    ctx.fillStyle = isCur ? "#2a2a45" : "#1e1e30";
    ctx.strokeStyle = isCur ? d.color : "rgba(255,255,255,0.15)";
    ctx.lineWidth = isCur ? 2 : 1;
    ctx.beginPath();
    ctx.roundRect(x - miniSize / 2, y - miniSize / 2, miniSize, miniSize, 4);
    ctx.fill();
    ctx.stroke();

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

    ctx.fillStyle = isCur ? d.color : "rgba(255,255,255,0.45)";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.fillText(d.label, x, y + miniSize / 2 + 14);
  }

  // Legend
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.font = "11px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`Game ${state.active_game_id} · Node ${currentId} · Score ${state.game.score} · ${state.game.is_terminated ? "Terminated" : "Active"}`, 12, h - 12);
}

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
    if (!state || state.game.is_terminated) return;
    try {
      const resp = await makeMove(state.active_game_id, dir);
      setState(resp.game_state);
    } catch (e) {
      console.error("move failed:", e);
    }
  };

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

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
  };
  const onTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const start = touchStart.current;
    if (!start || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const threshold = 24;
    if (Math.max(absDx, absDy) < threshold) return;
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

  const handleExport = async () => {
    try {
      const data = await exportGraph();
      const json = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(json);
      alert("Graph exported to clipboard!");
    } catch (e) {
      console.error("export failed:", e);
      alert("Export failed — see console.");
    }
  };

  const handleImport = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const result = await importGraph(text);
      if (result.success && result.games.length > 0) {
        setState(result.games[0]);
      }
      alert(`Imported ${result.games.length} game(s).`);
    } catch (e) {
      console.error("import failed:", e);
      alert("Import failed — see console.");
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf8ef", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", fontFamily: "'Clear Sans', Arial, sans-serif" }}>
      <h1 style={{ color: "#776e65", fontSize: 36, fontWeight: 800, margin: "0 0 4px" }}>2048</h1>
      <p style={{ color: "#9b8f82", fontSize: 14, margin: "0 0 24px" }}>
        Rust/WASM · Model-driven DAG · Phase 2
      </p>

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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: 360, alignItems: "center" }}>
            <span style={{ color: "#776e65", fontWeight: 700, fontSize: 15 }}>Board</span>
            <span style={{ background: "#bbada0", color: "#f9f6f2", fontWeight: 700, padding: "4px 14px", borderRadius: 4, fontSize: 14 }}>
              SCORE: {state?.game.score ?? 0}
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
                disabled={state?.game.is_terminated}
                onClick={() => {
                  const dmap: Record<string, Direction> = { "↑": "Up", "↓": "Down", "←": "Left", "→": "Right" };
                  handleMove(dmap[dir]);
                }}
                style={{ width: 44, height: 44, borderRadius: 6, border: "none", background: "#bbada0", color: "#f9f6f2", fontSize: 18, fontWeight: 700, cursor: state?.game.is_terminated ? "not-allowed" : "pointer", opacity: state?.game.is_terminated ? 0.5 : 1 }}
              >
                {dir}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: 440, alignItems: "center" }}>
            <span style={{ color: "#776e65", fontWeight: 700, fontSize: 15 }}>Local Graph</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ color: "#9b8f82", fontSize: 12 }}>
                {state ? `${state.graph.nodes.length} nodes · ${state.graph.edges.length} edges` : "loading…"}
              </span>
              <button onClick={handleExport} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: "#8f7a66", color: "#f9f6f2", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Export</button>
              <button onClick={handleImport} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: "#8f7a66", color: "#f9f6f2", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Import</button>
            </div>
          </div>
          <canvas ref={graphRef} width={440} height={360} style={{ borderRadius: 8, display: "block", border: "2px solid #cdc1b4" }} />
        </div>
      </div>

      <div style={{ marginTop: 32, padding: "16px 24px", background: "#ede0c8", borderRadius: 8, maxWidth: 600, width: "100%" }}>
        <h3 style={{ color: "#776e65", margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Model Refactor</h3>
        <ul style={{ color: "#776e65", fontSize: 13, margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Nodes are pure board states (no <code>NodeKind</code>)</li>
          <li>Edges are atomic transitions with <code>kind</code>: <code>Move</code> or <code>Spawn</code></li>
          <li>Valid move creates two nodes and two edges: current → merge → spawn</li>
          <li>Game instance tracks <code>source_node_id</code>, <code>current_node_id</code>, score, terminated</li>
          <li>Graph export/import persists the full DAG and all game instances</li>
        </ul>
      </div>
    </div>
  );
}
