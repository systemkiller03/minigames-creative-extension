type SectionHeadingProps = {
  children: string;
  id?: string;
};

export function SectionHeading({ children, id }: SectionHeadingProps) {
  return (
    <h2
      className="flex items-center gap-size-2 text-headline-small font-bold leading-tight text-on-primary tablet-up:text-headline-medium desktop-up:text-headline-large"
      id={id}
    >
      <span
        aria-hidden="true"
        className="h-full min-h-size-3 w-section-heading-marker rounded-[4px] border-[1.5px] border-solid border-on-primary bg-primary"
      />
      {children}
    </h2>
  );
}
