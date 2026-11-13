import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SnackbarProvider, useSnackbar } from './SnackbarProvider';

function Trigger() {
    const snackbar = useSnackbar();
    return (
        <>
            <button onClick={() => snackbar.success('yay')} type="button">
                s
            </button>
            <button onClick={() => snackbar.error('bad')} type="button">
                e
            </button>
            <button onClick={() => snackbar.info('fyi')} type="button">
                i
            </button>
        </>
    );
}

afterEach(() => vi.useRealTimers());

describe('SnackbarProvider', () => {
    it('shows messages with the right role and dismisses them', async () => {
        render(
            <SnackbarProvider>
                <Trigger />
            </SnackbarProvider>,
        );
        await userEvent.click(screen.getByText('s'));
        await userEvent.click(screen.getByText('e'));
        expect(screen.getByRole('status')).toHaveTextContent('yay');
        expect(screen.getByRole('alert')).toHaveTextContent('bad');
        await userEvent.click(screen.getAllByLabelText('Dismiss notification')[0]!);
        expect(screen.queryByText('yay')).toBeNull();
    });

    it('keeps at most three and auto-dismisses', () => {
        vi.useFakeTimers();
        render(
            <SnackbarProvider>
                <Trigger />
            </SnackbarProvider>,
        );
        for (const label of ['s', 'e', 'i', 's']) {
            act(() => screen.getByText(label).click());
        }
        expect(screen.getAllByLabelText('Dismiss notification')).toHaveLength(3);
        act(() => {
            vi.advanceTimersByTime(5100);
        });
        expect(screen.queryAllByLabelText('Dismiss notification')).toHaveLength(0);
    });

    it('throws outside the provider', () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        expect(() => render(<Trigger />)).toThrow('SnackbarProvider');
        spy.mockRestore();
    });
});
