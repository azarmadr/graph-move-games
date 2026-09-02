import type { Board } from "./wasmBridge";
import { TILE_COLORS, FALLBACK_TILE_COLOR } from "./theme";
import { buildGrid } from "./types";

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  board: Board,
  x: number,
  y: number,
  cellSize: number,
  gap: number,
  options?: { fontSize?: number; radius?: number },
): void {
  const [rows, cols] = board.dim;
  const grid = buildGrid(board);
  const radius = options?.radius ?? 3;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const value = grid[r][c];
      const colors = TILE_COLORS[value] ?? FALLBACK_TILE_COLOR;
      const cx = x + c * (cellSize + gap);
      const cy = y + r * (cellSize + gap);

      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.roundRect(cx, cy, cellSize, cellSize, radius);
      ctx.fill();

      if (value > 0) {
        ctx.fillStyle = colors.fg;
        const fontSize =
          options?.fontSize ?? (value >= 1024 ? 20 : value >= 128 ? 24 : 28);
        ctx.font = `bold ${fontSize}px "Clear Sans", Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(value), cx + cellSize / 2, cy + cellSize / 2);
      }
    }
  }
}

export function drawSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  isSelected: boolean,
  isCurrent: boolean,
  isSource: boolean,
): void {
  if (!isSelected && !isCurrent && !isSource) return;
  ctx.strokeStyle = isSelected ? "#4cc9f0" : isCurrent ? "#f72585" : "#4cc9f0";
  ctx.lineWidth = isSelected ? 2.5 : isCurrent ? 2 : 1.5;
  ctx.stroke();
}
