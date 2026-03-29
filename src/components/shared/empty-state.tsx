interface EmptyStateProps {
  message: string;
  description?: string;
}

export function EmptyState({ message, description }: EmptyStateProps): React.ReactElement {
  return (
    <div className="py-12 text-center">
      <p className="text-muted-foreground text-sm">{message}</p>
      {description && <p className="text-muted-foreground mt-1 text-xs">{description}</p>}
    </div>
  );
}
