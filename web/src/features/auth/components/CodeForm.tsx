import { useEffect, useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import { AuthField } from './AuthField';
import { codeSchema, errorMessage, fieldError } from './authForm';
import { AuthHeading, CTA_CLASS, FormError, LINK_CLASS } from './AuthShell';

const RESEND_COOLDOWN = 60;

type CodeFormProps = {
  title: string;
  email: string;
  submitLabel: string;
  onSubmit: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  backLabel: string;
};

/** 8-digit code entry shared by email verification and password reset. */
export function CodeForm({
  title,
  email,
  submitLabel,
  onSubmit,
  onResend,
  onBack,
  backLabel,
}: CodeFormProps) {
  const snackbar = useSnackbar();
  const [formError, setFormError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);

  useEffect(() => {
    if (cooldown <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const form = useForm({
    defaultValues: { code: '' },
    validators: {
      onChange: z.object({ code: codeSchema }),
      onSubmit: z.object({ code: codeSchema }),
    },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        await onSubmit(value.code);
      } catch (error) {
        setFormError(errorMessage(error, 'That code didn’t work. Please try again.'));
      }
    },
  });

  const resend = async (): Promise<void> => {
    try {
      await onResend();
      snackbar.success('A new code is on its way.');
      setCooldown(RESEND_COOLDOWN);
    } catch (error) {
      setFormError(errorMessage(error, 'We couldn’t send a new code. Please try again.'));
    }
  };

  return (
    <>
      <AuthHeading
        id="auth-dialog-title"
        subtitle={`We sent an 8-digit code to ${email}. It expires in 10 minutes.`}
        title={title}
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
          <form.Field name="code">
            {(field) => (
              <AuthField
                autoComplete="one-time-code"
                autoFocus
                error={fieldError(
                  field.state.meta.errors,
                  field.state.meta.isTouched || form.state.submissionAttempts > 0,
                )}
                icon="lock"
                inputMode="numeric"
                label="Verification code"
                maxLength={8}
                name="code"
                onBlur={field.handleBlur}
                onChange={(value) => field.handleChange(value.replace(/\D/gu, ''))}
                placeholder="12345678"
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <button className={CTA_CLASS} disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Checking…' : submitLabel}
            </button>
          )}
        </form.Subscribe>
      </form>
      <div className="flex items-center justify-between gap-size-2">
        <button className={LINK_CLASS} onClick={onBack} type="button">
          {backLabel}
        </button>
        <button
          className={LINK_CLASS}
          disabled={cooldown > 0}
          onClick={() => void resend()}
          type="button"
        >
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </>
  );
}
