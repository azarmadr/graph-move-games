import {
  loadWasm,
  createGameWithConfig,
  makeMove,
  getState,
  getGraph,
  exportGraph,
  importGraph,
  type GameState,
  type Direction,
  type GameConfig,
  type GameInstance,
  type GraphData,
} from "./wasmBridge";
import { GraphTabElement } from "./graph-tab";

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

export class GameAppElement extends HTMLElement {
  private state: GameState | null = null;
  private config: GameConfig = {
    rows: 4,
    cols: 4,
    spawn_config: { spawns: { 2: 9, 4: 1 } },
  };
  private lastMove: { moved: boolean; scoreGained: number } | null = null;
  private activeTab: "play" | "graph" = "play";
  private visualizationGraph: GraphData | null = null;
  private visualizationGames: GameInstance[] = [];
  private visualizationActiveGameId: string | undefined;
  private touchStart: { x: number; y: number } | null = null;

  private static readonly STORAGE_KEY = "game-2048-persisted-v1";

  connectedCallback() {
    this.render();
    window.addEventListener("keydown", this.onKeyDown);
    loadWasm().then(async () => {
      const saved = localStorage.getItem(GameAppElement.STORAGE_KEY);
      console.trace("restoring from localStorage:", saved);
      if (saved) {
        try {
          const { exportData, activeGameId } = JSON.parse(saved);
          const result = await importGraph(JSON.stringify(exportData));
          this.lastMove = null;
          if (result.success && result.games.length > 0) {
            const restored = await getState(activeGameId as string);
            this.setStateAndRender(restored);
            return;
          }
        } catch (e) {
          console.error("restore failed:", e);
        }
      }
      console.trace("Creating games with config", { config: this.config });
      const s = await createGameWithConfig(this.config);
      console.trace("Saved games", { s });
      this.lastMove = null;
      this.setStateAndRender(s);
    });
  }

  disconnectedCallback() {
    window.removeEventListener("keydown", this.onKeyDown);
  }

  private setStateAndRender(s: GameState) {
    this.state = s;
    this.render();
    this.autosave();
  }

  private autosave() {
    if (!this.state) return;
    exportGraph()
      .then((data) => {
        const payload = JSON.stringify({
          exportData: data,
          activeGameId: this.state?.game.id,
        });
        localStorage.setItem(GameAppElement.STORAGE_KEY, payload);
      })
      .catch((e) => console.error("autosave failed:", e));
  }

  private onKeyDown = (e: KeyboardEvent) => {
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
      void this.handleMove(map[e.key]);
    }
  };

  private async handleMove(dir: Direction) {
    if (!this.state || this.state.game.is_terminated) return;
    const previous = this.state;
    try {
      const state = await makeMove(this.state.game.id, dir);
      const moved =
        state.game.current_board_id !== previous.game.current_board_id;
      this.lastMove = {
        moved,
        scoreGained: moved ? state.game.score - previous.game.score : 0,
      };
      this.state = state;
      this.render();
      this.autosave();
    } catch (e) {
      console.error("move failed:", e);
    }
  }

  private onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    this.touchStart = { x: t.clientX, y: t.clientY };
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
  };

  private onTouchEnd = (e: TouchEvent) => {
    const start = this.touchStart;
    if (!start || e.changedTouches.length === 0) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const threshold = 24;
    if (Math.max(absDx, absDy) < threshold) return;
    if (absDx > absDy) {
      void this.handleMove(dx > 0 ? "Right" : "Left");
    } else {
      void this.handleMove(dy > 0 ? "Down" : "Up");
    }
    this.touchStart = null;
  };

  private async startNewGame(rows: number, cols: number) {
    const newConfig = {
      rows,
      cols,
      spawn_config: { spawns: { 2: 9, 4: 1 } },
    };
    this.config = newConfig;
    const s = await createGameWithConfig(newConfig);
    this.lastMove = null;
    this.setStateAndRender(s);
  }

  private async openGraphVisualization() {
    try {
      const [graph, snapshot] = await Promise.all([getGraph(), exportGraph()]);
      this.visualizationGraph = graph;
      this.visualizationGames = Object.values(snapshot.games);
      this.visualizationActiveGameId = this.state?.game.id;
      this.activeTab = "graph";
      this.render();
    } catch (e) {
      console.error("graph visualization snapshot failed:", e);
    }
  }

  private render() {
    const isGameOver = this.state?.game.is_terminated ?? false;
    const tab = this.activeTab;

    this.innerHTML = `
      <div
        style="min-height:100vh;background:#faf8ef;display:flex;flex-direction:column;align-items:center;padding:32px 16px;font-family:'Clear Sans',Arial,sans-serif;"
      >
        <h1 style="color:#776e65;font-size:36px;font-weight:800;margin:0 0 4px;">
          2048
        </h1>
        <p style="color:#9b8f82;font-size:14px;margin:0 0 24px;">
          Rust/WASM · Model-driven DAG · Phase 2
        </p>

        <nav class="app-tabs" aria-label="Application views">
          <button
            class="${tab === "play" ? "app-tab active" : "app-tab"}"
            type="button"
            data-tab="play"
          >
            Play
          </button>
          <button
            class="${tab === "graph" ? "app-tab active" : "app-tab"}"
            type="button"
            data-tab="graph"
            ${!this.state ? "disabled" : ""}
          >
            Graph
          </button>
        </nav>

        <div
          style="display:flex;gap:8px;margin-bottom:16px;align-items:center;"
        >
          <span style="color:#776e65;font-size:13px;font-weight:600;">
            Board size:
          </span>
          ${(
            [
              [3, 3],
              [4, 4],
              [5, 5],
            ] as const
          )
            .map(
              ([r, c]) => `
            <button
              key="${r}x${c}"
              type="button"
              data-size="${r}x${c}"
              style="padding:4px 10px;border-radius:4px;border:none;background:${
                this.config.rows === r && this.config.cols === c
                  ? "#8f7a66"
                  : "#bbada0"
              };color:#f9f6f2;font-size:12px;font-weight:700;cursor:pointer;"
            >
              ${r}×${c}
            </button>
          `,
            )
            .join("")}
        </div>

        ${
          tab === "graph"
            ? `<graph-tab></graph-tab>`
            : `
          <div
            style="display:flex;gap:32px;flex-wrap:wrap;justify-content:center;position:relative;"
          >
            <div
              style="display:flex;flex-direction:column;align-items:center;gap:8px;"
            >
              <div
                style="display:flex;justify-content:space-between;width:360px;align-items:center;"
              >
                <span style="color:#776e65;font-weight:700;font-size:15px;">
                  Board
                </span>
                <span
                  style="background:#bbada0;color:#f9f6f2;font-weight:700;padding:4px 14px;border-radius:4px;font-size:14px;"
                >
                  SCORE: ${this.state?.game.score ?? 0}
                </span>
              </div>
              <div style="position:relative;">
                <canvas
                  width="360"
                  height="360"
                  style="border-radius:8px;display:block;touch-action:none;"
                ></canvas>
                ${
                  isGameOver
                    ? `
                  <div
                    style="position:absolute;top:0;left:0;width:100%;height:100%;border-radius:8px;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10;"
                  >
                    <div
                      style="background:#f65e3b;color:#f9f6f2;padding:24px;border-radius:8px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);"
                    >
                      <div
                        style="font-size:24px;font-weight:800;margin-bottom:8px;"
                      >
                        Game Over!
                      </div>
                      <div
                        style="font-size:14px;opacity:0.9;margin-bottom:12px;"
                      >
                        No more valid moves
                      </div>
                      <button
                        type="button"
                        data-action="new-game"
                        style="padding:8px 16px;border-radius:4px;border:none;background:#f9f6f2;color:#f65e3b;font-size:12px;font-weight:700;cursor:pointer;"
                      >
                        New Game
                      </button>
                    </div>
                  </div>
                `
                    : ""
                }
              </div>
              <div
                class="arrow-buttons"
                style="display:flex;gap:8px;margin-top:8px;"
              >
                ${(
                  [
                    ["↑", "Up"],
                    ["↓", "Down"],
                    ["←", "Left"],
                    ["→", "Right"],
                  ] as const
                )
                  .map(
                    ([label, dir]) => `
                  <button
                    type="button"
                    data-dir="${dir}"
                    ${isGameOver ? "disabled" : ""}
                    style="width:44px;height:44px;border-radius:6px;border:none;background:#bbada0;color:#f9f6f2;font-size:18px;font-weight:700;cursor:${
                      isGameOver ? "not-allowed" : "pointer"
                    };opacity:${isGameOver ? 0.5 : 1};"
                  >
                    ${label}
                  </button>
                `,
                  )
                  .join("")}
              </div>
              ${
                this.lastMove
                  ? `
                <div
                  style="margin-top:8px;padding:4px 10px;border-radius:4px;background:${
                    this.lastMove.moved ? "#8f7a66" : "#f65e3b"
                  };color:#f9f6f2;font-size:12px;font-weight:600;"
                >
                  ${
                    this.lastMove.moved
                      ? `Valid move · +${this.lastMove.scoreGained} score`
                      : "Invalid move — no board change"
                  }
                </div>
              `
                  : ""
              }
            </div>
          </div>
        `
        }
      </div>
    `;

    this.bindEvents();
    if (this.activeTab === "play" && this.state) {
      const canvas = this.querySelector<HTMLCanvasElement>("canvas");
      if (canvas) drawBoard(canvas, this.state);
    }
    if (this.activeTab === "graph") this.linkGraphTab();
  }

  private bindEvents() {
    for (const btn of this.querySelectorAll<HTMLButtonElement>("[data-tab]")) {
      btn.addEventListener("click", () => {
        if (btn.dataset.tab === "graph") {
          void this.openGraphVisualization();
        } else {
          this.activeTab = "play";
          this.render();
        }
      });
    }
    for (const btn of this.querySelectorAll<HTMLButtonElement>("[data-size]")) {
      btn.addEventListener("click", () => {
        const [r, c] = (btn.dataset.size ?? "4x4").split("x").map(Number);
        void this.startNewGame(r, c);
      });
    }
    for (const btn of this.querySelectorAll<HTMLButtonElement>("[data-dir]")) {
      btn.addEventListener("click", () => {
        void this.handleMove(btn.dataset.dir as Direction);
      });
    }
    for (const btn of this.querySelectorAll<HTMLButtonElement>(
      '[data-action="new-game"]',
    )) {
      btn.addEventListener("click", () => {
        void this.startNewGame(this.config.rows, this.config.cols);
      });
    }
    const canvas = this.querySelector<HTMLCanvasElement>("canvas");
    if (canvas) {
      canvas.addEventListener("touchstart", this.onTouchStart);
      canvas.addEventListener("touchmove", this.onTouchMove);
      canvas.addEventListener("touchend", this.onTouchEnd);
    }
  }

  private linkGraphTab() {
    const el = this.querySelector<GraphTabElement>("graph-tab");
    if (!el) return;
    el.graphData = this.visualizationGraph;
    el.games = this.visualizationGames;
    el.activeGameId = this.visualizationActiveGameId;
  }
}
