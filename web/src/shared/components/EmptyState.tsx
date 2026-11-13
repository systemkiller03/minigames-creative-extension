type EmptyStateProps = {
  message: string;
};

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <p className="py-size-4 text-center" role="status">
      {message}
    </p>
  );
}
