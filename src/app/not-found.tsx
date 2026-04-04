import Link from "next/link";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound(): React.ReactElement {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Page not found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href="/">Go to Dashboard</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
