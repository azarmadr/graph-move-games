import { useEffect, useRef, useState } from "react";
import {
  loadWasm,
  createGameWithConfig,
  makeMove,
  getState,
  exportGraph,
  importGraph,
  type GameState,
  type Direction,
  type GameConfig,
  type GameInstance,
  type GraphDelta,
  type GraphData,
} from "./wasmBridge";
import GraphTab from "./GraphTab";

const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  0: { bg: "#cdc1b4", fg: "#cdc1b4" },
  2: { bg: "#eee4da", fg: "#776e65" },
  4: { bg: "#ede0c8", fg: "#776e65" },
  8: { bg: "#f2b179", fg: "#f9f6f2" },
  16: { bg: "#f59563", fg: "#f9f6f2" },
  32: { bg: "#f67c5f", fg: "#f9f6f2" },
  64: { bg: "#f65e3b", fg: "#f9f6f2" },
  128: { bg: "#edcf72", fg: "#f9f6f2" },
  256: { bg: "#edcc61", fg: "#f9f6f2" },
  512: { bg: "#edc850", fg: "#f9f6f2" },
  1024: { bg: "#edc53f", fg: "#f9f6f2" },
  2048: { bg: "#edc22e", fg: "#f9f6f2" },
};

function drawBoard(canvas: HTMLCanvasElement, state: GameState) {
  const ctx = canvas.getContext("2d")!;
  const size = canvas.width;
  const padding = 12;
  const gap = 8;
  const [rows, cols] = state.active_board.dim;
  const cellSize =
    (size - padding * 2 - gap * (Math.max(rows, cols) - 1)) /
    Math.max(rows, cols);
  const boardW = padding * 2 + cols * cellSize + (cols - 1) * gap;
  const boardH = padding * 2 + rows * cellSize + (rows - 1) * gap;

  ctx.fillStyle = "#bbada0";
  ctx.beginPath();
  ctx.roundRect(0, 0, boardW, boardH, 8);
  ctx.fill();

  const grid: number[][] = Array.from({ length: rows }, () =>
    Array(cols).fill(0),
  );
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

export default function App() {
  const boardRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [config, setConfig] = useState<GameConfig>({
    rows: 4,
    cols: 4,
    spawn_config: { spawns: { 2: 9, 4: 1 } },
  });
  const [lastMove, setLastMove] = useState<GraphDelta | null>(null);
  const [activeTab, setActiveTab] = useState<"play" | "graph">("play");
  const [visualizationGraph, setVisualizationGraph] =
    useState<GraphData | null>(null);
  const [visualizationGames, setVisualizationGames] = useState<GameInstance[]>(
    [],
  );
  const [visualizationActiveGameId, setVisualizationActiveGameId] = useState<
    string | undefined
  >(undefined);
  useEffect(() => {
    if (!state) return;
    if (boardRef.current) drawBoard(boardRef.current, state);
  }, [state]);

  const handleMove = async (dir: Direction) => {
    if (!state || state.game.is_terminated) return;
    try {
      const resp = await makeMove(state.game.id, dir);
      setLastMove(resp.delta);
      setState(resp.game_state);
    } catch (e) {
      console.error("move failed:", e);
    }
  };

  const STORAGE_KEY = "game-2048-persisted-v1";

  useEffect(() => {
    if (!state) return;
    exportGraph()
      .then((data) => {
        const payload = JSON.stringify({
          exportData: data,
          activeGameId: state.game.id,
        });
        localStorage.setItem(STORAGE_KEY, payload);
      })
      .catch((e) => console.error("autosave failed:", e));
  }, [state]);

  useEffect(() => {
    loadWasm().then(async () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      console.trace("restoring from localStorage:", saved);
      if (saved) {
        try {
          const { exportData, activeGameId } = JSON.parse(saved);
          const result = await importGraph(JSON.stringify(exportData));
          setLastMove(null);
          if (result.success && result.games.length > 0) {
            const restored = await getState(activeGameId as string);
            setState(restored);
            return;
          }
        } catch (e) {
          console.error("restore failed:", e);
        }
      }
      console.trace("Creating games with config", { config });
      const s = await createGameWithConfig(config);
      console.trace("Saved games", { s });
      setLastMove(null);
      setState(s);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: "Up",
        ArrowDown: "Down",
        ArrowLeft: "Left",
        ArrowRight: "Right",
        w: "Up",
        s: "Down",
        a: "Left",
        d: "Right",
        W: "Up",
        S: "Down",
        A: "Left",
        D: "Right",
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
    const newConfig = {
      rows,
      cols,
      spawn_config: { spawns: { 2: 9, 4: 1 } },
    };
    setConfig(newConfig);
    const s = await createGameWithConfig(newConfig);
    setLastMove(null);
    setState(s);
  };

  const openGraphVisualization = async () => {
    try {
      const snapshot = await exportGraph();
      setVisualizationGraph(state?.graph ?? null);
      setVisualizationGames(Object.values(snapshot.games));
      setVisualizationActiveGameId(state?.game.id);
      setActiveTab("graph");
    } catch (e) {
      console.error("graph visualization snapshot failed:", e);
    }
  };

  const isGameOver = state?.game.is_terminated ?? false;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#faf8ef",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px",
        fontFamily: "'Clear Sans', Arial, sans-serif",
      }}
    >
      <h1
        style={{
          color: "#776e65",
          fontSize: 36,
          fontWeight: 800,
          margin: "0 0 4px",
        }}
      >
        2048
      </h1>
      <p style={{ color: "#9b8f82", fontSize: 14, margin: "0 0 24px" }}>
        Rust/WASM · Model-driven DAG · Phase 2
      </p>

      <nav className="app-tabs" aria-label="Application views">
        <button
          className={activeTab === "play" ? "app-tab active" : "app-tab"}
          onClick={() => setActiveTab("play")}
        >
          Play
        </button>
        <button
          className={activeTab === "graph" ? "app-tab active" : "app-tab"}
          onClick={openGraphVisualization}
          disabled={!state}
        >
          Graph
        </button>
      </nav>

      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <span style={{ color: "#776e65", fontSize: 13, fontWeight: 600 }}>
          Board size:
        </span>
        {[
          [3, 3],
          [4, 4],
          [5, 5],
        ].map(([r, c]) => (
          <button
            key={`${r}x${c}`}
            onClick={() => startNewGame(r, c)}
            style={{
              padding: "4px 10px",
              borderRadius: 4,
              border: "none",
              background:
                config.rows === r && config.cols === c ? "#8f7a66" : "#bbada0",
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

      {activeTab === "graph" ? (
        <GraphTab
          graphData={visualizationGraph}
          games={visualizationGames}
          activeGameId={visualizationActiveGameId}
        />
      ) : (
        <div
          style={{
            display: "flex",
            gap: 32,
            flexWrap: "wrap",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: 360,
                alignItems: "center",
              }}
            >
              <span style={{ color: "#776e65", fontWeight: 700, fontSize: 15 }}>
                Board
              </span>
              <span
                style={{
                  background: "#bbada0",
                  color: "#f9f6f2",
                  fontWeight: 700,
                  padding: "4px 14px",
                  borderRadius: 4,
                  fontSize: 14,
                }}
              >
                SCORE: {state?.game.score ?? 0}
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <canvas
                ref={boardRef}
                width={360}
                height={360}
                style={{
                  borderRadius: 8,
                  display: "block",
                  touchAction: "none",
                }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              />
              {isGameOver && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    borderRadius: 8,
                    background: "rgba(0, 0, 0, 0.6)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 10,
                  }}
                >
                  <div
                    style={{
                      background: "#f65e3b",
                      color: "#f9f6f2",
                      padding: "24px",
                      borderRadius: 8,
                      textAlign: "center",
                      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
                    }}
                  >
                    <div
                      style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}
                    >
                      Game Over!
                    </div>
                    <div
                      style={{ fontSize: 14, opacity: 0.9, marginBottom: 12 }}
                    >
                      No more valid moves
                    </div>
                    <button
                      onClick={() => startNewGame(config.rows, config.cols)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 4,
                        border: "none",
                        background: "#f9f6f2",
                        color: "#f65e3b",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      New Game
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div
              className="arrow-buttons"
              style={{ display: "flex", gap: 8, marginTop: 8 }}
            >
              {["↑", "↓", "←", "→"].map((dir) => (
                <button
                  key={dir}
                  disabled={isGameOver}
                  onClick={() => {
                    const dmap: Record<string, Direction> = {
                      "↑": "Up",
                      "↓": "Down",
                      "←": "Left",
                      "→": "Right",
                    };
                    handleMove(dmap[dir]);
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 6,
                    border: "none",
                    background: "#bbada0",
                    color: "#f9f6f2",
                    fontSize: 18,
                    fontWeight: 700,
                    cursor: isGameOver ? "not-allowed" : "pointer",
                    opacity: isGameOver ? 0.5 : 1,
                  }}
                >
                  {dir}
                </button>
              ))}
            </div>
            {lastMove && (
              <div
                style={{
                  marginTop: 8,
                  padding: "4px 10px",
                  borderRadius: 4,
                  background:
                    lastMove.nodes.length === 0 && lastMove.edges.length === 0
                      ? "#f65e3b"
                      : "#8f7a66",
                  color: "#f9f6f2",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {lastMove.nodes.length === 0 && lastMove.edges.length === 0
                  ? "Invalid move — no graph change"
                  : `Valid move · +${lastMove.nodes.length} nodes · +${lastMove.edges.length} edges · +${lastMove.score_delta} score`}
              </div>
            )}
          </div>
        </div>
      )}

      <div
        style={{
          marginTop: 32,
          padding: "16px 24px",
          background: "#ede0c8",
          borderRadius: 8,
          maxWidth: 600,
          width: "100%",
        }}
      >
        <h3
          style={{
            color: "#776e65",
            margin: "0 0 8px",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Game Over Fix
        </h3>
        <ul
          style={{
            color: "#776e65",
            fontSize: 13,
            margin: 0,
            paddingLeft: 18,
            lineHeight: 1.8,
          }}
        >
          <li>
            ✅ Fixed: Game over check now uses{" "}
            <code>state.game.is_terminated</code>
          </li>
          <li>✅ Buttons properly disabled when game is terminated</li>
          <li>✅ Game over modal overlay with "New Game" button</li>
          <li>✅ Keyboard/touch input blocked when game is over</li>
          <li>
            Nodes: Pure board states (no <code>NodeKind</code>)
          </li>
          <li>
            Edges: Atomic transitions with <code>kind</code>: <code>Move</code>{" "}
            or <code>Spawn</code>
          </li>
        </ul>
      </div>
    </div>
  );
}
