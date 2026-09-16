const STYLE_ID = "notify-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = /* css */ `
    .notify-container {
      position: fixed;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      pointer-events: none;
    }
    .notify-msg {
      padding: 8px 18px;
      border-radius: 6px;
      background: rgba(42, 42, 69, 0.94);
      color: #f9f6f2;
      font: 600 13px/1.4 system-ui, sans-serif;
      white-space: nowrap;
    }
  `;
  document.head.appendChild(style);
}

function getContainer(): HTMLDivElement {
  let container = document.querySelector<HTMLDivElement>(".notify-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "notify-container";
    document.body.appendChild(container);
  }
  return container;
}

export function notify(message: string, durationMs = 4000) {
  ensureStyle();
  const container = getContainer();

  const el = document.createElement("div");
  el.className = "notify-msg";
  el.textContent = message;
  container.appendChild(el);

  setTimeout(() => el.remove(), durationMs);
}
