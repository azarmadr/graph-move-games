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
import { GameBoardElement } from "./game-board";
import { ScoreDisplayElement } from "./score-display";
import { GraphControlsElement } from "./graph-controls";

export class GameAppElement extends HTMLElement {
  private state: GameState | null = null;
  private config: GameConfig = {
    rows: 3,
    cols: 3,
    spawn_config: { spawns: { 2: 9, 4: 1 } },
  };
  private lastMove: { moved: boolean; scoreGained: number } | null = null;
  private activeTab: "play" | "graph" = "play";
  private visualizationGraph: GraphData | null = null;
  private visualizationGames: GameInstance[] = [];
  private visualizationActiveGameId: string | undefined;

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
    this.activeTab = "graph";
    this.render();

    try {
      const [graph, snapshot] = await Promise.all([getGraph(), exportGraph()]);
      this.visualizationGraph = graph;
      this.visualizationGames = Object.values(snapshot.games);
      this.visualizationActiveGameId = this.state?.game.id;
      this.linkGraphTab();
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
            ? `<div class="graph-container">
                <graph-tab></graph-tab>
                <graph-controls></graph-controls>
              </div>`
            : `<game-board></game-board>`
        }
      </div>
    `;

    this.bindEvents();
    this.linkChildElements();
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
  }

  private linkChildElements() {
    if (this.activeTab === "play") {
      const board = this.querySelector<GameBoardElement>("game-board");
      if (board) {
        board.state = this.state;
        board.lastMove = this.lastMove;
        board.addEventListener("move", ((e: CustomEvent) => {
          void this.handleMove(e.detail.direction);
        }) as EventListener);
        board.addEventListener("new-game", () => {
          void this.startNewGame(this.config.rows, this.config.cols);
        });
      }

      const score = this.querySelector<ScoreDisplayElement>("score-display");
      if (score) {
        score.state = this.state;
        score.lastMove = this.lastMove;
      }
    }

    if (this.activeTab === "graph") {
      this.linkGraphTab();
    }
  }

  private linkGraphTab() {
    const el = this.querySelector<GraphTabElement>("graph-tab");
    if (!el) return;
    el.graphData = this.visualizationGraph;
    el.games = this.visualizationGames;
    el.activeGameId = this.visualizationActiveGameId;

    const controls = this.querySelector<GraphControlsElement>("graph-controls");
    if (controls) {
      const markers = this.buildNavMarkers();
      controls.markers = markers;
      controls.zoom = el.zoom;

      controls.addEventListener("navigate-node", ((e: CustomEvent) => {
        el.centerOnNode(e.detail.nodeId);
      }) as EventListener);

      controls.addEventListener("zoom-change", ((e: CustomEvent) => {
        el.zoomBy(e.detail.direction);
      }) as EventListener);

      controls.addEventListener("physics-toggle", (() => {
        el.togglePhysics();
        controls.physicsEnabled = el.physicsEnabled;
      }) as EventListener);

      el.addEventListener("zoom-level", ((e: CustomEvent) => {
        controls.zoom = e.detail.zoom;
      }) as EventListener);
    }
  }

  private buildNavMarkers(): Array<{ id: string; label: string }> {
    const markers: Array<{ id: string; label: string }> = [];
    if (this.state) {
      markers.push({
        id: `board:${this.state.game.current_board_id}`,
        label: "Active game",
      });
    }
    if (this.visualizationGraph) {
      const nodeIds = Object.keys(this.visualizationGraph.nodes);
      if (nodeIds.length > 0) {
        const rootId = nodeIds[0];
        if (!markers.some((m) => m.id === `board:${rootId}`)) {
          markers.push({ id: `board:${rootId}`, label: "Root" });
        }
      }
    }
    return markers;
  }
}
