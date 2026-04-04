"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.ReactElement {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-destructive size-5" />
            Something went wrong
          </CardTitle>
        </CardHeader>
        <CardContent>
          {process.env.NODE_ENV === "development" ? (
            <p className="text-muted-foreground text-sm">{error.message}</p>
          ) : (
            <p className="text-muted-foreground text-sm">
              An unexpected error occurred. Please try again.
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button onClick={reset}>Try again</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
