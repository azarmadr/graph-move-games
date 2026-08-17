export class GraphControlsElement extends HTMLElement {
  private _hopDistance: number = 1;
  private _maxHopDistance: number = 10;

  get hopDistance(): number {
    return this._hopDistance;
  }

  set hopDistance(value: number) {
    this._hopDistance = Math.max(1, Math.min(value, this._maxHopDistance));
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    this.innerHTML = `
      <div class="graph-controls-panel">
        <div class="graph-controls-section">
          <span class="graph-controls-label">Show hops:</span>
          <div class="graph-controls-hop-buttons">
            ${this.createHopButtons()}
          </div>
        </div>
        <div class="graph-controls-section">
          <span class="graph-controls-label">Legend:</span>
          <div class="graph-controls-legend">
            <div class="graph-controls-legend-item">
              <span class="graph-controls-legend-color" style="background:#4cc9f0;"></span>
              <span>Move</span>
            </div>
            <div class="graph-controls-legend-item">
              <span class="graph-controls-legend-color" style="background:#f72585;"></span>
              <span>Spawn</span>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private createHopButtons(): string {
    const buttons = [];
    for (let i = 1; i <= this._maxHopDistance; i++) {
      const isActive = i === this._hopDistance;
      buttons.push(`
        <button
          type="button"
          class="graph-controls-hop-button ${isActive ? "active" : ""}"
          data-hop="${i}"
        >
          ${i}
        </button>
      `);
    }
    return buttons.join("");
  }

  private bindEvents() {
    for (const btn of this.querySelectorAll<HTMLButtonElement>(
      ".graph-controls-hop-button",
    )) {
      btn.addEventListener("click", () => {
        const hop = parseInt(btn.dataset.hop ?? "1", 10);
        this._hopDistance = hop;
        this.render();
        this.dispatchEvent(
          new CustomEvent("hop-change", {
            detail: { hopDistance: this._hopDistance },
            bubbles: true,
            composed: true,
          }),
        );
      });
    }
  }
}
