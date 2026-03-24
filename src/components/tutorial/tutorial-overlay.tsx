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
  // When we navigate to a new page, we store the desired step index here
  // so the useEffect can pick it up once the pathname updates.
  const pendingStepRef = useRef<number | null>(null);

  // Build the steps with dynamic MCP content
  const steps = useMemo(() => {
    return TUTORIAL_STEPS.map((step) => {
      if (step.data?.isMcpHint) {
        return { ...step, content: <McpHintContent /> };
      }
      return step;
    });
  }, []);

  // Navigate to target page and set pending step
  const navigateToStep = useCallback(
    (targetIndex: number): void => {
      const targetStep = TUTORIAL_STEPS[targetIndex];
      if (!targetStep) return;

      if (targetStep.page === pathname) {
        // Same page — just update the index
        setStepIndex(targetIndex);
      } else {
        // Different page — store pending index and navigate
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
        return;
      }

      if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
        const goingBack = action === ACTIONS.PREV;
        const nextIndex = index + (goingBack ? -1 : 1);

        // For forward navigation steps with navigateTo, use that destination
        if (!goingBack && TUTORIAL_STEPS[index]?.navigateTo) {
          navigateToStep(nextIndex);
          return;
        }

        navigateToStep(nextIndex);
      }
    },
    [dismiss, navigateToStep]
  );

  // When the page changes, apply any pending step index.
  // Also handles the case where the user clicks a sidebar link directly
  // (no pending step — find the right step for this page).
  useEffect(() => {
    if (!isActive) return;

    if (pendingStepRef.current !== null) {
      // We initiated this navigation — apply the pending step
      const pending = pendingStepRef.current;
      pendingStepRef.current = null;
      setStepIndex(pending);
      return;
    }

    // User navigated on their own (e.g. clicked sidebar link).
    // Find the appropriate step for this page relative to current position.
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
