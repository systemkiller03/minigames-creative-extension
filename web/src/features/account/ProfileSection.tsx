import { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { z } from 'zod';
import { useAuth } from '@/features/auth/AuthProvider';
import { updateProfile, type Profile } from '@/features/auth/api/auth.api';
import { AuthField } from '@/features/auth/components/AuthField';
import { errorMessage, fieldError } from '@/features/auth/components/authForm';
import { FormError } from '@/features/auth/components/AuthShell';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import { Section, SECTION_BUTTON } from './Section';

const schema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters').max(30, 'Use at most 30 characters'),
});

export function ProfileSection({ profile }: { profile: Profile }) {
  const { updateUser } = useAuth();
  const snackbar = useSnackbar();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: profile.name },
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: async ({ value }) => {
      setFormError(null);
      try {
        updateUser(await updateProfile({ name: value.name.trim() }));
        snackbar.success('Profile updated.');
      } catch (error) {
        setFormError(errorMessage(error, 'We couldn’t update your profile. Please try again.'));
      }
    },
  });

  return (
    <Section
      description={`${profile.email}${profile.emailVerified ? ' · verified' : ' · not verified'}`}
      id="profile-title"
      title="Profile"
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
        <form.Field name="name">
          {(field) => (
            <AuthField
              autoComplete="username"
              error={fieldError(
                field.state.meta.errors,
                field.state.meta.isTouched || form.state.submissionAttempts > 0,
              )}
              icon="person"
              label="Username"
              name="name"
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => [state.isSubmitting, state.isDefaultValue] as const}>
          {([isSubmitting, isDefault]) => (
            <button
              className={`${SECTION_BUTTON} self-start bg-primary hover:bg-primary-high`}
              disabled={isSubmitting || isDefault}
              type="submit"
            >
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </form.Subscribe>
      </form>
    </Section>
  );
}
