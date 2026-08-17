import type { GameState, Direction } from "./wasmBridge";

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

export class GameBoardElement extends HTMLElement {
  private _state: GameState | null = null;
  private _isGameOver: boolean = false;
  private _lastMove: { moved: boolean; scoreGained: number } | null = null;
  private touchStart: { x: number; y: number } | null = null;

  set state(value: GameState | null) {
    this._state = value;
    this._isGameOver = value?.game.is_terminated ?? false;
    this.render();
  }

  get state(): GameState | null {
    return this._state;
  }

  set lastMove(value: { moved: boolean; scoreGained: number } | null) {
    this._lastMove = value;
    this.render();
  }

  get lastMove(): { moved: boolean; scoreGained: number } | null {
    return this._lastMove;
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    this.innerHTML = `
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
            SCORE: ${this._state?.game.score ?? 0}
          </span>
        </div>
        <div style="position:relative;">
          <canvas
            width="360"
            height="360"
            style="border-radius:8px;display:block;touch-action:none;"
          ></canvas>
          ${
            this._isGameOver
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
              ${this._isGameOver ? "disabled" : ""}
              style="width:44px;height:44px;border-radius:6px;border:none;background:#bbada0;color:#f9f6f2;font-size:18px;font-weight:700;cursor:${
                this._isGameOver ? "not-allowed" : "pointer"
              };opacity:${this._isGameOver ? 0.5 : 1};"
            >
              ${label}
            </button>
          `,
            )
            .join("")}
        </div>
        ${
          this._lastMove
            ? `
          <div
            style="margin-top:8px;padding:4px 10px;border-radius:4px;background:${
              this._lastMove.moved ? "#8f7a66" : "#f65e3b"
            };color:#f9f6f2;font-size:12px;font-weight:600;"
          >
            ${
              this._lastMove.moved
                ? `Valid move · +${this._lastMove.scoreGained} score`
                : "Invalid move — no board change"
            }
          </div>
        `
            : ""
        }
      </div>
    `;

    this.bindEvents();

    const canvas = this.querySelector<HTMLCanvasElement>("canvas");
    if (canvas && this._state) {
      drawBoard(canvas, this._state);
    }
  }

  private bindEvents() {
    for (const btn of this.querySelectorAll<HTMLButtonElement>("[data-dir]")) {
      btn.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("move", {
            detail: { direction: btn.dataset.dir as Direction },
            bubbles: true,
            composed: true,
          }),
        );
      });
    }

    for (const btn of this.querySelectorAll<HTMLButtonElement>(
      '[data-action="new-game"]',
    )) {
      btn.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("new-game", {
            bubbles: true,
            composed: true,
          }),
        );
      });
    }

    const canvas = this.querySelector<HTMLCanvasElement>("canvas");
    if (canvas) {
      canvas.addEventListener("touchstart", this.onTouchStart);
      canvas.addEventListener("touchmove", this.onTouchMove);
      canvas.addEventListener("touchend", this.onTouchEnd);
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

    let direction: Direction;
    if (absDx > absDy) {
      direction = dx > 0 ? "Right" : "Left";
    } else {
      direction = dy > 0 ? "Down" : "Up";
    }

    this.dispatchEvent(
      new CustomEvent("move", {
        detail: { direction },
        bubbles: true,
        composed: true,
      }),
    );
    this.touchStart = null;
  };
}
