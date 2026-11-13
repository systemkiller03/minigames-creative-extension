import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { useAuth } from '@/features/auth/AuthProvider';
import { changePassword, type Profile } from '@/features/auth/api/auth.api';
import { AuthField } from '@/features/auth/components/AuthField';
import { errorMessage, fieldError, passwordSchema } from '@/features/auth/components/authForm';
import { FormError } from '@/features/auth/components/AuthShell';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import { Section, SECTION_BUTTON } from './Section';

const schema = z
    .object({
        currentPassword: z.string().min(1, 'Enter your current password'),
        newPassword: passwordSchema,
    })
    .refine((value) => value.currentPassword !== value.newPassword, {
        path: ['newPassword'],
        message: 'New password must differ from the current one',
    });

export function PasswordSection({ profile }: { profile: Profile }) {
    const { clearSession } = useAuth();
    const snackbar = useSnackbar();
    const navigate = useNavigate();
    const [formError, setFormError] = useState<string | null>(null);

    const form = useForm({
        defaultValues: { currentPassword: '', newPassword: '' },
        validators: { onChange: schema, onSubmit: schema },
        onSubmit: async ({ value }) => {
            setFormError(null);
            try {
                await changePassword(value);
                clearSession();
                snackbar.success('Password changed. Please log in again.');
                void navigate({ to: '/', search: { auth: 'login' } });
            } catch (error) {
                setFormError(
                    errorMessage(error, 'We couldn’t change your password. Please try again.'),
                );
            }
        },
    });

    if (!profile.hasPassword) {
        return (
            <Section
                description="You signed in with Google, so there is no password to change."
                id="password-title"
                title="Password"
            >
                <></>
            </Section>
        );
    }

    return (
        <Section
            description="Changing your password logs you out on every device."
            id="password-title"
            title="Password"
        >
            <form
                className="flex flex-col gap-size-2"
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    void form.handleSubmit();
                }}
            >
                <FormError message={formError} />
                {(['currentPassword', 'newPassword'] as const).map((name) => (
                    <form.Field key={name} name={name}>
                        {(field) => (
                            <AuthField
                                autoComplete={
                                    name === 'currentPassword' ? 'current-password' : 'new-password'
                                }
                                error={fieldError(
                                    field.state.meta.errors,
                                    field.state.meta.isTouched || form.state.submissionAttempts > 0,
                                )}
                                icon="lock"
                                label={
                                    name === 'currentPassword' ? 'Current Password' : 'New Password'
                                }
                                name={name}
                                onBlur={field.handleBlur}
                                onChange={field.handleChange}
                                placeholder={
                                    name === 'newPassword' ? 'Min. 8 characters' : '••••••••'
                                }
                                type="password"
                                value={field.state.value}
                            />
                        )}
                    </form.Field>
                ))}
                <form.Subscribe selector={(state) => state.isSubmitting}>
                    {(isSubmitting) => (
                        <button
                            className={`${SECTION_BUTTON} self-start bg-primary hover:bg-primary-high`}
                            disabled={isSubmitting}
                            type="submit"
                        >
                            {isSubmitting ? 'Saving…' : 'Change password'}
                        </button>
                    )}
                </form.Subscribe>
            </form>
        </Section>
    );
}
