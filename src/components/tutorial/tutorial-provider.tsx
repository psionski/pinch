"use client";

import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";

const STORAGE_KEY = "pinch-tutorial-step";

interface TutorialContextValue {
  isActive: boolean;
  stepIndex: number;
  setStepIndex: (index: number) => void;
  dismiss: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorial must be used within TutorialProvider");
  return ctx;
}

function readStep(): number {
  if (typeof window === "undefined") return 0;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? parseInt(stored, 10) : 0;
}

function writeStep(index: number): void {
  localStorage.setItem(STORAGE_KEY, String(index));
}

function clearStep(): void {
  localStorage.removeItem(STORAGE_KEY);
}

interface TutorialProviderProps {
  initialTutorial: boolean;
  children: ReactNode;
}

export function TutorialProvider({
  initialTutorial,
  children,
}: TutorialProviderProps): React.ReactElement {
  const [isActive, setIsActive] = useState(initialTutorial);
  const [stepIndex, setStepIndexState] = useState(readStep);

  const setStepIndex = useCallback((index: number): void => {
    setStepIndexState(index);
    writeStep(index);
  }, []);

  const dismiss = useCallback((): void => {
    setIsActive(false);
    clearStep();
    void fetch("/api/settings/tutorial", { method: "DELETE" });
  }, []);

  return (
    <TutorialContext.Provider value={{ isActive, stepIndex, setStepIndex, dismiss }}>
      {children}
    </TutorialContext.Provider>
  );
}
