interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps): React.ReactElement {
  return (
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <div className="[&>svg]:size-12 [&>svg]:stroke-1">{icon}</div>
      <div className="text-center">
        <h2 className="text-foreground text-lg font-medium">{title}</h2>
        <p className="mt-1 text-sm">{description}</p>
      </div>
    </div>
  );
}
