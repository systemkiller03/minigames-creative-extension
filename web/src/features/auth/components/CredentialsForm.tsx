import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useAuth } from '../AuthProvider';
import { register, requestEmailVerification } from '../api/auth.api';
import { ApiError } from '@/shared/api/client';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import { AuthField } from './AuthField';
import { errorMessage, fieldError, loginSchema, registerSchema } from './authForm';
import {
    AuthHeading,
    CTA_CLASS,
    FormError,
    GoogleButton,
    LINK_CLASS,
    OrDivider,
} from './AuthShell';

type Props = {
    mode: 'login' | 'register';
    onSwitch: (mode: 'login' | 'register') => void;
    onForgot: () => void;
    onVerify: (email: string, password: string) => void;
    onDone: () => void;
};

export function CredentialsForm({ mode, onSwitch, onForgot, onVerify, onDone }: Props) {
    return mode === 'login' ? (
        <LoginForm onDone={onDone} onForgot={onForgot} onSwitch={onSwitch} onVerify={onVerify} />
    ) : (
        <RegisterForm onSwitch={onSwitch} onVerify={onVerify} />
    );
}

function LoginForm({ onDone, onForgot, onSwitch, onVerify }: Omit<Props, 'mode'>) {
    const { signIn } = useAuth();
    const snackbar = useSnackbar();
    const [formError, setFormError] = useState<string | null>(null);

    const form = useForm({
        defaultValues: { email: '', password: '' },
        validators: { onChange: loginSchema, onSubmit: loginSchema },
        onSubmit: async ({ value }) => {
            setFormError(null);
            const credentials = { email: value.email.trim(), password: value.password };
            try {
                const user = await signIn(credentials);
                snackbar.success(`Welcome back, ${user.name}!`);
                onDone();
            } catch (error) {
                if (error instanceof ApiError && error.code === 'EMAIL_NOT_VERIFIED') {
                    await requestEmailVerification(credentials.email).catch(() => undefined);
                    onVerify(credentials.email, credentials.password);
                    return;
                }
                setFormError(
                    error instanceof ApiError && error.status === 401
                        ? 'Incorrect email or password.'
                        : errorMessage(error, 'We couldn’t log you in. Please try again.'),
                );
            }
        },
    });

    return (
        <>
            <AuthHeading
                id="auth-dialog-title"
                subtitle="Sign in to resume your games and progress."
                title="Welcome Back!"
            />
            <form
                className="flex flex-col gap-size-3"
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    void form.handleSubmit();
                }}
            >
                <div className="flex flex-col gap-size-2">
                    <FormError message={formError} />
                    <form.Field name="email">
                        {(field) => (
                            <AuthField
                                autoComplete="email"
                                autoFocus
                                error={fieldError(
                                    field.state.meta.errors,
                                    field.state.meta.isTouched || form.state.submissionAttempts > 0,
                                )}
                                icon="mail"
                                inputMode="email"
                                label="Email Address"
                                name="email"
                                onBlur={field.handleBlur}
                                onChange={field.handleChange}
                                placeholder="e.g. alex@minigames.com"
                                type="email"
                                value={field.state.value}
                            />
                        )}
                    </form.Field>
                    <form.Field name="password">
                        {(field) => (
                            <AuthField
                                autoComplete="current-password"
                                error={fieldError(
                                    field.state.meta.errors,
                                    field.state.meta.isTouched || form.state.submissionAttempts > 0,
                                )}
                                icon="lock"
                                label="Password"
                                name="password"
                                onBlur={field.handleBlur}
                                onChange={field.handleChange}
                                placeholder="••••••••"
                                type="password"
                                value={field.state.value}
                            />
                        )}
                    </form.Field>
                    <div className="flex justify-end">
                        <button className={LINK_CLASS} onClick={onForgot} type="button">
                            Forgot Password?
                        </button>
                    </div>
                </div>
                <div className="flex flex-col gap-size-2">
                    <form.Subscribe selector={(state) => state.isSubmitting}>
                        {(isSubmitting) => (
                            <button className={CTA_CLASS} disabled={isSubmitting} type="submit">
                                {isSubmitting ? 'Logging in…' : 'Login'}
                            </button>
                        )}
                    </form.Subscribe>
                    <OrDivider />
                    <GoogleButton>Continue with Google</GoogleButton>
                </div>
            </form>
            <p className="flex justify-center gap-size-05 text-body-small text-on-bg">
                Don&apos;t have an account?
                <button className={LINK_CLASS} onClick={() => onSwitch('register')} type="button">
                    Register
                </button>
            </p>
        </>
    );
}

function RegisterForm({ onSwitch, onVerify }: Pick<Props, 'onSwitch' | 'onVerify'>) {
    const snackbar = useSnackbar();
    const [formError, setFormError] = useState<string | null>(null);

    const form = useForm({
        defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
        validators: { onChange: registerSchema, onSubmit: registerSchema },
        onSubmit: async ({ value }) => {
            setFormError(null);
            const email = value.email.trim();
            try {
                await register({ name: value.name.trim(), email, password: value.password });
                snackbar.success('Account created. Check your email for the verification code.');
                onVerify(email, value.password);
            } catch (error) {
                setFormError(
                    errorMessage(error, 'We couldn’t create your account. Please try again.'),
                );
            }
        },
    });

    const show = (touched: boolean): boolean => touched || form.state.submissionAttempts > 0;

    return (
        <>
            <AuthHeading
                id="auth-dialog-title"
                subtitle="Join MiniGames to track your score & streak."
                title="Create Account"
            />
            <form
                className="flex flex-col gap-size-3"
                noValidate
                onSubmit={(event) => {
                    event.preventDefault();
                    void form.handleSubmit();
                }}
            >
                <div className="flex flex-col gap-size-2">
                    <FormError message={formError} />
                    <form.Field name="name">
                        {(field) => (
                            <AuthField
                                autoComplete="username"
                                autoFocus
                                error={fieldError(
                                    field.state.meta.errors,
                                    show(field.state.meta.isTouched),
                                )}
                                icon="person"
                                label="Username"
                                name="name"
                                onBlur={field.handleBlur}
                                onChange={field.handleChange}
                                placeholder="e.g. CozyGamer_99"
                                value={field.state.value}
                            />
                        )}
                    </form.Field>
                    <form.Field name="email">
                        {(field) => (
                            <AuthField
                                autoComplete="email"
                                error={fieldError(
                                    field.state.meta.errors,
                                    show(field.state.meta.isTouched),
                                )}
                                icon="mail"
                                inputMode="email"
                                label="Email Address"
                                name="email"
                                onBlur={field.handleBlur}
                                onChange={field.handleChange}
                                placeholder="your.email@domain.com"
                                type="email"
                                value={field.state.value}
                            />
                        )}
                    </form.Field>
                    <form.Field name="password">
                        {(field) => (
                            <AuthField
                                autoComplete="new-password"
                                error={fieldError(
                                    field.state.meta.errors,
                                    show(field.state.meta.isTouched),
                                )}
                                icon="lock"
                                label="Password"
                                name="password"
                                onBlur={field.handleBlur}
                                onChange={field.handleChange}
                                placeholder="Min. 8 characters"
                                type="password"
                                value={field.state.value}
                            />
                        )}
                    </form.Field>
                    <form.Field name="confirmPassword">
                        {(field) => (
                            <AuthField
                                autoComplete="new-password"
                                error={fieldError(
                                    field.state.meta.errors,
                                    show(field.state.meta.isTouched),
                                )}
                                icon="lock"
                                label="Confirm Password"
                                name="confirmPassword"
                                onBlur={field.handleBlur}
                                onChange={field.handleChange}
                                placeholder="Repeat your password"
                                type="password"
                                value={field.state.value}
                            />
                        )}
                    </form.Field>
                </div>
                <div className="flex flex-col gap-size-2">
                    <form.Subscribe selector={(state) => state.isSubmitting}>
                        {(isSubmitting) => (
                            <button className={CTA_CLASS} disabled={isSubmitting} type="submit">
                                {isSubmitting ? 'Creating account…' : 'Create Account'}
                            </button>
                        )}
                    </form.Subscribe>
                    <OrDivider />
                    <GoogleButton>Sign up with Google</GoogleButton>
                </div>
            </form>
            <p className="flex justify-center gap-size-05 text-body-small text-on-bg">
                Already have an account?
                <button className={LINK_CLASS} onClick={() => onSwitch('login')} type="button">
                    Login
                </button>
            </p>
        </>
    );
}
