"use client";

import { useEffect, useRef } from "react";
import { TrafficCone } from "lucide-react";
import { globalTrackSquare, parsePieces, type LudoColor } from "@/lib/ludo-rules";

export type LudoCanvasPlayer = {
  id: string;
  studentId: string | null;
  name: string;
  color: LudoColor;
  pieces: unknown;
};

type HitArea = { x: number; y: number; radius: number; pieceIndex: number };

const TRACK: Array<[number, number]> = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0],
];

const HOME: Record<LudoColor, Array<[number, number]>> = {
  RED: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  GREEN: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  YELLOW: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  BLUE: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]],
};

const SAFE_TRACK_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const COLOR_HEX: Record<LudoColor, string> = {
  RED: "#ef4444",
  GREEN: "#16a34a",
  YELLOW: "#facc15",
  BLUE: "#1479f8",
};
const COLOR_DARK: Record<LudoColor, string> = {
  RED: "#991b1b",
  GREEN: "#166534",
  YELLOW: "#a16207",
  BLUE: "#0d47a1",
};

const BASE_CENTERS: Record<LudoColor, Array<[number, number]>> = {
  RED: [[1.8, 1.8], [4.2, 1.8], [1.8, 4.2], [4.2, 4.2]],
  GREEN: [[10.8, 1.8], [13.2, 1.8], [10.8, 4.2], [13.2, 4.2]],
  YELLOW: [[10.8, 10.8], [13.2, 10.8], [10.8, 13.2], [13.2, 13.2]],
  BLUE: [[1.8, 10.8], [4.2, 10.8], [1.8, 13.2], [4.2, 13.2]],
};

function roundedRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

function drawStar(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  context.save();
  context.shadowColor = "rgba(250, 204, 21, .8)";
  context.shadowBlur = radius * 0.55;
  context.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + point * Math.PI / 5;
    const distance = point % 2 === 0 ? radius : radius * 0.44;
    const px = x + Math.cos(angle) * distance;
    const py = y + Math.sin(angle) * distance;
    if (point === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
  context.fillStyle = "#fde047";
  context.fill();
  context.shadowBlur = 0;
  context.lineWidth = Math.max(1.5, radius * 0.11);
  context.strokeStyle = "#713f12";
  context.stroke();
  context.restore();
}

function drawFilledPawn(context: CanvasRenderingContext2D, x: number, y: number, radius: number, color: LudoColor, selected: boolean, label: number) {
  context.save();
  if (selected) {
    context.shadowColor = "rgba(255,255,255,.95)";
    context.shadowBlur = radius * 0.9;
    context.beginPath();
    context.arc(x, y, radius * 1.12, 0, Math.PI * 2);
    context.fillStyle = "rgba(255,255,255,.88)";
    context.fill();
  }

  const gradient = context.createLinearGradient(x - radius, y - radius, x + radius, y + radius);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.12, COLOR_HEX[color]);
  gradient.addColorStop(1, COLOR_DARK[color]);

  context.shadowColor = "rgba(2, 6, 23, .5)";
  context.shadowBlur = radius * 0.28;
  context.shadowOffsetY = radius * 0.18;
  roundedRect(context, x - radius * 0.92, y + radius * 0.48, radius * 1.84, radius * 0.48, radius * 0.2);
  context.fillStyle = gradient;
  context.fill();
  context.lineWidth = Math.max(1.25, radius * 0.1);
  context.strokeStyle = "rgba(15,23,42,.88)";
  context.stroke();

  context.beginPath();
  context.moveTo(x - radius * 0.68, y + radius * 0.5);
  context.lineTo(x - radius * 0.23, y - radius * 0.65);
  context.quadraticCurveTo(x, y - radius * 0.92, x + radius * 0.23, y - radius * 0.65);
  context.lineTo(x + radius * 0.68, y + radius * 0.5);
  context.closePath();
  context.fillStyle = gradient;
  context.fill();
  context.stroke();

  context.beginPath();
  context.arc(x, y - radius * 0.7, radius * 0.28, 0, Math.PI * 2);
  context.fillStyle = "#dbeafe";
  context.fill();
  context.stroke();

  context.shadowColor = "transparent";
  context.font = `800 ${Math.max(8, radius * 0.62)}px ui-sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = color === "YELLOW" ? "#422006" : "#ffffff";
  context.fillText(String(label), x, y + radius * 0.7);
  context.restore();
}

function drawCenter(context: CanvasRenderingContext2D, cell: number) {
  const left = 6 * cell;
  const top = 6 * cell;
  const right = 9 * cell;
  const bottom = 9 * cell;
  const center = 7.5 * cell;
  const triangles: Array<{ color: LudoColor; points: Array<[number, number]> }> = [
    { color: "RED", points: [[left, top], [left, bottom], [center, center]] },
    { color: "GREEN", points: [[left, top], [right, top], [center, center]] },
    { color: "YELLOW", points: [[right, top], [right, bottom], [center, center]] },
    { color: "BLUE", points: [[left, bottom], [right, bottom], [center, center]] },
  ];
  for (const triangle of triangles) {
    context.beginPath();
    triangle.points.forEach(([x, y], index) => index ? context.lineTo(x, y) : context.moveTo(x, y));
    context.closePath();
    context.fillStyle = COLOR_HEX[triangle.color];
    context.fill();
  }
  context.beginPath();
  context.arc(center, center, cell * 0.55, 0, Math.PI * 2);
  context.fillStyle = "#0f172a";
  context.fill();
  drawStar(context, center, center, cell * 0.3);
}

function drawBase(context: CanvasRenderingContext2D, color: LudoColor, cell: number) {
  const minX = Math.min(...BASE_CENTERS[color].map(([x]) => x));
  const minY = Math.min(...BASE_CENTERS[color].map(([, y]) => y));
  const left = (minX - 1.15) * cell;
  const top = (minY - 1.15) * cell;
  roundedRect(context, left, top, cell * 4.7, cell * 4.7, cell * 0.42);
  context.fillStyle = "rgba(255,255,255,.96)";
  context.fill();
  context.lineWidth = cell * 0.11;
  context.strokeStyle = "rgba(15,23,42,.2)";
  context.stroke();
  for (const [x, y] of BASE_CENTERS[color]) {
    context.beginPath();
    context.arc(x * cell, y * cell, cell * 0.46, 0, Math.PI * 2);
    context.fillStyle = `${COLOR_HEX[color]}26`;
    context.fill();
    context.lineWidth = cell * 0.07;
    context.strokeStyle = `${COLOR_DARK[color]}66`;
    context.stroke();
  }
}

function quadrantColor(row: number, column: number): LudoColor | null {
  if (row < 6 && column < 6) return "RED";
  if (row < 6 && column > 8) return "GREEN";
  if (row > 8 && column > 8) return "YELLOW";
  if (row > 8 && column < 6) return "BLUE";
  return null;
}

function homeColor(row: number, column: number) {
  return (Object.keys(HOME) as LudoColor[]).find(color => HOME[color].some(([homeRow, homeColumn]) => homeRow === row && homeColumn === column));
}

function pieceCoordinate(color: LudoColor, position: number, pieceIndex: number): [number, number] | null {
  if (position === -1) return BASE_CENTERS[color][pieceIndex] ?? null;
  if (position >= 0 && position <= 51) {
    const square = globalTrackSquare(color, position);
    if (square === null) return null;
    const [row, column] = TRACK[square];
    return [column + 0.5, row + 0.5];
  }
  const home = HOME[color][position - 52];
  return home ? [home[1] + 0.5, home[0] + 0.5] : null;
}

export function LudoCanvasBoard({ players, viewerId, valid, onPiece }: {
  players: LudoCanvasPlayer[];
  viewerId: string;
  valid: number[];
  onPiece: (pieceIndex: number) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitAreasRef = useRef<HitArea[]>([]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const draw = () => {
      const size = Math.max(280, Math.floor(host.getBoundingClientRect().width));
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(size * ratio);
      canvas.height = Math.floor(size * ratio);
      canvas.style.width = `${size}px`;
      canvas.style.height = `${size}px`;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, size, size);
      const cell = size / 15;

      context.fillStyle = "#e2e8f0";
      context.fillRect(0, 0, size, size);
      for (let row = 0; row < 15; row += 1) {
        for (let column = 0; column < 15; column += 1) {
          const trackIndex = TRACK.findIndex(([trackRow, trackColumn]) => trackRow === row && trackColumn === column);
          const laneColor = homeColor(row, column);
          const quadrant = quadrantColor(row, column);
          const center = row >= 6 && row <= 8 && column >= 6 && column <= 8;
          context.fillStyle = center
            ? "#0f172a"
            : laneColor
              ? COLOR_HEX[laneColor]
              : trackIndex >= 0
                ? "#f8fafc"
                : quadrant
                  ? COLOR_HEX[quadrant]
                  : "#cbd5e1";
          context.fillRect(column * cell, row * cell, cell, cell);
          context.strokeStyle = "rgba(15,23,42,.22)";
          context.lineWidth = Math.max(0.65, cell * 0.025);
          context.strokeRect(column * cell, row * cell, cell, cell);
        }
      }

      for (const color of Object.keys(BASE_CENTERS) as LudoColor[]) drawBase(context, color, cell);
      drawCenter(context, cell);
      for (const safeSquare of SAFE_TRACK_SQUARES) {
        const [row, column] = TRACK[safeSquare];
        drawStar(context, (column + 0.5) * cell, (row + 0.5) * cell, cell * 0.31);
      }

      const grouped = new Map<string, number>();
      const hitAreas: HitArea[] = [];
      for (const player of players) {
        const pieces = parsePieces(player.pieces);
        pieces.forEach((position, pieceIndex) => {
          const coordinate = pieceCoordinate(player.color, position, pieceIndex);
          if (!coordinate) return;
          const groupKey = `${coordinate[0]}:${coordinate[1]}`;
          const stack = grouped.get(groupKey) ?? 0;
          grouped.set(groupKey, stack + 1);
          const offsetX = (stack % 2) * cell * 0.22 - (stack > 0 ? cell * 0.11 : 0);
          const offsetY = Math.floor(stack / 2) * cell * 0.22 - (stack > 1 ? cell * 0.11 : 0);
          const x = coordinate[0] * cell + offsetX;
          const y = coordinate[1] * cell + offsetY;
          const selectable = player.studentId === viewerId && valid.includes(pieceIndex);
          drawFilledPawn(context, x, y, cell * (stack ? 0.28 : 0.34), player.color, selectable, pieceIndex + 1);
          if (selectable) hitAreas.push({ x, y, radius: cell * 0.58, pieceIndex });
        });
      }
      hitAreasRef.current = hitAreas;
    };

    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(host);
    return () => observer.disconnect();
  }, [players, valid, viewerId]);

  function pointerPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (bounds.width ? event.currentTarget.clientWidth / bounds.width : 1),
      y: (event.clientY - bounds.top) * (bounds.height ? event.currentTarget.clientHeight / bounds.height : 1),
    };
  }

  function chooseAtPointer(event: React.PointerEvent<HTMLCanvasElement>) {
    const point = pointerPosition(event);
    const target = hitAreasRef.current.find(area => Math.hypot(point.x - area.x, point.y - area.y) <= area.radius);
    if (target) onPiece(target.pieceIndex);
  }

  return (
    <div>
      <div ref={hostRef} className="relative aspect-square w-full overflow-hidden rounded-[1.35rem] border-4 border-slate-950 bg-slate-200 shadow-[0_24px_70px_rgba(2,8,23,.55)] sm:rounded-[2rem] sm:border-[6px]">
        <canvas
          ref={canvasRef}
          className={valid.length ? "block touch-manipulation cursor-pointer" : "block"}
          onPointerUp={chooseAtPointer}
          aria-label="Tabuleiro do Ludo Maker. As estrelas douradas são casas seguras."
          role="img"
        />
      </div>
      {valid.length > 0 && (
        <div className="mt-3 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-3" aria-label="Escolha um robô para movimentar">
          <p className="text-center text-sm font-bold text-cyan-50">Escolha o robô que vai avançar</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {valid.map(pieceIndex => (
              <button key={pieceIndex} onClick={() => onPiece(pieceIndex)} className="focus-ring flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white text-sm font-black text-slate-950 shadow-lg">
                <TrafficCone fill="currentColor" size={19}/> Robô {pieceIndex + 1}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
