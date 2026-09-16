import { useEffect } from 'react';
import confetti from 'canvas-confetti';

/**
 * Fires once when `go` flips true. Frictionless authentication is the whole
 * point of the demo, so it gets fireworks.
 */
export function Fireworks({ go }: { go: boolean }) {
  useEffect(() => {
    if (!go) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const end = Date.now() + 2200;
    const colors = ['#6366f1', '#22d3ee', '#a78bfa', '#34d399', '#fbbf24'];

    confetti({ particleCount: 160, spread: 90, origin: { y: 0.55 }, colors, zIndex: 60 });

    let frame = 0;
    const tick = () => {
      if (Date.now() > end) return;
      confetti({ particleCount: 5, angle: 60, spread: 62, origin: { x: 0, y: 0.7 }, colors, zIndex: 60 });
      confetti({ particleCount: 5, angle: 120, spread: 62, origin: { x: 1, y: 0.7 }, colors, zIndex: 60 });
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [go]);

  return null;
}
