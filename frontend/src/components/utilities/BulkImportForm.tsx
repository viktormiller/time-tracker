import { useState, useRef } from 'react';
import axios from 'axios';
import { X, Loader2, Upload, FileUp, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface BulkImportFormProps {
  meterId: string;
  meterName: string;
  onClose: () => void;
  onSave: () => void;
}

interface ParsedRow {
  readingDate: string; // YYYY-MM-DD
  displayDate: string; // DD.MM.YYYY
  value: number;
  status: 'valid' | 'error';
  error?: string;
}

function parseGermanDate(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const d = parseInt(day, 10);
  const m = parseInt(month, 10);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function parseValue(text: string): number | null {
  let cleaned = text.trim();
  if (cleaned.includes(',')) {
    // German format: 1.234,56 -> dots are thousands, comma is decimal
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/\.\d{3}$/.test(cleaned)) {
    // Dot followed by exactly 3 digits at end (e.g. 2.389) -> thousands separator
    cleaned = cleaned.replace(/\./g, '');
  }
  const num = Number(cleaned);
  return isNaN(num) || num < 0 ? null : num;
}

function parseLines(text: string): ParsedRow[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      // Match date, then split on first comma/semicolon/tab to get the value portion.
      // This avoids splitting German numbers like 2.694,41 on the comma.
      const match = line.match(/^\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*[,;\t]\s*(.+)\s*$/);
      if (!match) {
        return { readingDate: '', displayDate: line, value: 0, status: 'error' as const, error: 'Ungültiges Format' };
      }

      const [, dateStr, valueStr] = match;

      const date = parseGermanDate(dateStr);
      if (!date) {
        return { readingDate: '', displayDate: dateStr, value: 0, status: 'error' as const, error: 'Ungültiges Datum' };
      }

      const value = parseValue(valueStr);
      if (value === null) {
        return { readingDate: date, displayDate: dateStr, value: 0, status: 'error' as const, error: 'Ungültiger Wert' };
      }

      return { readingDate: date, displayDate: dateStr, value, status: 'valid' as const };
    });
}

export function BulkImportForm({ meterId, meterName, onClose, onSave }: BulkImportFormProps) {
  const { toast } = useToast();
  const [rawText, setRawText] = useState('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = (text: string) => {
    setRawText(text);
    setResult(null);
    if (text.trim()) {
      setParsed(parseLines(text));
    } else {
      setParsed([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      handleTextChange(text);
    };
    reader.readAsText(file);
    // Reset so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const validRows = parsed.filter(r => r.status === 'valid');
  const errorRows = parsed.filter(r => r.status === 'error');

  const handleImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setResult(null);
    try {
      const res = await axios.post(`/api/utilities/meters/${meterId}/readings/bulk`, {
        readings: validRows.map(r => ({ readingDate: r.readingDate, value: r.value })),
      });
      setResult(res.data);
      if (res.data.created > 0) {
        toast.success(`${res.data.created} Ablesung(en) importiert`);
        onSave();
      } else {
        toast.warning('Keine neuen Ablesungen importiert (alle bereits vorhanden)');
      }
    } catch (err: any) {
      if (err.response?.status === 400 && err.response?.data?.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error('Fehler beim Import');
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ablesungen importieren</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{meterName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            type="button"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Daten einfügen (DD.MM.YYYY, Wert)
            </label>
            <textarea
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder={"01.04.2025, 2694.41\n01.05.2025, 2794.41\n01.06.2025, 2.894,41"}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent resize-none font-mono text-sm"
            />
          </div>

          {/* File upload */}
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-2 text-sm border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-500 dark:hover:border-indigo-500 dark:hover:text-indigo-400 transition"
            >
              <FileUp size={16} />
              CSV-Datei laden
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* Preview table */}
          {parsed.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Vorschau ({validRows.length} gültig{errorRows.length > 0 ? `, ${errorRows.length} fehlerhaft` : ''})
                </h3>
              </div>
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Datum</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Zählerstand</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {parsed.map((row, i) => (
                      <tr key={i} className={row.status === 'error' ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.displayDate}</td>
                        <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100 font-mono">
                          {row.status === 'valid' ? row.value.toLocaleString('de-DE') : '—'}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {row.status === 'valid' ? (
                            <CheckCircle size={16} className="inline text-green-500" />
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 text-xs">
                              <AlertCircle size={14} />
                              {row.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result feedback */}
          {result && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 text-sm">
              <CheckCircle size={16} />
              <span>{result.created} erstellt{result.skipped > 0 ? `, ${result.skipped} übersprungen (bereits vorhanden)` : ''}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
          >
            Schließen
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || validRows.length === 0}
            className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {validRows.length > 0 ? `${validRows.length} importieren` : 'Importieren'}
          </button>
        </div>
      </div>
    </div>
  );
}
