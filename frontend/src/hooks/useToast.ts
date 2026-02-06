import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { ToastContainer } from '../components/Toast';

type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

// Module-level toast subscriber for non-component usage
type ToastSubscriber = (message: string, type: ToastType) => void;
let globalSubscriber: ToastSubscriber | null = null;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, message, type };

    setToasts((current) => [...current, newToast]);

    // Auto-dismiss based on type
    const timeout = type === 'error' ? 6000 : 4000;
    const timer = setTimeout(() => {
      removeToast(id);
    }, timeout);

    // Cleanup on unmount
    return () => clearTimeout(timer);
  }, [removeToast]);

  // Subscribe to module-level toast calls
  useEffect(() => {
    globalSubscriber = addToast;
    return () => {
      globalSubscriber = null;
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }

  return {
    toast: {
      success: (message: string) => context.addToast(message, 'success'),
      error: (message: string) => context.addToast(message, 'error'),
      warning: (message: string) => context.addToast(message, 'warning'),
    },
  };
}

// Module-level toast function for non-component code
export const toast = {
  success: (message: string) => {
    if (globalSubscriber) {
      globalSubscriber(message, 'success');
    } else {
      console.warn('Toast called before ToastProvider mounted:', message);
    }
  },
  error: (message: string) => {
    if (globalSubscriber) {
      globalSubscriber(message, 'error');
    } else {
      console.warn('Toast called before ToastProvider mounted:', message);
    }
  },
  warning: (message: string) => {
    if (globalSubscriber) {
      globalSubscriber(message, 'warning');
    } else {
      console.warn('Toast called before ToastProvider mounted:', message);
    }
  },
};
