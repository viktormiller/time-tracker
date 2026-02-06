import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';
import { useState, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(false);

  // Trigger enter animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(() => onDismiss(toast.id), 200);
  };

  const config = getToastConfig(toast.type);

  return (
    <div
      className={`
        flex items-start gap-3 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100
        rounded-lg shadow-lg border-l-4 p-4 min-w-[300px] transition-all duration-200
        ${config.borderColor}
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
      `}
    >
      <div className={config.iconColor}>
        {config.icon}
      </div>
      <p className="flex-1 text-sm leading-relaxed">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        aria-label="Dismiss"
      >
        <X size={18} />
      </button>
    </div>
  );
}

function getToastConfig(type: ToastType) {
  switch (type) {
    case 'success':
      return {
        icon: <CheckCircle2 size={20} />,
        iconColor: 'text-green-500',
        borderColor: 'border-l-green-500',
      };
    case 'error':
      return {
        icon: <XCircle size={20} />,
        iconColor: 'text-red-500',
        borderColor: 'border-l-red-500',
      };
    case 'warning':
      return {
        icon: <AlertTriangle size={20} />,
        iconColor: 'text-yellow-500',
        borderColor: 'border-l-yellow-500',
      };
  }
}
