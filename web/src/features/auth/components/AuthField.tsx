import { useId, useState } from 'react';
import { Icon } from '@/shared/components/Icon';

type AuthFieldProps = {
    label: string;
    icon: string;
    name: string;
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    error?: string | undefined;
    type?: 'text' | 'email' | 'password';
    placeholder?: string;
    autoComplete?: string;
    inputMode?: 'numeric' | 'text' | 'email';
    maxLength?: number;
    autoFocus?: boolean;
};

export function AuthField({
    label,
    icon,
    name,
    value,
    onChange,
    onBlur,
    error,
    type = 'text',
    placeholder,
    autoComplete,
    inputMode,
    maxLength,
    autoFocus,
}: AuthFieldProps) {
    const id = useId();
    const errorId = `${id}-error`;
    const [visible, setVisible] = useState(false);
    const isPassword = type === 'password';

    return (
        <div className="flex flex-col gap-size-1">
            <label
                className="text-label-large font-bold leading-normal text-on-primary"
                htmlFor={id}
            >
                {label}
            </label>
            <div
                className={`flex h-12 items-center gap-size-2 rounded-small border-2 border-solid bg-white px-size-2 text-on-bg focus-within:outline-2 focus-within:outline-offset-focus-ring-offset focus-within:outline-focus-ring ${error ? 'border-error' : 'border-on-primary'}`}
            >
                <Icon className="text-[20px]" name={icon} />
                <input
                    aria-describedby={error ? errorId : undefined}
                    aria-invalid={error ? true : undefined}
                    autoComplete={autoComplete}
                    autoFocus={autoFocus}
                    className="min-w-0 flex-1 bg-transparent text-[14px] font-medium text-on-primary outline-none placeholder:text-text-placeholder"
                    id={id}
                    inputMode={inputMode}
                    maxLength={maxLength}
                    name={name}
                    onBlur={onBlur}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={placeholder}
                    type={isPassword && visible ? 'text' : type}
                    value={value}
                />
                {isPassword ? (
                    <button
                        aria-label={visible ? 'Hide password' : 'Show password'}
                        aria-pressed={visible}
                        className="flex cursor-pointer items-center rounded-small text-on-bg hover:text-on-primary focus-visible:outline-2 focus-visible:outline-focus-ring"
                        onClick={() => setVisible((previous) => !previous)}
                        type="button"
                    >
                        <Icon
                            className="text-[20px]"
                            name={visible ? 'visibility_off' : 'visibility'}
                        />
                    </button>
                ) : null}
            </div>
            {error ? (
                <p className="text-label-medium font-medium text-error" id={errorId} role="alert">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
