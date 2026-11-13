import type { ReactNode } from 'react';

export const SECTION_BUTTON =
    'inline-flex h-12 cursor-pointer items-center justify-center rounded-medium border-2 border-solid border-on-primary px-size-3 text-label-large font-bold text-on-primary shadow-hard transition-colors duration-fast ease-fast focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring disabled:cursor-wait disabled:opacity-70';

export function Section({
    id,
    title,
    description,
    children,
}: {
    id: string;
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <section
            aria-labelledby={id}
            className="flex flex-col gap-size-3 rounded-large border-[2.5px] border-solid border-on-primary bg-white p-size-3 shadow-[4px_4px_0_var(--color-on-primary)]"
        >
            <div className="flex flex-col gap-size-05">
                <h2
                    className="text-headline-small font-bold leading-normal text-on-primary"
                    id={id}
                >
                    {title}
                </h2>
                {description ? <p className="text-body-small text-on-bg">{description}</p> : null}
            </div>
            {children}
        </section>
    );
}
