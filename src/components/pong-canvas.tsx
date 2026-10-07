"use client";

import { useEffect, useRef } from "react";
import {
  PONG_BALL_RADIUS,
  PONG_HEIGHT,
  PONG_PADDLE_HEIGHT,
  PONG_PADDLE_MARGIN,
  PONG_PADDLE_WIDTH,
  PONG_WIDTH,
  type PongPhysicsState,
  type PongSeat,
} from "@/lib/pong-rules";

export function PongCanvas({ frame, viewerSeat }: { frame: PongPhysicsState; viewerSeat: PongSeat }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      const width = Math.max(1, Math.round(rect.width * ratio));
      const height = Math.max(1, Math.round(rect.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(width / PONG_WIDTH, 0, 0, height / PONG_HEIGHT, 0, 0);
      context.fillStyle = "#020203";
      context.fillRect(0, 0, PONG_WIDTH, PONG_HEIGHT);
      context.strokeStyle = "rgba(255,255,255,.14)";
      context.setLineDash([10, 13]);
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, PONG_HEIGHT / 2);
      context.lineTo(PONG_WIDTH, PONG_HEIGHT / 2);
      context.stroke();
      context.setLineDash([]);

      const viewerIsOwner = viewerSeat === "OWNER";
      const bottomX = viewerIsOwner ? frame.ownerX : frame.guestX;
      const topX = viewerIsOwner ? frame.guestX : frame.ownerX;
      const ballY = viewerIsOwner ? frame.ball.y : PONG_HEIGHT - frame.ball.y;
      const glow = context.createRadialGradient(frame.ball.x, ballY, 1, frame.ball.x, ballY, 28);
      glow.addColorStop(0, "rgba(103,232,249,.55)");
      glow.addColorStop(1, "rgba(103,232,249,0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(frame.ball.x, ballY, 28, 0, Math.PI * 2);
      context.fill();

      context.shadowBlur = 18;
      context.shadowColor = "#67e8f9";
      context.fillStyle = "#e6fbff";
      context.fillRect(bottomX, PONG_HEIGHT - PONG_PADDLE_MARGIN - PONG_PADDLE_HEIGHT, PONG_PADDLE_WIDTH, PONG_PADDLE_HEIGHT);
      context.shadowColor = "#f472b6";
      context.fillStyle = "#f9a8d4";
      context.fillRect(topX, PONG_PADDLE_MARGIN, PONG_PADDLE_WIDTH, PONG_PADDLE_HEIGHT);
      context.shadowColor = "#67e8f9";
      context.fillStyle = "#ffffff";
      context.beginPath();
      context.arc(frame.ball.x, ballY, PONG_BALL_RADIUS, 0, Math.PI * 2);
      context.fill();
      context.shadowBlur = 0;
    };
    draw();
  }, [frame, viewerSeat]);

  return <canvas ref={canvasRef} width={PONG_WIDTH} height={PONG_HEIGHT} className="aspect-video w-full rounded-2xl border border-white/10 bg-black shadow-2xl shadow-cyan-950/30" aria-label="Mesa de Pong. Sua raquete está embaixo e a raquete adversária está no topo." />;
}
