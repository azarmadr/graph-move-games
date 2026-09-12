import { emitEvent } from "../utils/events";
import { COLORS } from "../utils/theme";
import type { LayoutMode } from "../utils/layoutMode";
import { LAYOUT_MODES } from "../utils/layoutMode";

type NavMarker = { id: string; label: string };

const LAYOUT_LABELS: Record<LayoutMode, string> = {
  dagre: "Dagre",
  "fg-dag": "Force Dag",
  visgraph: "Visgraph",
};

const sheet = new CSSStyleSheet();
sheet.replaceSync(/* css */ `
  :host {
    display: block;
    position: absolute;
    top: 12px;
    right: 12px;
    z-index: 10;
  }

  .toggle-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: 1px solid rgba(249, 246, 242, 0.25);
    border-radius: 8px;
    background: rgba(42, 42, 69, 0.92);
    color: #f9f6f2;
    font-size: 16px;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .toggle-btn:hover {
    background: rgba(42, 42, 69, 1);
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

  .panel.hidden {
    display: none;
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

  .layout-selector {
    display: flex;
    gap: 2px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 6px;
    padding: 2px;
  }

  .layout-option {
    flex: 1;
    padding: 4px 6px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: rgba(249, 246, 242, 0.6);
    font: inherit;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
    white-space: nowrap;
  }

  .layout-option:hover {
    color: #f9f6f2;
  }

  .layout-option.active {
    background: var(--accent-cyan, #4cc9f0);
    color: #2a2a45;
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

  @media (max-width: 600px) {
    .panel {
      min-width: 140px;
      padding: 8px;
      font-size: 11px;
    }
    .layout-option {
      font-size: 10px;
      padding: 3px 4px;
    }
    .nav-button, .hop-button {
      font-size: 10px;
      padding: 3px 6px;
    }
  }
`);

export class GraphControlsElement extends HTMLElement {
  private _markers: NavMarker[] = [];
  private _zoom: number = 1;
  private _physicsEnabled: boolean = false;
  private _collapsed: boolean = false;
  private _layoutMode: LayoutMode = "dagre";

  constructor() {
    super();
    const saved = localStorage.getItem("graph-layout-mode");
    if (saved && LAYOUT_MODES.includes(saved as LayoutMode)) {
      this._layoutMode = saved as LayoutMode;
    }
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

  set layoutMode(value: LayoutMode) {
    this._layoutMode = value;
    localStorage.setItem("graph-layout-mode", value);
    this.render();
  }

  get layoutMode(): LayoutMode {
    return this._layoutMode;
  }

  connectedCallback() {
    this.attachShadow({ mode: "open" });
    this.shadowRoot!.adoptedStyleSheets = [sheet];
    this.render();
  }

  private toggleCollapse() {
    this._collapsed = !this._collapsed;
    this.render();
  }

  private render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = /* html */ `
      <button type="button" class="toggle-btn" data-toggle-collapse aria-label="Toggle controls">
        ${this._collapsed ? "☰" : "✕"}
      </button>
      <div class="panel ${this._collapsed ? "hidden" : ""}">
        <div class="section">
          <span class="label">Layout:</span>
          <div class="layout-selector">
            ${this.createLayoutOptions()}
          </div>
        </div>
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

  private createLayoutOptions(): string {
    return LAYOUT_MODES.map(
      (mode) => /* html */ `
        <button
          type="button"
          class="layout-option ${mode === this._layoutMode ? "active" : ""}"
          data-layout-mode="${mode}"
        >
          ${LAYOUT_LABELS[mode]}
        </button>
      `,
    ).join("");
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

  private bindEvents() {
    const toggleBtn = this.shadowRoot!.querySelector<HTMLButtonElement>(
      "[data-toggle-collapse]",
    );
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => this.toggleCollapse());
    }

    for (const btn of this.shadowRoot!.querySelectorAll<HTMLButtonElement>(
      "[data-layout-mode]",
    )) {
      btn.addEventListener("click", () => {
        const mode = btn.dataset.layoutMode as LayoutMode;
        emitEvent(this, "layout-change", { mode });
      });
    }

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
