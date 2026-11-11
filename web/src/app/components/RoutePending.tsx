import { LoadingState } from '@/shared/components/LoadingState';

export function RoutePending() {
    return (
        <div className="px-size-4 py-size-8">
            <LoadingState label="Loading page..." />
        </div>
    );
}
