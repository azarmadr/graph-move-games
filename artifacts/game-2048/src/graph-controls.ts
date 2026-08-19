type NavMarker = { id: string; label: string };

export class GraphControlsElement extends HTMLElement {
  private _hopDistance: number = 1;
  private _maxHopDistance: number = 10;
  private _markers: NavMarker[] = [];
  private _zoom: number = 1;

  get hopDistance(): number {
    return this._hopDistance;
  }

  set hopDistance(value: number) {
    this._hopDistance = Math.max(1, Math.min(value, this._maxHopDistance));
    this.render();
  }

  set markers(value: NavMarker[]) {
    this._markers = value;
    this.render();
  }

  set zoom(value: number) {
    this._zoom = value;
    this.render();
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    this.innerHTML = `
      <div class="graph-controls-panel">
        <div class="graph-controls-section">
          <span class="graph-controls-label">Navigate:</span>
          <div class="graph-controls-nav-buttons">
            ${this.createNavButtons()}
          </div>
        </div>
        <div class="graph-controls-section">
          <span class="graph-controls-label">Zoom:</span>
          <div class="graph-controls-zoom-buttons">
            <button type="button" class="graph-controls-zoom-button" data-zoom="out" aria-label="Zoom out">−</button>
            <span class="graph-controls-zoom-level">${Math.round(this._zoom * 100)}%</span>
            <button type="button" class="graph-controls-zoom-button" data-zoom="in" aria-label="Zoom in">+</button>
          </div>
        </div>
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

  private createNavButtons(): string {
    if (this._markers.length === 0) {
      return '<span class="graph-controls-empty">No markers</span>';
    }
    return this._markers
      .map(
        (m) => `
        <button type="button" class="graph-controls-nav-button" data-nav-target="${m.id}">
          ${m.label}
        </button>`,
      )
      .join("");
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
      ".graph-controls-nav-button",
    )) {
      btn.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("navigate-node", {
            detail: { nodeId: btn.dataset.navTarget },
            bubbles: true,
            composed: true,
          }),
        );
      });
    }

    for (const btn of this.querySelectorAll<HTMLButtonElement>(
      ".graph-controls-zoom-button",
    )) {
      btn.addEventListener("click", () => {
        const direction = btn.dataset.zoom;
        this.dispatchEvent(
          new CustomEvent("zoom-change", {
            detail: { direction },
            bubbles: true,
            composed: true,
          }),
        );
      });
    }

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
