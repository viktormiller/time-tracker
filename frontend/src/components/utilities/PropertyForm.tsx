import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Loader2 } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import type { Property } from './PropertySelector';

interface PropertyFormProps {
  property?: Property | null;
  onClose: () => void;
  onSave: () => void;
}

export function PropertyForm({ property, onClose, onSave }: PropertyFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: property?.name || '',
    address: property?.address || '',
    movedIn: property?.movedIn?.split('T')[0] || '',
    movedOut: property?.movedOut?.split('T')[0] || '',
  });

  useEffect(() => {
    if (property) {
      setFormData({
        name: property.name,
        address: property.address || '',
        movedIn: property.movedIn?.split('T')[0] || '',
        movedOut: property.movedOut?.split('T')[0] || '',
      });
    }
  }, [property]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Bitte geben Sie einen Namen ein');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: formData.name.trim(),
        address: formData.address.trim() || null,
        movedIn: formData.movedIn || null,
        movedOut: formData.movedOut || null,
      };

      if (property) {
        await axios.put(`/api/utilities/properties/${property.id}`, payload);
        toast.success('Wohnung aktualisiert');
      } else {
        await axios.post('/api/utilities/properties', payload);
        toast.success('Wohnung erstellt');
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save property:', err);
      toast.error('Fehler beim Speichern');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {property ? 'Wohnung bearbeiten' : 'Neue Wohnung'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            type="button"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="z.B. Hauptwohnung, Alte Wohnung"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
              required
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Adresse
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="z.B. Musterstraße 42, 12345 Berlin"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
            />
          </div>

          {/* Moved In */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Einzug
            </label>
            <input
              type="date"
              value={formData.movedIn}
              onChange={(e) => setFormData({ ...formData, movedIn: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
            />
          </div>

          {/* Moved Out */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Auszug
            </label>
            <input
              type="date"
              value={formData.movedOut}
              onChange={(e) => setFormData({ ...formData, movedOut: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Setzen Sie das Auszugsdatum, um die Wohnung als historisch zu markieren
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {property ? 'Aktualisieren' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
