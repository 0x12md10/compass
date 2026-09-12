"use client";

import { useMascot } from "./MascotContext";

interface AskAiButtonProps {
  tileName: string;
  context: string;
}

/** FR-M1's "Ask AI about this" entry point — appears on a dashboard tile,
 * opens the mascot panel pre-anchored to that tile's context. */
export function AskAiButton({ tileName, context }: AskAiButtonProps) {
  const { openMascot } = useMascot();

  return (
    <button
      onClick={() => openMascot(tileName, context)}
      className="whitespace-nowrap text-xs font-medium text-[var(--accent-strong)] hover:underline"
    >
      Ask AI about this
    </button>
  );
}
