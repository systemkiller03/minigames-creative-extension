import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from '@/shared/components/Icon';

export type SnackbarKind = 'success' | 'error' | 'info';

type SnackbarMessage = {
  id: number;
  kind: SnackbarKind;
  message: string;
};

type SnackbarApi = {
  show: (kind: SnackbarKind, message: string) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const SNACKBAR_DURATION_MS = 5000;
const MAX_VISIBLE = 3;

const SnackbarContext = createContext<SnackbarApi | null>(null);

const KIND_ICON: Record<SnackbarKind, { name: string; className: string }> = {
  success: { name: 'check_circle', className: 'text-price-free' },
  error: { name: 'error', className: 'text-error' },
  info: { name: 'info', className: 'text-tertiary' },
};

function SnackbarItem({
  item,
  onDismiss,
}: {
  item: SnackbarMessage;
  onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(item.id), SNACKBAR_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [item.id, onDismiss]);

  const icon = KIND_ICON[item.kind];

  return (
    <div
      className="pointer-events-auto flex w-full items-center gap-size-1 rounded-small border-button border-on-primary bg-white py-size-1 pl-size-2 pr-size-1 text-on-primary shadow-hard"
      role={item.kind === 'error' ? 'alert' : 'status'}
    >
      <Icon className={icon.className} name={icon.name} />
      <p className="flex-1 text-label-large font-medium">{item.message}</p>
      <button
        aria-label="Dismiss notification"
        className="grid size-icon-button-small shrink-0 cursor-pointer place-items-center rounded-small text-on-primary hover:bg-surface focus-visible:outline-2 focus-visible:outline-focus-ring"
        onClick={() => onDismiss(item.id)}
        type="button"
      >
        <Icon name="close" size={20} />
      </button>
    </div>
  );
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SnackbarMessage[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback((kind: SnackbarKind, message: string) => {
    nextId.current += 1;
    const item = { id: nextId.current, kind, message };
    setItems((current) => [...current, item].slice(-MAX_VISIBLE));
  }, []);

  const api = useMemo<SnackbarApi>(
    () => ({
      show,
      success: (message) => show('success', message),
      error: (message) => show('error', message),
      info: (message) => show('info', message),
    }),
    [show],
  );

  return (
    <SnackbarContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-size-2 bottom-size-2 z-[100] mx-auto flex max-w-[420px] flex-col gap-size-1"
      >
        {items.map((item) => (
          <SnackbarItem item={item} key={item.id} onDismiss={dismiss} />
        ))}
      </div>
    </SnackbarContext>
  );
}

export function useSnackbar(): SnackbarApi {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within SnackbarProvider');
  }
  return context;
}
