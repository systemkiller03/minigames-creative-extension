import { Button } from './Button';

type ErrorStateProps = {
    message: string;
    onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
    return (
        <div className="flex flex-col items-center gap-size-2 py-size-4 text-center" role="alert">
            <p>{message}</p>
            {onRetry ? (
                <Button variant="outline" onClick={onRetry}>
                    Try again
                </Button>
            ) : null}
        </div>
    );
}
