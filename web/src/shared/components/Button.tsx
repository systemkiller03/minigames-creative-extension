import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'outline' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
    primary: 'bg-primary hover:bg-primary-high',
    outline: 'bg-transparent hover:bg-surface',
    inverse: 'border-white text-white bg-transparent hover:border-primary',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
    sm: 'h-button-height-small rounded-small px-button-small-x py-button-small-y text-label-large',
    md: 'h-button-height-medium rounded-small px-button-medium-x py-button-medium-y text-label-large',
    lg: 'h-button-height-large rounded-medium px-button-large-x py-button-large-y text-label-extra-large',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = 'primary', size = 'md', type = 'button', className = '', ...props },
    ref,
) {
    const classes = [
        'inline-flex flex-none items-center justify-center gap-button-gap border-button border-black font-inter font-bold leading-button text-on-primary transition-colors duration-fast ease-fast focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-surface-disabled disabled:text-on-bg-low disabled:shadow-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
    ]
        .filter(Boolean)
        .join(' ');

    return <button {...props} className={classes} ref={ref} type={type} />;
});
