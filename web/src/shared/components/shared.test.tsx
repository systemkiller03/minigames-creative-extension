import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, getButtonClassName } from './Button';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Icon } from './Icon';
import { LoadingState } from './LoadingState';
import { Modal } from './Modal';
import { Pagination } from './Pagination';

describe('Button', () => {
    it('defaults to a primary medium button of type button', () => {
        render(<Button>Go</Button>);
        const button = screen.getByRole('button', { name: 'Go' });
        expect(button).toHaveAttribute('type', 'button');
        expect(button.className).toContain('bg-primary');
    });
    it('builds class names per variant and size', () => {
        expect(getButtonClassName('outline', 'lg', 'extra')).toContain('rounded-medium');
        expect(getButtonClassName('inverse', 'sm')).toContain('text-white');
        expect(getButtonClassName()).toContain('px-button-medium-x');
    });
});

describe('state components', () => {
    it('renders empty, loading and error states', async () => {
        const onRetry = vi.fn();
        render(
            <>
                <EmptyState message="Nothing" />
                <LoadingState label="Loading it" />
                <ErrorState message="Broke" onRetry={onRetry} />
            </>,
        );
        expect(screen.getByText('Nothing')).toBeInTheDocument();
        expect(screen.getByText('Loading it')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
        expect(onRetry).toHaveBeenCalled();
    });
    it('hides the retry button without a handler', () => {
        render(<ErrorState message="Broke" />);
        expect(screen.queryByRole('button')).toBeNull();
    });
});

describe('Icon', () => {
    it('renders name, fill and size', () => {
        const { container } = render(<Icon filled name="star" size={24} />);
        const span = container.querySelector('span');
        expect(span).toHaveTextContent('star');
        expect(span?.style.fontSize).toBe('24px');
        expect(span?.style.fontVariationSettings).toContain('1');
    });
});

describe('Pagination', () => {
    it('renders nothing for a single page', () => {
        const { container } = render(<Pagination onChange={vi.fn()} page={1} totalPages={1} />);
        expect(container).toBeEmptyDOMElement();
    });
    it('navigates and disables edges', async () => {
        const onChange = vi.fn();
        const { rerender } = render(<Pagination onChange={onChange} page={1} totalPages={3} />);
        expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute(
            'aria-current',
            'page',
        );
        await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
        expect(onChange).toHaveBeenLastCalledWith(2);
        await userEvent.click(screen.getByRole('button', { name: 'Page 3' }));
        expect(onChange).toHaveBeenLastCalledWith(3);
        rerender(<Pagination onChange={onChange} page={3} totalPages={3} />);
        expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
        await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
        expect(onChange).toHaveBeenLastCalledWith(2);
    });
});

describe('Modal', () => {
    it('focuses the first control, closes on Escape and backdrop, traps Tab', async () => {
        const onClose = vi.fn();
        render(
            <Modal labelledBy="t" onClose={onClose}>
                <h2 id="t">Title</h2>
                <button type="button">One</button>
                <button type="button">Two</button>
            </Modal>,
        );
        const one = screen.getByRole('button', { name: 'One' });
        const two = screen.getByRole('button', { name: 'Two' });
        expect(one).toHaveFocus();
        expect(document.body.style.overflow).toBe('hidden');

        await userEvent.tab({ shift: true });
        expect(two).toHaveFocus();
        await userEvent.tab();
        expect(one).toHaveFocus();

        await userEvent.keyboard('{Escape}');
        expect(onClose).toHaveBeenCalledTimes(1);

        await userEvent.pointer({
            keys: '[MouseLeft]',
            target: screen.getByRole('dialog').parentElement!,
        });
        expect(onClose).toHaveBeenCalledTimes(2);
    });
    it('restores scroll on unmount', () => {
        const { unmount } = render(
            <Modal labelledBy="t" onClose={vi.fn()}>
                <h2 id="t">T</h2>
            </Modal>,
        );
        unmount();
        expect(document.body.style.overflow).toBe('');
    });
});
