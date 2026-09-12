"use client";

import { CompassMascot3D } from "./CompassMascot3D";
import { useMascot } from "./MascotContext";

/** Persistent floating avatar — always reachable, not just via a tile's
 * "Ask AI about this" link, per v2/SCOPE.md's "one click away" framing. */
export function MascotToggleButton() {
  const { isOpen, openMascotBare, closeMascot } = useMascot();

  return (
    <button
      onClick={() => (isOpen ? closeMascot() : openMascotBare())}
      aria-label={isOpen ? "Close Compass" : "Ask Compass"}
      className="fixed bottom-4 right-4 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface)] shadow-lg ring-1 ring-[var(--border)] transition-transform hover:scale-105"
    >
      {isOpen ? (
        <span className="text-xl text-[var(--text-muted)]">×</span>
      ) : (
        <CompassMascot3D state="idle" size={56} />
      )}
    </button>
  );
}
