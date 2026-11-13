import { useEffect, useRef, type KeyboardEvent, type ReactNode, type RefObject } from 'react';

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ModalProps = {
    onClose: () => void;
    labelledBy: string;
    className?: string;
    initialFocusRef?: RefObject<HTMLElement | null>;
    children: ReactNode;
};

/** Accessible modal: Escape and backdrop close, focus trap, scroll lock and focus restore. */
export function Modal({
    onClose,
    labelledBy,
    className = '',
    initialFocusRef,
    children,
}: ModalProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const previouslyFocused = document.activeElement;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        (
            initialFocusRef?.current ??
            panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ??
            panelRef.current
        )?.focus();

        return () => {
            document.body.style.overflow = previousOverflow;
            if (previouslyFocused instanceof HTMLElement) {
                previouslyFocused.focus();
            }
        };
    }, []);

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
        if (event.key === 'Escape') {
            event.stopPropagation();
            onClose();
            return;
        }
        if (event.key !== 'Tab' || !panelRef.current) {
            return;
        }
        const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        const first = items[0];
        const last = items[items.length - 1];
        if (!first || !last) {
            return;
        }
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex overflow-y-auto bg-on-primary/60 p-size-2 above-mobile:p-size-3"
            onKeyDown={onKeyDown}
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose();
                }
            }}
        >
            <div
                aria-labelledby={labelledBy}
                aria-modal="true"
                className={`relative m-auto w-full ${className}`}
                ref={panelRef}
                role="dialog"
                tabIndex={-1}
            >
                {children}
            </div>
        </div>
    );
}
