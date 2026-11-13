import { useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { deleteAccount, type Profile } from '@/features/auth/api/auth.api';
import { AuthField } from '@/features/auth/components/AuthField';
import { errorMessage } from '@/features/auth/components/authForm';
import { FormError } from '@/features/auth/components/AuthShell';
import { Modal } from '@/shared/components/Modal';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import { Section, SECTION_BUTTON } from './Section';

function ConfirmDialog({ profile, onClose }: { profile: Profile; onClose: () => void }) {
    const { clearSession } = useAuth();
    const snackbar = useSnackbar();
    const navigate = useNavigate();
    const cancelRef = useRef<HTMLButtonElement>(null);
    const [password, setPassword] = useState('');
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async (): Promise<void> => {
        if (profile.hasPassword && !password) {
            setError('Enter your password to confirm.');
            return;
        }
        setPending(true);
        setError(null);
        try {
            await deleteAccount(
                profile.hasPassword ? { password, confirm: true } : { confirm: true },
            );
            clearSession();
            snackbar.success('Your account has been deleted.');
            void navigate({ to: '/' });
        } catch (caught) {
            setError(errorMessage(caught, 'We couldn’t delete your account. Please try again.'));
            setPending(false);
        }
    };

    return (
        <Modal
            className="max-w-[420px] rounded-extra-large border-[3px] border-solid border-on-primary bg-bg shadow-[8px_8px_0_#111]"
            initialFocusRef={cancelRef}
            labelledBy="delete-account-title"
            onClose={onClose}
        >
            <form
                className="flex flex-col gap-size-3 p-size-3 above-mobile:p-size-4"
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                }}
            >
                <div className="flex flex-col gap-size-1">
                    <h2
                        className="text-display-small font-bold text-on-primary"
                        id="delete-account-title"
                    >
                        Delete account?
                    </h2>
                    <p className="text-body-small text-on-bg">
                        This permanently removes your account, favourites and devices. It cannot be
                        undone.
                    </p>
                </div>
                <FormError message={error} />
                {profile.hasPassword ? (
                    <AuthField
                        autoComplete="current-password"
                        icon="lock"
                        label="Password"
                        name="password"
                        onChange={setPassword}
                        type="password"
                        value={password}
                    />
                ) : null}
                <div className="flex gap-size-2">
                    <button
                        className={`${SECTION_BUTTON} flex-1 bg-white hover:bg-surface`}
                        onClick={onClose}
                        ref={cancelRef}
                        type="button"
                    >
                        Cancel
                    </button>
                    <button
                        className={`${SECTION_BUTTON} flex-1 border-error bg-error text-white`}
                        disabled={pending}
                        type="submit"
                    >
                        {pending ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}

export function DeleteAccountSection({ profile }: { profile: Profile }) {
    const [open, setOpen] = useState(false);

    return (
        <Section
            description="Permanently delete your account and everything linked to it."
            id="delete-title"
            title="Delete account"
        >
            <button
                className={`${SECTION_BUTTON} self-start border-error bg-white text-error hover:bg-surface`}
                onClick={() => setOpen(true)}
                type="button"
            >
                Delete my account
            </button>
            {open ? <ConfirmDialog onClose={() => setOpen(false)} profile={profile} /> : null}
        </Section>
    );
}
