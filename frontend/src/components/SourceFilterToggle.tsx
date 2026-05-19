import { Filter } from 'lucide-react';

interface SourceFilterToggleProps {
  value: string[];
  onChange: (next: string[]) => void;
}

const SOURCES: { value: string; label: string; activeClass: string; dotClass: string }[] = [
  {
    value: 'TOGGL',
    label: 'Toggl',
    activeClass: 'bg-pink-100 dark:bg-pink-500/15 text-pink-700 dark:text-pink-200 border-pink-300 dark:border-pink-500/40',
    dotClass: 'bg-pink-500',
  },
  {
    value: 'TEMPO',
    label: 'Tempo',
    activeClass: 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-200 border-blue-300 dark:border-blue-500/40',
    dotClass: 'bg-blue-500',
  },
  {
    value: 'CLOCKIFY',
    label: 'Clockify',
    activeClass: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-300 dark:border-emerald-500/40',
    dotClass: 'bg-emerald-500',
  },
  {
    value: 'MANUAL',
    label: 'Manual',
    activeClass: 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-200 border-purple-300 dark:border-purple-500/40',
    dotClass: 'bg-purple-500',
  },
];

export function SourceFilterToggle({ value, onChange }: SourceFilterToggleProps) {
  const toggle = (source: string) => {
    onChange(value.includes(source) ? value.filter(v => v !== source) : [...value, source]);
  };

  const allOff = value.length === 0;

  return (
    <div className="flex items-center gap-2">
      <Filter size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
      <div className="inline-flex items-center gap-0.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 p-1 h-10">
        {SOURCES.map(({ value: v, label, activeClass, dotClass }) => {
          const isActive = value.includes(v);
          return (
            <button
              key={v}
              type="button"
              onClick={() => toggle(v)}
              aria-pressed={isActive}
              title={isActive ? `${label} ausgeblendet` : `Nur ${label}`}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                isActive
                  ? activeClass
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600/60'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full transition-opacity ${dotClass} ${
                  isActive || allOff ? 'opacity-100' : 'opacity-40'
                }`}
              />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
