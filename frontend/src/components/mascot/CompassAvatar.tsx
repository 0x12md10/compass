import Image from "next/image";

export type CompassState = "idle" | "thinking" | "talking";

interface CompassAvatarProps {
  state: CompassState;
  size?: number;
  rounded?: boolean;
}

const STATE_ANIMATION: Record<CompassState, string> = {
  idle: "animate-compass-float",
  thinking: "animate-compass-tilt",
  talking: "animate-compass-bounce",
};

/** The single generated hero image, animated purely with CSS per state —
 * no separate artwork per state, per the "one hero image + CSS motion"
 * call made during the v3/P3 mascot review. */
export function CompassAvatar({ state, size = 64, rounded = true }: CompassAvatarProps) {
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size, overflow: "hidden", borderRadius: rounded ? "9999px" : undefined }}
    >
      <div className={`absolute inset-0 ${STATE_ANIMATION[state]}`} style={{ transform: "scale(1.55)" }}>
        <Image src="/mascot/compass-idle.png" alt="Compass" fill sizes={`${size}px`} className="object-contain" priority />
      </div>

      {state === "thinking" && (
        <span className="absolute right-0 bottom-0 flex h-[38%] w-[38%] items-center justify-center rounded-full bg-[var(--surface)] shadow-sm">
          <span className="h-[55%] w-[55%] animate-spin rounded-full border-2 border-[var(--color-brand-silver)] border-t-[var(--accent)]" />
        </span>
      )}

      {state === "talking" && (
        <span className="absolute -right-0.5 -top-0.5 flex h-[32%] w-[32%] items-center justify-center rounded-full bg-[var(--accent-strong)] text-white shadow-sm animate-compass-pulse">
          <span className="text-[10px] leading-none">●</span>
        </span>
      )}
    </div>
  );
}
