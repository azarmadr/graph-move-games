import { useEffect, useRef } from "react";

const TILE_COLORS: Record<number, { bg: string; fg: string }> = {
  0:    { bg: "#cdc1b4", fg: "#cdc1b4" },
  2:    { bg: "#eee4da", fg: "#776e65" },
  4:    { bg: "#ede0c8", fg: "#776e65" },
  8:    { bg: "#f2b179", fg: "#f9f6f2" },
  16:   { bg: "#f59563", fg: "#f9f6f2" },
  32:   { bg: "#f67c5f", fg: "#f9f6f2" },
  64:   { bg: "#f65e3b", fg: "#f9f6f2" },
  128:  { bg: "#edcf72", fg: "#f9f6f2" },
  256:  { bg: "#edcc61", fg: "#f9f6f2" },
  512:  { bg: "#edc850", fg: "#f9f6f2" },
  1024: { bg: "#edc53f", fg: "#f9f6f2" },
  2048: { bg: "#edc22e", fg: "#f9f6f2" },
};

function drawPlaceholderBoard(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const size = canvas.width;
  const padding = 12;
  const gap = 8;
  const cellSize = (size - padding * 2 - gap * 3) / 4;

  ctx.fillStyle = "#bbada0";
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, 8);
  ctx.fill();

  const sampleBoard = [
    [2, 4, 8, 16],
    [0, 0, 2, 32],
    [0, 0, 0, 4],
    [0, 0, 0, 2],
  ];

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const val = sampleBoard[r][c];
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

function drawPlaceholderGraph(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")!;
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = "#1a1a2e";
  ctx.fillRect(0, 0, w, h);

  const nodes = [
    { x: w / 2, y: 60, label: "start", color: "#4cc9f0" },
    { x: w / 2 - 100, y: 160, label: "→ right", color: "#f72585" },
    { x: w / 2 + 80, y: 160, label: "→ up", color: "#7209b7" },
    { x: w / 2 - 100, y: 270, label: "spawn", color: "#3a0ca3" },
    { x: w / 2 + 80, y: 270, label: "spawn", color: "#3a0ca3" },
  ];

  const edges = [
    [0, 1], [0, 2], [1, 3], [2, 4],
  ];

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 1.5;
  for (const [a, b] of edges) {
    ctx.beginPath();
    ctx.moveTo(nodes[a].x, nodes[a].y);
    ctx.lineTo(nodes[b].x, nodes[b].y);
    ctx.stroke();
  }

  for (const n of nodes) {
    ctx.beginPath();
    ctx.arc(n.x, n.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = n.color + "33";
    ctx.fill();
    ctx.strokeStyle = n.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#e0e0e0";
    ctx.font = "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(n.label, n.x, n.y);
  }

  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Graph visualization — Phase 10", w / 2, h - 20);
}

export default function App() {
  const boardRef = useRef<HTMLCanvasElement>(null);
  const graphRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (boardRef.current) drawPlaceholderBoard(boardRef.current);
    if (graphRef.current) drawPlaceholderGraph(graphRef.current);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#faf8ef", display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", fontFamily: "'Clear Sans', Arial, sans-serif" }}>
      <h1 style={{ color: "#776e65", fontSize: 36, fontWeight: 800, margin: "0 0 4px" }}>2048</h1>
      <p style={{ color: "#9b8f82", fontSize: 14, margin: "0 0 24px" }}>
        Rust/WASM · Phase 1 scaffold — placeholder canvas
      </p>

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: 360, alignItems: "center" }}>
            <span style={{ color: "#776e65", fontWeight: 700, fontSize: 15 }}>Board</span>
            <span style={{ background: "#bbada0", color: "#f9f6f2", fontWeight: 700, padding: "4px 14px", borderRadius: 4, fontSize: 14 }}>
              SCORE: 0
            </span>
          </div>
          <canvas
            ref={boardRef}
            width={360}
            height={360}
            style={{ borderRadius: 8, display: "block" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {["↑", "↓", "←", "→"].map((dir) => (
              <button
                key={dir}
                style={{ width: 44, height: 44, borderRadius: 6, border: "none", background: "#bbada0", color: "#f9f6f2", fontSize: 18, fontWeight: 700, cursor: "pointer" }}
              >
                {dir}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: 440, alignItems: "center" }}>
            <span style={{ color: "#776e65", fontWeight: 700, fontSize: 15 }}>DAG — all games</span>
            <span style={{ color: "#9b8f82", fontSize: 12 }}>0 nodes · 0 edges</span>
          </div>
          <canvas
            ref={graphRef}
            width={440}
            height={360}
            style={{ borderRadius: 8, display: "block", border: "2px solid #cdc1b4" }}
          />
        </div>
      </div>

      <div style={{ marginTop: 32, padding: "16px 24px", background: "#ede0c8", borderRadius: 8, maxWidth: 600, width: "100%" }}>
        <h3 style={{ color: "#776e65", margin: "0 0 8px", fontSize: 14, fontWeight: 700 }}>Phase 1 Status</h3>
        <ul style={{ color: "#776e65", fontSize: 13, margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Rust crate: <code>artifacts/game-2048/wasm-game/Cargo.toml</code></li>
          <li>Build: <code>cd wasm-game && wasm-pack build --target web --out-dir ../public/wasm-pkg</code></li>
          <li>Frontend: Vite + React — canvas rendering ready</li>
          <li>Graph canvas: placeholder DAG wireframe</li>
          <li>Phases 2–13: data model, move logic, WASM bridge, rendering</li>
        </ul>
      </div>
    </div>
  );
}
