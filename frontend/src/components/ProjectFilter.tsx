import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, FolderOpen, Search, Check, FolderSearch } from 'lucide-react';

interface ProjectFilterProps {
  value: string;
  onChange: (next: string) => void;
  projects: string[];
}

const ALL = 'ALL';

export function ProjectFilter({ value, onChange, projects }: ProjectFilterProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const isAll = value === ALL;
  const triggerLabel = isAll ? 'Alle Projekte' : value;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(p => p.toLowerCase().includes(q));
  }, [projects, query]);

  useEffect(() => {
    if (open) {
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
    }
  }, [open]);

  useEffect(() => { setHighlight(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-opt-index="${highlight}"]`);
    (el as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    const total = filtered.length + 1; // +1 for the leading "Alle Projekte" row
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, total - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlight === 0) choose(ALL);
      else if (filtered[highlight - 1]) choose(filtered[highlight - 1]);
    }
  };

  const renderHighlighted = (text: string) => {
    const q = query.trim();
    if (!q) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="text-indigo-600 dark:text-indigo-300 font-semibold">
          {text.slice(idx, idx + q.length)}
        </span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 h-10 w-56 px-3 rounded-lg border bg-gray-50 dark:bg-gray-700 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
          open
            ? 'border-indigo-500/50'
            : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
        }`}
      >
        {isAll ? (
          <FolderOpen size={16} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
        )}
        <span
          className={`flex-1 text-left truncate min-w-0 ${
            isAll ? 'text-gray-500 dark:text-gray-400' : 'text-gray-700 dark:text-gray-100'
          }`}
          title={isAll ? undefined : value}
        >
          {triggerLabel}
        </span>
        <ChevronDown
          size={16}
          className={`text-gray-400 dark:text-gray-500 transition-transform flex-shrink-0 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-80 origin-top-left rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-xl shadow-black/30 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-700 px-3 py-2.5">
            <Search size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Projekt suchen..."
              className="flex-1 bg-transparent text-sm text-gray-700 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
            />
            <kbd className="hidden sm:inline-block text-[10px] font-mono text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-600 rounded px-1.5 py-0.5 leading-none">
              esc
            </kbd>
          </div>

          <ul
            ref={listRef}
            role="listbox"
            aria-activedescendant={`projfilter-opt-${highlight}`}
            className="max-h-72 overflow-y-auto p-1"
          >
            <li
              id="projfilter-opt-0"
              data-opt-index="0"
              role="option"
              aria-selected={isAll}
              onMouseEnter={() => setHighlight(0)}
              onClick={() => choose(ALL)}
              className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm cursor-pointer select-none ${
                highlight === 0 ? 'bg-gray-100 dark:bg-gray-700' : ''
              } ${
                isAll
                  ? 'text-indigo-600 dark:text-indigo-300 font-medium'
                  : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              <FolderOpen size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <span className="flex-1">Alle Projekte</span>
              {isAll && <Check size={14} className="flex-shrink-0" />}
            </li>

            {filtered.length === 0 ? (
              <li className="flex flex-col items-center gap-2 py-6 text-xs text-gray-400 dark:text-gray-500">
                <FolderSearch size={20} />
                Keine Projekte gefunden
              </li>
            ) : (
              filtered.map((p, i) => {
                const idx = i + 1;
                const isSelected = value === p;
                const isHighlighted = highlight === idx;
                return (
                  <li
                    key={p}
                    id={`projfilter-opt-${idx}`}
                    data-opt-index={idx}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlight(idx)}
                    onClick={() => choose(p)}
                    title={p}
                    className={`flex items-center gap-2 rounded-md px-2.5 py-2 text-sm cursor-pointer select-none ${
                      isHighlighted ? 'bg-gray-100 dark:bg-gray-700' : ''
                    } ${
                      isSelected
                        ? 'text-indigo-600 dark:text-indigo-300 font-medium'
                        : 'text-gray-700 dark:text-gray-200'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                        isSelected ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                    <span className="flex-1 truncate">{renderHighlighted(p)}</span>
                    {isSelected && <Check size={14} className="flex-shrink-0" />}
                  </li>
                );
              })
            )}
          </ul>

          <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-1.5 text-[10px] text-gray-400 dark:text-gray-500 flex items-center justify-between">
            <span>{filtered.length} {filtered.length === 1 ? 'Projekt' : 'Projekte'}</span>
            <span className="flex items-center gap-2">
              <kbd className="font-mono border border-gray-200 dark:border-gray-600 rounded px-1 py-px leading-none">↑↓</kbd>
              navigieren
              <kbd className="font-mono border border-gray-200 dark:border-gray-600 rounded px-1 py-px leading-none">↵</kbd>
              wählen
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
