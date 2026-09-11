import { emitEvent } from "../utils/events";
import { COLORS } from "../utils/theme";

type NavMarker = { id: string; label: string };

const sheet = new CSSStyleSheet();
sheet.replaceSync(/* css */ `
  :host {
    display: block;
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
  }

  .panel {
    display: grid;
    gap: 10px;
    padding: 12px;
    border-radius: 10px;
    background: rgba(42, 42, 69, 0.92);
    color: #f9f6f2;
    font-size: 12px;
    min-width: 160px;
  }

  .section {
    display: grid;
    gap: 4px;
  }

  .label {
    font-weight: 700;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(249, 246, 242, 0.6);
  }

  .nav-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .nav-button {
    padding: 4px 10px;
    border: 1px solid rgba(249, 246, 242, 0.25);
    border-radius: 6px;
    background: transparent;
    color: #f9f6f2;
    font: inherit;
    font-size: 12px;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .nav-button:hover {
    background: rgba(249, 246, 242, 0.12);
  }

  .zoom-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .zoom-button {
    width: 28px;
    height: 28px;
    border: 1px solid rgba(249, 246, 242, 0.25);
    border-radius: 6px;
    background: transparent;
    color: #f9f6f2;
    font: inherit;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .zoom-button:hover {
    background: rgba(249, 246, 242, 0.12);
  }

  .zoom-level {
    min-width: 36px;
    text-align: center;
    font-size: 12px;
    font-weight: 600;
    color: var(--accent-cyan, #4cc9f0);
  }

  .hop-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  .hop-button {
    width: 26px;
    height: 26px;
    border: 1px solid rgba(249, 246, 242, 0.25);
    border-radius: 6px;
    background: transparent;
    color: #f9f6f2;
    font: inherit;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .hop-button:hover {
    background: rgba(249, 246, 242, 0.12);
  }

  .hop-button.active {
    background: var(--accent-cyan, #4cc9f0);
    color: #2a2a45;
    border-color: var(--accent-cyan, #4cc9f0);
  }

  .physics-toggle {
    padding: 4px 12px;
    border: 1px solid rgba(249, 246, 242, 0.25);
    border-radius: 6px;
    background: transparent;
    color: #f9f6f2;
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .physics-toggle:hover {
    background: rgba(249, 246, 242, 0.12);
  }

  .physics-toggle.active {
    background: var(--accent-pink, #f72585);
    color: #f9f6f2;
    border-color: var(--accent-pink, #f72585);
  }

  .legend {
    display: grid;
    gap: 3px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .legend-color {
    width: 12px;
    height: 12px;
    border-radius: 3px;
  }

  .empty {
    color: rgba(249, 246, 242, 0.4);
    font-style: italic;
  }
`);

export class GraphControlsElement extends HTMLElement {
  private _hopDistance: number = 1;
  private _maxHopDistance: number = 10;
  private _markers: NavMarker[] = [];
  private _zoom: number = 1;
  private _physicsEnabled: boolean = false;

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

  set physicsEnabled(value: boolean) {
    this._physicsEnabled = value;
    this.render();
  }

  get physicsEnabled(): boolean {
    return this._physicsEnabled;
  }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = /* html */ `
      <div class="panel">
        <div class="section">
          <span class="label">Navigate:</span>
          <div class="nav-buttons">
            ${this.createNavButtons()}
          </div>
        </div>
        <div class="section">
          <span class="label">Zoom:</span>
          <div class="zoom-buttons">
            <button type="button" class="zoom-button" data-zoom="out" aria-label="Zoom out">−</button>
            <span class="zoom-level">${Math.round(this._zoom * 100)}%</span>
            <button type="button" class="zoom-button" data-zoom="in" aria-label="Zoom in">+</button>
          </div>
        </div>
        <div class="section">
          <span class="label">Show hops:</span>
          <div class="hop-buttons">
            ${this.createHopButtons()}
          </div>
        </div>
        <div class="section">
          <span class="label">Physics:</span>
          <button
            type="button"
            class="physics-toggle ${this._physicsEnabled ? "active" : ""}"
            data-physics-toggle
          >
            ${this._physicsEnabled ? "On" : "Off"}
          </button>
        </div>
        <div class="section">
          <span class="label">Legend:</span>
          <div class="legend">
            <div class="legend-item">
              <span class="legend-color" style="background:${COLORS.selected};"></span>
              <span>Move</span>
            </div>
            <div class="legend-item">
              <span class="legend-color" style="background:${COLORS.current};"></span>
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
      return '<span class="empty">No markers</span>';
    }
    return this._markers
      .map(
        (m) => /* html */ `
        <button type="button" class="nav-button" data-nav-target="${m.id}">
          ${m.label}
        </button>`,
      )
      .join("");
  }

  private createHopButtons(): string {
    const buttons = [];
    for (let i = 1; i <= this._maxHopDistance; i++) {
      const isActive = i === this._hopDistance;
      buttons.push(/* html */ `
        <button
          type="button"
          class="hop-button ${isActive ? "active" : ""}"
          data-hop="${i}"
        >
          ${i}
        </button>
      `);
    }
    return buttons.join("");
  }

  private bindEvents() {
    for (const btn of this.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      ".nav-button",
    )) {
      btn.addEventListener("click", () => {
        emitEvent(this, "navigate-node", { nodeId: btn.dataset.navTarget });
      });
    }

    for (const btn of this.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      ".zoom-button",
    )) {
      btn.addEventListener("click", () => {
        const direction = btn.dataset.zoom;
        emitEvent(this, "zoom-change", { direction });
      });
    }

    for (const btn of this.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      ".hop-button",
    )) {
      btn.addEventListener("click", () => {
        const hop = parseInt(btn.dataset.hop ?? "1", 10);
        this._hopDistance = hop;
        this.render();
        emitEvent(this, "hop-change", { hopDistance: this._hopDistance });
      });
    }

    const physicsBtn = this.shadowRoot!.querySelector<HTMLButtonElement>(
      "[data-physics-toggle]",
    );
    if (physicsBtn) {
      physicsBtn.addEventListener("click", () => {
        emitEvent(this, "physics-toggle");
      });
    }
  }
}
