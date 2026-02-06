import { useState } from 'react';
import { format } from 'date-fns';
import { MoreVertical, Edit2, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

export interface MeterReading {
  id: string;
  meterId: string;
  readingDate: string;
  value: number;
  consumption: number | null;
  unit: string;
  photoPath: string | null;
  notes: string | null;
  createdAt: string;
}

interface ReadingsTableProps {
  readings: MeterReading[];
  loading: boolean;
  onEdit: (reading: MeterReading) => void;
  onDelete: (readingId: string) => void;
}

type SortField = 'readingDate' | 'value' | 'consumption';
type SortDirection = 'asc' | 'desc';

export function ReadingsTable({ readings, loading, onEdit, onDelete }: ReadingsTableProps) {
  const [sortField, setSortField] = useState<SortField>('readingDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedReadings = [...readings].sort((a, b) => {
    let comparison = 0;

    if (sortField === 'readingDate') {
      comparison = new Date(a.readingDate).getTime() - new Date(b.readingDate).getTime();
    } else if (sortField === 'value') {
      comparison = a.value - b.value;
    } else if (sortField === 'consumption') {
      const aConsumption = a.consumption ?? -Infinity;
      const bConsumption = b.consumption ?? -Infinity;
      comparison = aConsumption - bConsumption;
    }

    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const formatValue = (value: number, unit: string) => {
    return `${value.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`;
  };

  const handleDeleteClick = (reading: MeterReading) => {
    if (confirm('Diese Ablesung wirklich löschen?')) {
      onDelete(reading.id);
    }
    setOpenMenuId(null);
  };

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? (
      <ChevronUp size={16} className="inline ml-1" />
    ) : (
      <ChevronDown size={16} className="inline ml-1" />
    );
  };

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Datum
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Zählerstand
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Verbrauch
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Notizen
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Aktionen
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {[1, 2, 3].map(i => (
              <tr key={i} className="animate-pulse">
                <td className="px-4 py-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40"></div>
                </td>
                <td className="px-4 py-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8 ml-auto"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (readings.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg font-medium">Noch keine Ablesungen vorhanden.</p>
        <p className="text-sm mt-2">Fügen Sie Ihre erste Ablesung hinzu, um den Verbrauch zu tracken.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto overflow-y-visible">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
          <tr>
            <th
              onClick={() => handleSort('readingDate')}
              className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Datum
              <SortIndicator field="readingDate" />
            </th>
            <th
              onClick={() => handleSort('value')}
              className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Zählerstand
              <SortIndicator field="value" />
            </th>
            <th
              onClick={() => handleSort('consumption')}
              className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Verbrauch
              <SortIndicator field="consumption" />
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Notizen
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Aktionen
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedReadings.map((reading, index) => (
            <tr
              key={reading.id}
              className={`${
                index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'
              } hover:bg-gray-100 dark:hover:bg-gray-700 transition`}
            >
              <td className="px-4 py-4 text-sm text-gray-900 dark:text-gray-100">
                {format(new Date(reading.readingDate), 'dd.MM.yyyy')}
              </td>
              <td className="px-4 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatValue(reading.value, reading.unit)}
              </td>
              <td className="px-4 py-4 text-sm">
                {reading.consumption === null ? (
                  <span className="text-gray-500 dark:text-gray-400 italic">Basislinie</span>
                ) : (
                  <span className="text-green-600 dark:text-green-400 font-medium">
                    {formatValue(reading.consumption, reading.unit)}
                  </span>
                )}
              </td>
              <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                {reading.notes ? (
                  <span className="truncate block max-w-xs" title={reading.notes}>
                    {reading.notes}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">-</span>
                )}
              </td>
              <td className="px-4 py-4 text-right relative">
                <button
                  onClick={() => setOpenMenuId(openMenuId === reading.id ? null : reading.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition"
                >
                  <MoreVertical size={18} className="text-gray-600 dark:text-gray-400" />
                </button>

                {openMenuId === reading.id && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setOpenMenuId(null)}
                    />
                    <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 py-1 z-20">
                      <button
                        onClick={() => {
                          onEdit(reading);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center gap-2"
                      >
                        <Edit2 size={16} />
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => handleDeleteClick(reading)}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                      >
                        <Trash2 size={16} />
                        Löschen
                      </button>
                    </div>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
