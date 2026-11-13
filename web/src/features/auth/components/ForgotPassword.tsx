import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import { confirmPasswordReset, requestPasswordReset, verifyPasswordReset } from '../api/auth.api';
import { AuthField } from './AuthField';
import { CodeForm } from './CodeForm';
import { emailSchema, errorMessage, fieldError, passwordSchema } from './authForm';
import { AuthHeading, CTA_CLASS, FormError, LINK_CLASS } from './AuthShell';

type Step =
  | { name: 'email' }
  | { name: 'code'; email: string }
  | { name: 'password'; email: string; resetToken: string };

const emailOnly = z.object({ email: emailSchema });
const passwordsSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export function ForgotPassword({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [step, setStep] = useState<Step>({ name: 'email' });
  const snackbar = useSnackbar();

  if (step.name === 'code') {
    return (
      <CodeForm
        backLabel="Use a different email"
        email={step.email}
        onBack={() => setStep({ name: 'email' })}
        onResend={async () => {
          await requestPasswordReset(step.email);
        }}
        onSubmit={async (code) => {
          const resetToken = await verifyPasswordReset({ email: step.email, code });
          setStep({ name: 'password', email: step.email, resetToken });
        }}
        submitLabel="Verify code"
        title="Check your email"
      />
    );
  }

  if (step.name === 'password') {
    return (
      <NewPasswordForm
        onSubmit={async (newPassword) => {
          await confirmPasswordReset({
            email: step.email,
            resetToken: step.resetToken,
            newPassword,
          });
          snackbar.success('Password updated. You can log in now.');
          onDone();
        }}
      />
    );
  }

  return (
    <EmailForm
      onBack={onBack}
      onSubmit={async (email) => {
        await requestPasswordReset(email);
        setStep({ name: 'code', email });
      }}
    />
  );
}

function EmailForm({
  onSubmit,
  onBack,
}: {
  onSubmit: (email: string) => Promise<void>;
  onBack: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { email: '' },
    validators: { onChange: emailOnly, onSubmit: emailOnly },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await onSubmit(value.email.trim());
      } catch (error) {
        setFormError(errorMessage(error, 'We couldn’t send the code. Please try again.'));
      }
    },
  });

  return (
    <>
      <AuthHeading
        id="auth-dialog-title"
        subtitle="Enter your email and we’ll send you a code to reset your password."
        title="Forgot Password?"
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
        </div>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <button className={CTA_CLASS} disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Sending…' : 'Send code'}
            </button>
          )}
        </form.Subscribe>
      </form>
      <p className="flex justify-center">
        <button className={LINK_CLASS} onClick={onBack} type="button">
          Back to login
        </button>
      </p>
    </>
  );
}

function NewPasswordForm({ onSubmit }: { onSubmit: (password: string) => Promise<void> }) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { password: '', confirmPassword: '' },
    validators: { onChange: passwordsSchema, onSubmit: passwordsSchema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await onSubmit(value.password);
      } catch (error) {
        setFormError(errorMessage(error, 'We couldn’t reset your password. Please try again.'));
      }
    },
  });
  const show = (touched: boolean): boolean => touched || form.state.submissionAttempts > 0;

  return (
    <>
      <AuthHeading
        id="auth-dialog-title"
        subtitle="Choose a new password for your account."
        title="New Password"
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
          <form.Field name="password">
            {(field) => (
              <AuthField
                autoComplete="new-password"
                autoFocus
                error={fieldError(field.state.meta.errors, show(field.state.meta.isTouched))}
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
                error={fieldError(field.state.meta.errors, show(field.state.meta.isTouched))}
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
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <button className={CTA_CLASS} disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Saving…' : 'Reset password'}
            </button>
          )}
        </form.Subscribe>
      </form>
    </>
  );
}
