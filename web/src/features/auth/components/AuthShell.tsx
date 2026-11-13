import type { ReactNode } from 'react';
import googleIcon from '@/assets/icons/google.svg';

export const CTA_CLASS =
    'flex h-[52px] w-full cursor-pointer items-center justify-center rounded-medium border-[2.5px] border-solid border-on-primary bg-primary px-size-3 text-label-extra-large font-bold leading-normal text-on-primary shadow-[0_4px_0_var(--color-on-primary)] transition-colors duration-fast ease-fast hover:bg-primary-high focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring disabled:cursor-wait disabled:opacity-70';

export const LINK_CLASS =
    'cursor-pointer rounded-small text-label-large font-bold text-on-primary underline [text-underline-position:from-font] focus-visible:outline-2 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-60';

export function AuthHeading({
    title,
    subtitle,
    id,
}: {
    title: string;
    subtitle: string;
    id: string;
}) {
    return (
        <div className="flex flex-col gap-size-1">
            <h2 className="text-display-small font-bold leading-normal text-on-primary" id={id}>
                {title}
            </h2>
            <p className="text-body-small font-normal leading-normal text-on-bg">{subtitle}</p>
        </div>
    );
}

export function FormError({ message }: { message: string | null }) {
    return message ? (
        <p
            className="rounded-small border border-solid border-error bg-white px-size-2 py-size-1 text-label-large font-medium text-error"
            role="alert"
        >
            {message}
        </p>
    ) : null;
}

export function OrDivider() {
    return (
        <div className="flex items-center gap-size-2">
            <span className="h-px flex-1 bg-outline-variant" />
            <span className="text-label-medium font-bold uppercase text-on-bg">or</span>
            <span className="h-px flex-1 bg-outline-variant" />
        </div>
    );
}

export function GoogleButton({ children }: { children: ReactNode }) {
    return (
        <a
            className="flex h-[50px] w-full cursor-pointer items-center justify-center gap-size-2 rounded-medium border-2 border-solid border-on-primary bg-white px-size-3 text-label-extra-large font-bold leading-normal text-on-primary transition-colors duration-fast ease-fast hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring"
            href="/api/auth/google/login"
        >
            <img alt="" height="24" src={googleIcon} width="24" />
            {children}
        </a>
    );
}
