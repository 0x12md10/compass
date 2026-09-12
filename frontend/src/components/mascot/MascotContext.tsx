"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface MascotState {
  isOpen: boolean;
  context: string | null;
  tileName: string | null;
}

interface MascotContextValue extends MascotState {
  /** Opens the mascot anchored to a specific tile (FR-M1's "Ask AI about
   * this" entry point) — context is a plain human-readable string, not
   * structured data, matching the backend's AskRequest.context contract. */
  openMascot: (tileName: string, context: string) => void;
  /** Opens the mascot with no tile anchor (the standalone floating avatar). */
  openMascotBare: () => void;
  closeMascot: () => void;
}

const MascotCtx = createContext<MascotContextValue | null>(null);

export function MascotProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MascotState>({ isOpen: false, context: null, tileName: null });

  return (
    <MascotCtx.Provider
      value={{
        ...state,
        openMascot: (tileName, context) => setState({ isOpen: true, context, tileName }),
        openMascotBare: () => setState({ isOpen: true, context: null, tileName: null }),
        closeMascot: () => setState((s) => ({ ...s, isOpen: false })),
      }}
    >
      {children}
    </MascotCtx.Provider>
  );
}

export function useMascot() {
  const ctx = useContext(MascotCtx);
  if (!ctx) throw new Error("useMascot must be used within a MascotProvider");
  return ctx;
}
