import { terminal } from "../utils/terminal";
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

const sheet = new CSSStyleSheet();
sheet.replaceSync(/* css */ `
  :host {
    display: block;
    min-height: 100vh;
    background: var(--bg, #faf8ef);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 16px;
    font-family: "Clear Sans", Arial, sans-serif;
  }

  .app-nav {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .app-nav-title {
    color: var(--text-primary, #776e65);
    font-size: 28px;
    font-weight: 800;
    margin-right: 4px;
  }

  .app-nav-select {
    padding: 6px 24px 6px 10px;
    border: 1px solid var(--border, #d8cbbb);
    border-radius: 6px;
    background: var(--surface, #f9f6f2);
    color: var(--text-primary, #776e65);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    appearance: auto;
  }

  .app-nav-download {
    width: 32px;
    height: 32px;
    border: 1px solid var(--border, #d8cbbb);
    border-radius: 6px;
    background: transparent;
    color: var(--text-secondary, #9b8f82);
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 120ms ease;
  }

  .app-nav-download:hover {
    background: var(--surface-hover, #ede0c8);
  }

  .app-tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    border: 1px solid var(--border, #d8cbbb);
    border-radius: 999px;
    background: var(--surface-hover, #ede0c8);
  }

  .app-tab {
    border: 0;
    border-radius: 999px;
    padding: 8px 22px;
    background: transparent;
    color: var(--board-outer, #8f7a66);
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .app-tab.active {
    background: var(--board-outer, #8f7a66);
    color: var(--surface, #f9f6f2);
  }

  .app-tab:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .graph-container {
    position: relative;
  }

  .upload-input {
    display: none;
  }

  .tab-content {
    display: none;
  }

  .tab-content.active {
    display: block;
  }
`);

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
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.render();
    window.addEventListener("keydown", this.onKeyDown);
    loadWasm().then(async () => {
      const saved = localStorage.getItem(GameAppElement.STORAGE_KEY);
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
      const s = await createGameWithConfig(this.config);
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
    terminal.log("openGraphVisualization START");
    const t0 = performance.now();
    this.activeTab = "graph";
    terminal.log("activeTab set, calling render()...");
    this.render();
    terminal.log(`render() done (${(performance.now() - t0).toFixed(1)}ms) — graph-tab in DOM`);

    try {
      terminal.log("awaiting getGraph + exportGraph...");
      const t1 = performance.now();
      const [graph, snapshot] = await Promise.all([getGraph(), exportGraph()]);
      terminal.log(`WASM done (${(performance.now() - t1).toFixed(1)}ms) — nodes=${Object.keys(graph.nodes).length}, edges=${Object.keys(graph.edges).length}`);
      this.visualizationGraph = graph;
      this.visualizationGames = Object.values(snapshot.games);
      this.visualizationActiveGameId = this.state?.game.id ?? null;
      terminal.log("calling linkGraphTab...");
      this.linkGraphTab();
      terminal.log("linkGraphTab done");
    } catch (e) {
      terminal.log("ERROR: " + e);
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

    this.shadowRoot!.innerHTML = /* html */ `
      <nav class="app-nav" aria-label="Application controls">
        <span class="app-nav-title">2048</span>

        ${this.getResumableGames().length > 0 ? /* html */ `
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
          class="upload-input"
        />
      </nav>

      <div class="tab-content ${tab === "play" ? "active" : ""}">
        <game-board></game-board>
      </div>
      <div class="tab-content ${tab === "graph" ? "active" : ""}">
        <div class="graph-container">
          <graph-tab></graph-tab>
        </div>
      </div>
    `;

    this.bindEvents();
    this.linkChildElements();
  }

  private bindEvents() {
    for (const btn of this.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      "[data-tab]",
    )) {
      btn.addEventListener("click", () => {
        if (btn.dataset.tab === "graph") {
          void this.openGraphVisualization();
        } else {
          this.activeTab = "play";
          this.render();
        }
      });
    }

    const sizeSelect =
      this.shadowRoot!.querySelector<HTMLSelectElement>("[data-size]");
    if (sizeSelect) {
      sizeSelect.addEventListener("change", () => {
        const [r, c] = (sizeSelect.value ?? "4x4").split("x").map(Number);
        void this.startNewGame(r, c);
      });
    }

    const resumeSelect =
      this.shadowRoot!.querySelector<HTMLSelectElement>("[data-resume-game]");
    if (resumeSelect) {
      resumeSelect.addEventListener("change", () => {
        void this.handleResumeGame(resumeSelect.value);
      });
    }

    const dlBtn =
      this.shadowRoot!.querySelector<HTMLButtonElement>("#download-data");
    if (dlBtn) {
      dlBtn.addEventListener("click", () => {
        const data = localStorage.getItem(GameAppElement.STORAGE_KEY);
        if (!data) return;
        const blob = new Blob([data], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "game-2048-persisted.json";
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }

    const uploadBtn =
      this.shadowRoot!.querySelector<HTMLButtonElement>("#upload-data");
    const uploadInput =
      this.shadowRoot!.querySelector<HTMLInputElement>("#upload-file");
    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener("click", () => uploadInput.click());
      uploadInput.addEventListener("change", () => {
        const file = uploadInput.files?.[0];
        if (!file) return;
        terminal.log(`File selected: ${file.name} (${file.size} bytes)`);
        const reader = new FileReader();
        reader.onload = async () => {
          const t0 = performance.now();
          try {
            const text = reader.result as string;
            terminal.log(`File read done (${(performance.now() - t0).toFixed(1)}ms, ${text.length} chars)`);
            terminal.log("calling importGraph...");
            const t1 = performance.now();
            const result = await importGraph(text);
            terminal.log(`importGraph done (${(performance.now() - t1).toFixed(1)}ms) — success=${result.success}, games=${result.games.length}`);
            if (result.success && result.games.length > 0) {
              await this.refreshResumeGames();
              const first = result.games[0];
              this.config = { ...first.game.config };
              this.lastMove = null;
              this.setStateAndRender(first);
              terminal.log("setStateAndRender done after import");
            }
          } catch (e) {
            terminal.log("IMPORT ERROR: " + e);
            console.error("import failed:", e);
          }
          uploadInput.value = "";
        };
        reader.readAsText(file);
      });
    }
  }

  private linkChildElements() {
    const board =
      this.shadowRoot!.querySelector<GameBoardElement>("game-board");
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

    this.linkGraphTab();
  }

  private linkGraphTab() {
    const el =
      this.shadowRoot!.querySelector<GraphTabElement>("graph-tab");
    if (!el) return;
    el.graphData = this.visualizationGraph;
    el.games = this.visualizationGames;
    el.activeGameId = this.visualizationActiveGameId ?? undefined;
  }
}
