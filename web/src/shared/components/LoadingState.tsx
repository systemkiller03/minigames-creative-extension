type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center gap-size-2 py-size-4" role="status">
      <span
        aria-hidden="true"
        className="size-icon-small animate-spin rounded-full border-button-thin border-current border-r-transparent"
      />
      <span>{label}</span>
    </div>
  );
}
