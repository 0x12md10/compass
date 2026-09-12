interface CompassLogoProps {
  size?: number;
}

/** The abstract logomark (nav/favicon-scale), distinct on purpose from the
 * illustrated Compass mascot (CompassAvatar) — one is chrome, the other is
 * a character. A ring + needle, the simplest legible "compass" glyph. */
export function CompassLogo({ size = 30 }: CompassLogoProps) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-lg bg-[var(--accent-strong)]"
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none">
        <circle cx="12" cy="12" r="9.5" stroke="white" strokeWidth="1.6" />
        <polygon points="12,5.5 14.6,12 12,18.5 9.4,12" fill="white" />
      </svg>
    </span>
  );
}
