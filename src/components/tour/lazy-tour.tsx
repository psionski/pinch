"use client";

import dynamic from "next/dynamic";

const InteractiveTour = dynamic(
  () =>
    import("@/components/tour/interactive-tour").then((mod) => ({
      default: mod.InteractiveTour,
    })),
  { ssr: false }
);

interface LazyTourProps {
  initialTutorial: boolean;
}

export function LazyTour({ initialTutorial }: LazyTourProps): React.ReactElement | null {
  if (!initialTutorial) return null;
  return <InteractiveTour initialTutorial={initialTutorial} />;
}
