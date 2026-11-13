import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Modal } from '@/shared/components/Modal';
import { useSnackbar } from '@/shared/snackbar/SnackbarProvider';
import { useAuth } from '../AuthProvider';
import { confirmEmailVerification, requestEmailVerification } from '../api/auth.api';
import { CodeForm } from './CodeForm';
import { CredentialsForm } from './CredentialsForm';
import { ForgotPassword } from './ForgotPassword';

type Mode = 'login' | 'register';
type View =
  | { name: 'credentials' }
  | { name: 'forgot' }
  | { name: 'verify'; email: string; password: string };

function Tabs({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  const tabs: ReadonlyArray<[Mode, string]> = [
    ['login', 'Login'],
    ['register', 'Register'],
  ];
  return (
    <div
      className="flex h-12 items-stretch rounded-medium border-[2.5px] border-solid border-on-primary bg-white"
      role="tablist"
    >
      {tabs.map(([value, label]) => (
        <button
          aria-selected={mode === value}
          className={`min-w-0 flex-1 cursor-pointer rounded-small text-label-extra-large font-bold leading-normal transition-colors duration-fast ease-fast focus-visible:outline-2 focus-visible:outline-focus-ring ${mode === value ? 'bg-bg-footer-low text-white' : 'text-on-bg hover:text-on-primary'}`}
          key={value}
          onClick={() => onChange(value)}
          role="tab"
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function AuthDialog({ mode }: { mode: Mode }) {
  const navigate = useNavigate();
  const snackbar = useSnackbar();
  const { signIn } = useAuth();
  const [view, setView] = useState<View>({ name: 'credentials' });

  const setMode = (next: Mode): void => {
    setView({ name: 'credentials' });
    void navigate({
      to: '.',
      search: (previous) => ({ ...previous, auth: next }),
      replace: true,
    });
  };
  const close = (): void => {
    void navigate({ to: '.', search: (previous) => ({ ...previous, auth: undefined }) });
  };

  return (
    <Modal
      className="max-w-[420px] rounded-extra-large border-[3px] border-solid border-on-primary bg-bg shadow-[8px_8px_0_#111]"
      labelledBy="auth-dialog-title"
      onClose={close}
    >
      <div className="flex flex-col gap-size-3 p-size-3 above-mobile:p-size-4">
        {view.name === 'credentials' ? <Tabs mode={mode} onChange={setMode} /> : null}
        {view.name === 'credentials' ? (
          <CredentialsForm
            key={mode}
            mode={mode}
            onDone={close}
            onForgot={() => setView({ name: 'forgot' })}
            onSwitch={setMode}
            onVerify={(email, password) => setView({ name: 'verify', email, password })}
          />
        ) : null}
        {view.name === 'forgot' ? (
          <ForgotPassword
            onBack={() => setView({ name: 'credentials' })}
            onDone={() => setMode('login')}
          />
        ) : null}
        {view.name === 'verify' ? (
          <CodeForm
            backLabel="Back"
            email={view.email}
            onBack={() => setView({ name: 'credentials' })}
            onResend={async () => {
              await requestEmailVerification(view.email);
            }}
            onSubmit={async (code) => {
              await confirmEmailVerification({ email: view.email, code });
              const user = await signIn({
                email: view.email,
                password: view.password,
              });
              snackbar.success(`Email verified. Welcome, ${user.name}!`);
              close();
            }}
            submitLabel="Verify email"
            title="Verify your email"
          />
        ) : null}
      </div>
    </Modal>
  );
}
