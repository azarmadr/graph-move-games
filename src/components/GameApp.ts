import { dlog } from "../utils/debug";
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
} from "../utils/wasmBridge";
import { GraphTabElement } from "./GraphTab";
import { GameBoardElement } from "./GameBoard";
import { ScoreDisplayElement } from "./ScoreDisplay";

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
  private visualizationActiveGameId: string | null = null;
  private resumeGames: GameInstance[] = [];

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
            await this.refreshResumeGames();
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

  private async refreshResumeGames() {
    try {
      const snapshot = await exportGraph();
      this.resumeGames = Object.values(snapshot.games);
    } catch {
      this.resumeGames = [];
    }
  }

  private getResumableGames(): GameInstance[] {
    const activeId = this.state?.game.id;
    return this.resumeGames.filter(
      (g) => !g.is_terminated && g.id !== activeId,
    );
  }

  private async handleResumeGame(gameId: string) {
    try {
      const s = await getState(gameId);
      this.config = { ...s.game.config };
      this.lastMove = null;
      this.setStateAndRender(s);
    } catch (e) {
      console.error("resume game failed:", e);
    }
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
    await this.refreshResumeGames();
    this.setStateAndRender(s);
  }

  private async openGraphVisualization() {
    dlog("openGraphVisualization START");
    this.activeTab = "graph";
    dlog("activeTab set");
    this.render();
    dlog("render() done — graph-tab in DOM");

    try {
      dlog("awaiting getGraph + exportGraph...");
      const [graph, snapshot] = await Promise.all([getGraph(), exportGraph()]);
      dlog("WASM done — nodes=" + Object.keys(graph.nodes).length);
      this.visualizationGraph = graph;
      this.visualizationGames = Object.values(snapshot.games);
      this.visualizationActiveGameId = this.state?.game.id ?? null;
      dlog("calling linkGraphTab...");
      this.linkGraphTab();
      dlog("linkGraphTab done");
    } catch (e) {
      dlog("ERROR: " + e);
      console.error("graph visualization snapshot failed:", e);
    }
  }

  private render() {
    const tab = this.activeTab;
    const sizeOptions = [
      [3, 3],
      [4, 4],
      [5, 5],
    ] as const;

    this.innerHTML = `
      <div id="dbg" style="position:fixed;bottom:0;left:0;right:0;z-index:9999;background:#000;color:#0f0;font:12px/1.4 monospace;padding:4px 8px;max-height:150px;overflow:auto;"></div>
      <div
        style="min-height:100vh;background:#faf8ef;display:flex;flex-direction:column;align-items:center;padding:32px 16px;font-family:'Clear Sans',Arial,sans-serif;"
      >
        <nav class="app-nav" aria-label="Application controls">
          <span class="app-nav-title">2048</span>

          ${this.getResumableGames().length > 0 ? `
          <select class="app-nav-select" data-resume-game aria-label="Resume game">
            ${this.getResumableGames().map((g) => {
              const cfg = g.config;
              const label = `Score ${g.score} · ${cfg.rows}×${cfg.cols}`;
              return `<option value="${g.id}">${label}</option>`;
            }).join("")}
          </select>
          ` : ""}

          <select class="app-nav-select" data-size aria-label="Board size">
            ${sizeOptions
              .map(
                ([r, c]) =>
                  `<option value="${r}x${c}" ${this.config.rows === r && this.config.cols === c ? "selected" : ""}>${r}×${c}</option>`,
              )
              .join("")}
          </select>

          <div class="app-tabs" aria-label="Application views">
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
          </div>

          <button
            id="download-data"
            type="button"
            class="app-nav-download"
            title="Download data"
          >
            ↓
          </button>
          <button
            id="upload-data"
            type="button"
            class="app-nav-download"
            title="Import JSON"
          >
            ↑
          </button>
          <input
            type="file"
            id="upload-file"
            accept=".json"
            style="display:none;"
          />
        </nav>

        ${
          tab === "graph"
            ? `<div class="graph-container">
                <graph-tab></graph-tab>
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

    const sizeSelect = this.querySelector<HTMLSelectElement>("[data-size]");
    if (sizeSelect) {
      sizeSelect.addEventListener("change", () => {
        const [r, c] = (sizeSelect.value ?? "4x4").split("x").map(Number);
        void this.startNewGame(r, c);
      });
    }

    const resumeSelect = this.querySelector<HTMLSelectElement>(
      "[data-resume-game]",
    );
    if (resumeSelect) {
      resumeSelect.addEventListener("change", () => {
        void this.handleResumeGame(resumeSelect.value);
      });
    }

    const dlBtn = this.querySelector<HTMLButtonElement>("#download-data");
    if (dlBtn) {
      dlBtn.addEventListener("click", () => {
        const data = localStorage.getItem("game-2048-persisted-v1");
        if (!data) return;
        const blob = new Blob([data], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "game-2048-persisted.json";
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }

    const uploadBtn = this.querySelector<HTMLButtonElement>("#upload-data");
    const uploadInput = this.querySelector<HTMLInputElement>("#upload-file");
    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener("click", () => uploadInput.click());
      uploadInput.addEventListener("change", () => {
        const file = uploadInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const text = reader.result as string;
            const result = await importGraph(text);
            if (result.success && result.games.length > 0) {
              await this.refreshResumeGames();
              const first = result.games[0];
              this.config = { ...first.game.config };
              this.lastMove = null;
              this.setStateAndRender(first);
            }
          } catch (e) {
            console.error("import failed:", e);
          }
          uploadInput.value = "";
        };
        reader.readAsText(file);
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
    el.activeGameId = this.visualizationActiveGameId ?? undefined;
  }
}
