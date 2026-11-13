import type { ErrorComponentProps } from '@tanstack/react-router';
import { ErrorState } from '@/shared/components/ErrorState';

export function RouteError({ reset }: ErrorComponentProps) {
  return (
    <div className="px-size-4 py-size-8">
      <ErrorState message="This page could not be loaded." onRetry={reset} />
    </div>
  );
}
