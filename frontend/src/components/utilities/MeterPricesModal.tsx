import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';

interface MeterPrice {
  id: string;
  meterId: string;
  pricePerUnit: number;
  validFrom: string;
  createdAt: string;
}

interface MeterPricesModalProps {
  meterId: string;
  meterName: string;
  unit: string;
  onClose: () => void;
  onChanged: () => void;
}

export function MeterPricesModal({ meterId, meterName, unit, onClose, onChanged }: MeterPricesModalProps) {
  const { toast } = useToast();
  const [prices, setPrices] = useState<MeterPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [validFrom, setValidFrom] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchPrices = async () => {
    try {
      const res = await axios.get<MeterPrice[]>(`/api/utilities/meters/${meterId}/prices`);
      setPrices(res.data);
    } catch {
      toast.error('Fehler beim Laden der Preise');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meterId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(priceInput.replace(',', '.'));
    if (!priceInput || isNaN(parsed) || parsed <= 0) {
      toast.error('Bitte einen gültigen Preis eingeben');
      return;
    }

    setSaving(true);
    try {
      await axios.post(`/api/utilities/meters/${meterId}/prices`, {
        pricePerUnit: parsed,
        validFrom,
      });
      toast.success('Preis gespeichert');
      setPriceInput('');
      await fetchPrices();
      onChanged();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        toast.error(err.response.data.error);
      } else {
        toast.error('Fehler beim Speichern');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Diesen Preis wirklich löschen?')) return;
    try {
      await axios.delete(`/api/utilities/prices/${id}`);
      toast.success('Preis gelöscht');
      await fetchPrices();
      onChanged();
    } catch {
      toast.error('Fehler beim Löschen');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
            Preise – {meterName}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition shrink-0"
            type="button"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Arbeitspreis in €/{unit}. Jeder Preis gilt ab seinem Datum bis zum nächsten Eintrag —
            so bleiben Kostenvergleiche über Preiserhöhungen hinweg korrekt.
          </p>

          {/* Add form */}
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Preis (€/{unit})
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                placeholder="z.B. 0,3452"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                required
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gültig ab
              </label>
              <input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                required
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg transition font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Hinzufügen
            </button>
          </form>

          {/* Price list */}
          {loading ? (
            <div className="py-6 text-center text-gray-400 dark:text-gray-500">
              <Loader2 size={20} className="animate-spin mx-auto" />
            </div>
          ) : prices.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
              Noch kein Preis hinterlegt.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
              {prices.map((price) => (
                <li key={price.id} className="flex items-center justify-between px-4 py-2.5">
                  <div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {price.pricePerUnit.toLocaleString('de-DE', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 4,
                      })}{' '}
                      €/{unit}
                    </span>
                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                      ab {new Date(price.validFrom).toLocaleDateString('de-DE')}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(price.id)}
                    className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                    aria-label="Preis löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
