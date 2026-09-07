import "./index.css";
import { GameAppElement } from "./components/GameApp";
import { GraphTabElement } from "./components/GraphTab";
import { GraphControlsElement } from "./components/GraphControls";
import { GameBoardElement } from "./components/GameBoard";
import { ScoreDisplayElement } from "./components/ScoreDisplay";

function showError(error: unknown) {
  const target = document.querySelector("game-app") ?? document.body;
  const message = error instanceof Error ? error.toString() : String(error);
  const stack =
    error instanceof Error && error.stack ? `\n\n${error.stack}` : "";
  target.innerHTML = `
    <div style="padding:24px;font-family:monospace;color:#d32f2f;">
      <h2>App crashed</h2>
      <pre style="white-space:pre-wrap;word-break:break-word;">${message}${stack}</pre>
    </div>
  `;
}

window.addEventListener("error", (event) => {
  console.error("App crashed:", event.error ?? event.message);
  showError(event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("App crashed:", event.reason);
  showError(event.reason);
});

customElements.define("game-app", GameAppElement);
customElements.define("graph-tab", GraphTabElement);
customElements.define("graph-controls", GraphControlsElement);
customElements.define("game-board", GameBoardElement);
customElements.define("score-display", ScoreDisplayElement);
