import type { CSSProperties } from 'react';

type IconProps = {
    name: string;
    className?: string;
    filled?: boolean;
    size?: number;
};

export function Icon({ name, className = '', filled = false, size }: IconProps) {
    const style: CSSProperties = {
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}`,
        ...(size ? { fontSize: `${size}px`, width: `${size}px`, height: `${size}px` } : {}),
    };

    return (
        <span
            aria-hidden="true"
            className={`material-symbols-outlined inline-block shrink-0 select-none leading-none ${className}`}
            style={style}
        >
            {name}
        </span>
    );
}
