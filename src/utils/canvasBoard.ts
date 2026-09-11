import type { Board } from "./wasmBridge";
import { TILE_COLORS, FALLBACK_TILE_COLOR, COLORS } from "./theme";
import { buildGrid } from "./types";

export interface DrawBoardOptions {
  x?: number;
  y?: number;
  cellSize: number;
  gap: number;
  padding?: number;
  cornerRadius?: number;
  showLabels?: boolean;
  fontSize?: number;
}

export function drawBoardBackground(
  ctx: CanvasRenderingContext2D,
  board: Board,
  opts: DrawBoardOptions,
): void {
  const [rows, cols] = board.dim;
  const padding = opts.padding ?? 0;
  const w = padding * 2 + cols * opts.cellSize + (cols - 1) * opts.gap;
  const h = padding * 2 + rows * opts.cellSize + (rows - 1) * opts.gap;
  const r = opts.cornerRadius ?? 0;

  ctx.fillStyle = COLORS.boardBg;
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, r);
  ctx.fill();
}

export function drawBoard(
  ctx: CanvasRenderingContext2D,
  board: Board,
  opts: DrawBoardOptions,
): void {
  const [rows, cols] = board.dim;
  const grid = buildGrid(board);
  const x = opts.x ?? 0;
  const y = opts.y ?? 0;
  const radius = opts.cornerRadius ?? 3;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const value = grid[r][c];
      const colors = TILE_COLORS[value] ?? FALLBACK_TILE_COLOR;
      const cx = x + c * (opts.cellSize + opts.gap);
      const cy = y + r * (opts.cellSize + opts.gap);

      ctx.fillStyle = colors.bg;
      ctx.beginPath();
      ctx.roundRect(cx, cy, opts.cellSize, opts.cellSize, radius);
      ctx.fill();

      if (value > 0) {
        ctx.fillStyle = colors.fg;
        const fontSize =
          opts.fontSize ??
          (value >= 1024 ? 20 : value >= 128 ? 24 : 28);
        ctx.font = `bold ${fontSize}px "Clear Sans", Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          String(value),
          cx + opts.cellSize / 2,
          cy + opts.cellSize / 2,
        );
      }
    }
  }
}

export function drawSelectionHighlight(
  ctx: CanvasRenderingContext2D,
  isSelected: boolean,
  isCurrent: boolean,
  isSource: boolean,
): void {
  if (!isSelected && !isCurrent && !isSource) return;
  ctx.strokeStyle = isSelected
    ? COLORS.selected
    : isCurrent
      ? COLORS.current
      : COLORS.selected;
  ctx.lineWidth = isSelected ? 2.5 : isCurrent ? 2 : 1.5;
  ctx.stroke();
}
