"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ACTIONS, EVENTS, STATUS } from "react-joyride";
import type { EventData } from "react-joyride";
import { useTutorial } from "./tutorial-provider";
import { TUTORIAL_STEPS } from "./tutorial-steps";

// react-joyride must be loaded client-side only
const Joyride = dynamic(() => import("react-joyride").then((mod) => mod.Joyride), { ssr: false });

const DIALOG_SELECTOR = '[data-tutorial="transaction-dialog"]';
const ADD_BTN_SELECTOR = '[data-tutorial="add-transaction-btn"]';

/** Wait for an element to appear in the DOM. */
function waitForElement(selector: string, timeout = 2000): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(selector)) {
      resolve();
      return;
    }
    const observer = new MutationObserver(() => {
      if (document.querySelector(selector)) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeout);
  });
}

/** Wait for an element to disappear from the DOM. */
function waitForElementGone(selector: string, timeout = 1000): Promise<void> {
  return new Promise((resolve) => {
    if (!document.querySelector(selector)) {
      resolve();
      return;
    }
    const observer = new MutationObserver(() => {
      if (!document.querySelector(selector)) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeout);
  });
}

/** Ensure the transaction dialog is open. */
function ensureDialogOpen(): Promise<void> {
  if (document.querySelector(DIALOG_SELECTOR)) return Promise.resolve();
  document.querySelector<HTMLButtonElement>(ADD_BTN_SELECTOR)?.click();
  return waitForElement(DIALOG_SELECTOR);
}

/** Ensure the transaction dialog is closed. */
function ensureDialogClosed(): Promise<void> {
  if (!document.querySelector(DIALOG_SELECTOR)) return Promise.resolve();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  return waitForElementGone(DIALOG_SELECTOR);
}

function McpHintContent(): React.ReactElement {
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:4000";
  return (
    <div className="space-y-3 text-left">
      <p className="text-base font-semibold">Connect your AI assistant</p>
      <p className="text-sm">
        You can also manage your finances by talking to your AI assistant. Send a receipt photo, say
        &quot;spent $25 at Lidl on groceries&quot;, or ask for spending analysis.
      </p>
      <p className="text-sm">To enable this, tell your AI agent:</p>
      <code className="bg-muted block rounded px-3 py-2 text-sm select-all">
        Connect to Pinch via MCP at {origin}/api/mcp
      </code>
    </div>
  );
}

export function TutorialOverlay(): React.ReactElement | null {
  const { isActive, stepIndex, setStepIndex, dismiss } = useTutorial();
  const pathname = usePathname();
  const router = useRouter();

  // Track the target step index during cross-page navigation.
  const pendingStepRef = useRef<number | null>(null);

  // Enrich steps with before hooks for dialog management and dynamic content.
  // Each step's `before` hook ensures the right UI state (dialog open/closed)
  // so forward, back, and sidebar navigation all work correctly.
  const steps = useMemo(() => {
    return TUTORIAL_STEPS.map((step, i) => {
      const enriched = { ...step };

      if (step.data?.isMcpHint) {
        enriched.content = <McpHintContent />;
      }

      if (step.data?.insideDialog) {
        // Dialog must be open for this step's target to exist
        enriched.before = () => ensureDialogOpen();
      } else if (step.data?.opensDialog) {
        // Going back to "click this button" — dialog should be closed
        enriched.before = () => ensureDialogClosed();
      } else if (i > 0 && TUTORIAL_STEPS[i - 1]?.data?.insideDialog) {
        // First step after dialog section — close dialog if still open
        enriched.before = () => ensureDialogClosed();
      }

      return enriched;
    });
  }, []);

  // Advance to a step, navigating if needed.
  const goToStep = useCallback(
    (targetIndex: number): void => {
      const targetStep = TUTORIAL_STEPS[targetIndex];
      if (!targetStep) return;

      if (targetStep.page === pathname) {
        setStepIndex(targetIndex);
      } else {
        pendingStepRef.current = targetIndex;
        router.push(targetStep.page);
      }
    },
    [pathname, router, setStepIndex]
  );

  const handleEvent = useCallback(
    (data: EventData): void => {
      const { action, index, status, type } = data;

      if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
        dismiss();
        router.push("/");
        return;
      }

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const goingBack = action === ACTIONS.PREV;
        const nextIndex = index + (goingBack ? -1 : 1);
        const nextStep = TUTORIAL_STEPS[nextIndex];

        // Last step completed — finish the tour
        if (!goingBack && !nextStep) {
          dismiss();
          router.push("/");
          return;
        }

        if (nextStep) {
          goToStep(nextIndex);
        }
      }
    },
    [dismiss, goToStep, router]
  );

  // When the page changes, apply any pending step index.
  // Also handles the case where the user clicks a sidebar link directly.
  useEffect(() => {
    if (!isActive) return;

    if (pendingStepRef.current !== null) {
      const pending = pendingStepRef.current;
      pendingStepRef.current = null;
      setStepIndex(pending);
      return;
    }

    // User navigated on their own (e.g. clicked sidebar link).
    const currentStep = TUTORIAL_STEPS[stepIndex];
    if (currentStep && currentStep.page !== pathname) {
      // Look forward first (most common: user clicked the nav link we suggested)
      const forwardIndex = TUTORIAL_STEPS.findIndex((s, i) => i > stepIndex && s.page === pathname);
      if (forwardIndex !== -1) {
        setStepIndex(forwardIndex);
        return;
      }

      // Look backward (user navigated back via browser or sidebar)
      for (let i = stepIndex - 1; i >= 0; i--) {
        if (TUTORIAL_STEPS[i].page === pathname) {
          setStepIndex(i);
          return;
        }
      }
    }
  }, [isActive, pathname, stepIndex, setStepIndex]);

  if (!isActive) return null;

  return (
    <Joyride
      onEvent={handleEvent}
      continuous
      run={isActive}
      stepIndex={stepIndex}
      steps={steps}
      scrollToFirstStep
      options={{
        overlayClickAction: false,
        buttons: ["back", "primary", "skip"],
        showProgress: true,
        scrollOffset: 100,
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip tour",
      }}
      styles={{
        tooltip: {
          borderRadius: 8,
          fontSize: 14,
          padding: "16px 20px",
        },
        buttonPrimary: {
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 500,
          padding: "6px 16px",
        },
        buttonBack: {
          fontSize: 13,
          fontWeight: 500,
        },
        buttonSkip: {
          fontSize: 13,
        },
      }}
    />
  );
}
