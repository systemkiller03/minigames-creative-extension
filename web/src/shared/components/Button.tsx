import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'outline' | 'inverse';
export type ButtonSize = 'sm' | 'md' | 'lg';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'border-on-primary bg-primary text-on-primary hover:bg-primary-high',
  outline: 'border-on-primary bg-transparent text-on-primary hover:bg-surface',
  inverse: 'border-white bg-transparent text-white hover:border-primary hover:text-primary',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'rounded-small px-button-small-x py-button-small-y text-label-large',
  md: 'rounded-small px-button-medium-x py-button-medium-y text-label-large',
  lg: 'rounded-medium px-button-large-x py-button-large-y text-label-extra-large',
};

export function getButtonClassName(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className = '',
): string {
  return [
    'inline-flex flex-none cursor-pointer items-center justify-center gap-button-gap border-button border-solid font-inter font-bold leading-normal transition-colors duration-fast ease-fast focus-visible:outline-2 focus-visible:outline-offset-focus-ring-offset focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:border-outline-variant disabled:bg-surface-disabled disabled:text-on-bg-low disabled:shadow-none',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', type = 'button', className = '', ...props },
  ref,
) {
  const classes = getButtonClassName(variant, size, className);

  return <button {...props} className={classes} ref={ref} type={type} />;
});
