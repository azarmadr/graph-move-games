import type { GameState } from "../utils/wasmBridge";
import type { MoveResult } from "../utils/types";

export class ScoreDisplayElement extends HTMLElement {
  private _state: GameState | null = null;
  private _lastMove: MoveResult | null = null;

  set state(value: GameState | null) {
    this._state = value;
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
    this.render();
  }

  private render() {
    const score = this._state?.game.score ?? 0;
    const isGameOver = this._state?.game.is_terminated ?? false;

    this.innerHTML = `
      <div class="score-display">
        <span class="score-value">SCORE: ${score}</span>
        ${
          this._lastMove
            ? `<span class="score-move-status ${
                this._lastMove.moved ? "valid" : "invalid"
              }">
                ${
                  this._lastMove.moved
                    ? `Valid move · +${this._lastMove.scoreGained} score`
                    : "Invalid move — no board change"
                }
              </span>`
            : ""
        }
        ${isGameOver ? `<span class="score-game-over">Game Over</span>` : ""}
      </div>
    `;
  }
}
