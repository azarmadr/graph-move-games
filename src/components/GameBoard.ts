import type { GameState, Direction } from "../utils/wasmBridge";
import type { MoveResult } from "../utils/types";
import { COLORS } from "../utils/theme";
import {
  drawBoard,
  drawBoardBackground,
} from "../utils/canvasBoard";
import { emitEvent } from "../utils/events";

const sheet = new CSSStyleSheet();
sheet.replaceSync(/* css */ `
  :host {
    display: block;
  }

  .board {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    width: 360px;
    align-items: center;
  }

  .title {
    color: var(--text-primary, #776e65);
    font-weight: 700;
    font-size: 15px;
  }

  .score {
    background: var(--board-bg, #bbada0);
    color: var(--surface, #f9f6f2);
    font-weight: 700;
    padding: 4px 14px;
    border-radius: 4px;
    font-size: 14px;
  }

  .canvas-wrap {
    position: relative;
  }

  canvas {
    border-radius: 8px;
    display: block;
    touch-action: none;
  }

  .game-over {
    position: absolute;
    inset: 0;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .game-over-card {
    background: #f65e3b;
    color: var(--surface, #f9f6f2);
    padding: 24px;
    border-radius: 8px;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .game-over-title {
    font-size: 24px;
    font-weight: 800;
    margin-bottom: 8px;
  }

  .game-over-sub {
    font-size: 14px;
    opacity: 0.9;
    margin-bottom: 12px;
  }

  .new-game-btn {
    padding: 8px 16px;
    border-radius: 4px;
    border: none;
    background: var(--surface, #f9f6f2);
    color: #f65e3b;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .arrow-buttons {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .arrow-btn {
    width: 44px;
    height: 44px;
    border-radius: 6px;
    border: none;
    background: var(--board-bg, #bbada0);
    color: var(--surface, #f9f6f2);
    font-size: 18px;
    font-weight: 700;
    cursor: pointer;
  }

  .arrow-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .move-status {
    margin-top: 8px;
    padding: 4px 10px;
    border-radius: 4px;
    color: var(--surface, #f9f6f2);
    font-size: 12px;
    font-weight: 600;
  }

  .move-status.valid {
    background: var(--board-outer, #8f7a66);
  }

  .move-status.invalid {
    background: #f65e3b;
  }

  @media (max-width: 480px) {
    .arrow-buttons {
      display: none !important;
    }
  }
`);

export class GameBoardElement extends HTMLElement {
  private _state: GameState | null = null;
  private _isGameOver: boolean = false;
  private _lastMove: MoveResult | null = null;
  private touchStart: { x: number; y: number } | null = null;

  set state(value: GameState | null) {
    this._state = value;
    this._isGameOver = value?.game.is_terminated ?? false;
    this.render();
  }

  get state(): GameState | null {
    return this._state;
  }

  set lastMove(value: MoveResult | null) {
    this._lastMove = value;
    this.render();
  }

  get lastMove(): MoveResult | null {
    return this._lastMove;
  }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.render();
  }

  private render() {
    const score = this._state?.game.score ?? 0;

    this.shadowRoot!.innerHTML = /* html */ `
      <div class="board">
        <div class="header">
          <span class="title">Board</span>
          <span class="score">SCORE: ${score}</span>
        </div>
        <div class="canvas-wrap">
          <canvas width="360" height="360"></canvas>
          ${this._isGameOver ? /* html */ `
            <div class="game-over">
              <div class="game-over-card">
                <div class="game-over-title">Game Over!</div>
                <div class="game-over-sub">No more valid moves</div>
                <button type="button" data-action="new-game" class="new-game-btn">
                  New Game
                </button>
              </div>
            </div>
          ` : ""}
        </div>
        <div class="arrow-buttons">
          ${([
            ["↑", "Up"],
            ["↓", "Down"],
            ["←", "Left"],
            ["→", "Right"],
          ] as const)
            .map(([label, dir]) => /* html */ `
              <button
                type="button"
                data-dir="${dir}"
                class="arrow-btn"
                ${this._isGameOver ? "disabled" : ""}
              >
                ${label}
              </button>
            `)
            .join("")}
        </div>
        ${this._lastMove ? /* html */ `
          <div class="move-status ${this._lastMove.moved ? "valid" : "invalid"}">
            ${this._lastMove.moved
              ? `Valid move · +${this._lastMove.scoreGained} score`
              : "Invalid move — no board change"}
          </div>
        ` : ""}
      </div>
    `;

    this.bindEvents();

    const canvas = this.shadowRoot!.querySelector<HTMLCanvasElement>("canvas");
    if (canvas && this._state) {
      const ctx = canvas.getContext("2d")!;
      const padding = 12;
      const gap = 8;
      const [rows, cols] = this._state.active_board.dim;
      const maxDim = Math.max(rows, cols);
      const cellSize =
        (canvas.width - padding * 2 - gap * (maxDim - 1)) / maxDim;

      drawBoardBackground(ctx, this._state.active_board, {
        cellSize,
        gap,
        padding,
        cornerRadius: 8,
      });
      drawBoard(ctx, this._state.active_board, {
        x: padding,
        y: padding,
        cellSize,
        gap,
        cornerRadius: 4,
      });
    }
  }

  private bindEvents() {
    for (const btn of this.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      "[data-dir]",
    )) {
      btn.addEventListener("click", () => {
        emitEvent(this, "move", { direction: btn.dataset.dir as Direction });
      });
    }

    for (const btn of this.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      '[data-action="new-game"]',
    )) {
      btn.addEventListener("click", () => {
        emitEvent(this, "new-game");
      });
    }

    const canvas = this.shadowRoot!.querySelector<HTMLCanvasElement>("canvas");
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

    emitEvent(this, "move", { direction });
    this.touchStart = null;
  };
}
