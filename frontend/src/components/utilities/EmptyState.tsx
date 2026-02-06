import { Gauge, Plus } from 'lucide-react';

interface EmptyStateProps {
  onCreateMeter: () => void;
}

export function EmptyState({ onCreateMeter }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6">
      {/* Icon decoration */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
          <Gauge size={48} className="text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center">
          <Plus size={20} className="text-white" />
        </div>
      </div>

      {/* Content */}
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
        Verbrauch erfassen
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-center max-w-md mb-8">
        Erstellen Sie Ihren ersten Zähler, um Strom-, Gas- oder Warmwasserverbrauch zu verfolgen.
      </p>

      {/* CTA Button */}
      <button
        onClick={onCreateMeter}
        className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg font-medium transition shadow-sm"
      >
        <Plus size={20} />
        Ersten Zähler erstellen
      </button>
    </div>
  );
}
