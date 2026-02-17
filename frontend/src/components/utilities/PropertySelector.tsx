import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Home, Edit2 } from 'lucide-react';

export interface Property {
  id: string;
  name: string;
  address: string | null;
  movedIn: string | null;
  movedOut: string | null;
  createdAt: string;
  updatedAt: string;
  _count: { meters: number };
}

interface PropertySelectorProps {
  properties: Property[];
  selectedPropertyId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onEdit: (property: Property) => void;
}

export function PropertySelector({
  properties,
  selectedPropertyId,
  onSelect,
  onCreateNew,
  onEdit,
}: PropertySelectorProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = properties.find(p => p.id === selectedPropertyId);
  const active = properties.filter(p => !p.movedOut);
  const historical = properties.filter(p => !!p.movedOut);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition text-sm font-medium text-gray-900 dark:text-white shadow-sm"
      >
        <Home size={16} className="text-gray-500 dark:text-gray-400" />
        <span>{selected?.name || 'Wohnung wählen'}</span>
        {selected?.movedOut && (
          <span className="text-xs text-gray-400 dark:text-gray-500">(ausgezogen)</span>
        )}
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-30">
          {/* Active properties */}
          {active.map(p => (
            <div key={p.id} className="flex items-center group">
              <button
                onClick={() => { onSelect(p.id); setOpen(false); }}
                className={`flex-1 px-4 py-2.5 text-left text-sm flex items-center gap-2 transition ${
                  p.id === selectedPropertyId
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <Home size={14} />
                <span className="font-medium">{p.name}</span>
                {p.address && <span className="text-xs text-gray-400 dark:text-gray-500 truncate ml-auto">{p.address}</span>}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(p); setOpen(false); }}
                className="p-2 mr-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              >
                <Edit2 size={14} />
              </button>
            </div>
          ))}

          {/* Divider + historical */}
          {historical.length > 0 && (
            <>
              <div className="border-t border-gray-100 dark:border-gray-700 my-1" />
              <div className="px-4 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Frühere Wohnungen
              </div>
              {historical.map(p => (
                <div key={p.id} className="flex items-center group">
                  <button
                    onClick={() => { onSelect(p.id); setOpen(false); }}
                    className={`flex-1 px-4 py-2 text-left text-sm flex items-center gap-2 transition ${
                      p.id === selectedPropertyId
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400'
                        : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Home size={14} />
                    <span>{p.name}</span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(p); setOpen(false); }}
                    className="p-2 mr-1 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Footer: create new */}
          <div className="border-t border-gray-100 dark:border-gray-700 mt-1">
            <button
              onClick={() => { onCreateNew(); setOpen(false); }}
              className="w-full px-4 py-2.5 text-left text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center gap-2 font-medium transition"
            >
              <Plus size={14} />
              Neue Wohnung
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
