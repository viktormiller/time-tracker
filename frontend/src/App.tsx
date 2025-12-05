import { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Upload, FileUp, Loader2, RefreshCw } from 'lucide-react';
import { format, parseISO, startOfToday, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';

// Typen definieren (analog zum Backend)
interface TimeEntry {
  id: string;
  date: string; // Kommt als ISO String vom Backend
  duration: number;
  project: string;
  description: string;
  source: string;
}

interface DailyStats {
  dateStr: string;
  displayDate: string;
  totalHours: number;
  projects: string[]; // Welche Projekte an dem Tag aktiv waren
}

const API_URL = '/api';

function App() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Daten laden
  const fetchData = async () => {
    setLoading(true);
    try {
      // Axios ruft jetzt "http://localhost:5173/api/stats" auf, 
      // Vite leitet das intern an "http://localhost:3000/api/stats" weiter.
      const res = await axios.get<TimeEntry[]>(`${API_URL}/stats`);
      
      console.log("Backend Antwort:", res.data);
  
      if (Array.isArray(res.data)) {
         setEntries(res.data);
      }
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Daten aggregieren (Pro Tag summieren)
  const aggregatedData: DailyStats[] = (() => {

    // SICHERHEITS-CHECK: Ist entries wirklich ein Array?
    if (!Array.isArray(entries)) {
      console.error("WARNUNG: Empfangene Daten sind kein Array:", entries);
      return []; 
    }

    const map = new Map<string, DailyStats>();

    entries.forEach(entry => {
      // Datum ohne Zeit extrahieren (YYYY-MM-DD)
      const dateObj = parseISO(entry.date);
      const dateKey = format(dateObj, 'yyyy-MM-dd');

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateStr: dateKey,
          displayDate: format(dateObj, 'dd. MMM', { locale: de }),
          totalHours: 0,
          projects: []
        });
      }

      const dayStat = map.get(dateKey)!;
      dayStat.totalHours += entry.duration;
      if (entry.project && !dayStat.projects.includes(entry.project)) {
        dayStat.projects.push(entry.project);
      }
    });

    // Sortieren: Älteste links, Neueste rechts
    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  })();

  // KPIs berechnen
  const totalHoursAllTime = entries.reduce((acc, curr) => acc + curr.duration, 0);
  const today = new Date();
  const hoursToday = entries
    .filter(e => isSameDay(parseISO(e.date), today))
    .reduce((acc, curr) => acc + curr.duration, 0);

  // 3. Upload Handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      try {
          await axios.post(`${API_URL}/upload`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' }
          });
          alert('Import erfolgreich!');
          fetchData();
      } catch (error) {
          console.error(error);
          alert('Fehler beim Upload.');
      } finally {
          setUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  return (
    <div className="min-h-screen p-8 max-w-6xl mx-auto font-sans">
      
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">vihais Tracker</h1>
          <p className="text-gray-500">Zeitübersicht aus Toggl & Tempo</p>
        </div>
        
        <div className="flex gap-4">
            <button 
                onClick={fetchData} 
                className="p-2 hover:bg-gray-200 rounded-full transition" 
                title="Aktualisieren"
            >
                <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
            </button>
            <div className="relative">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileUpload} 
                    accept=".csv"
                    className="hidden"
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-sm disabled:opacity-50"
                >
                    {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                    CSV Importieren
                </button>
            </div>
        </div>
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card title="Stunden Heute" value={hoursToday.toFixed(2) + " h"} />
        <Card title="Stunden Gesamt" value={totalHoursAllTime.toFixed(1) + " h"} />
        <Card title="Einträge" value={entries.length.toString()} />
      </div>

      {/* Chart Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold mb-6 text-gray-700">Tägliche Arbeitszeit</h2>
        
        {aggregatedData.length > 0 ? (
            <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={aggregatedData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                <XAxis 
                    dataKey="displayDate" 
                    tick={{fill: '#6b7280', fontSize: 12}} 
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis 
                    tick={{fill: '#6b7280', fontSize: 12}} 
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `${val}h`}
                />
                <Tooltip 
                    cursor={{fill: '#f3f4f6'}}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="totalHours" radius={[4, 4, 0, 0]}>
                    {aggregatedData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.totalHours >= 8 ? '#10b981' : '#8b5cf6'} />
                    ))}
                </Bar>
                </BarChart>
            </ResponsiveContainer>
            </div>
        ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                <FileUp size={48} className="mb-4 opacity-50"/>
                <p>Noch keine Daten vorhanden.</p>
                <p className="text-sm">Lade einen Toggl oder Tempo Export hoch.</p>
            </div>
        )}
      </div>

      {/* Recent Activity Feed (Optional) */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-700">Letzte Einträge</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-500">
                    <tr>
                        <th className="px-6 py-3 font-medium">Datum</th>
                        <th className="px-6 py-3 font-medium">Quelle</th>
                        <th className="px-6 py-3 font-medium">Projekt</th>
                        <th className="px-6 py-3 font-medium">Beschreibung</th>
                        <th className="px-6 py-3 font-medium text-right">Dauer</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {entries.slice(0, 10).map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50">
                            <td className="px-6 py-3 text-gray-600">
                                {format(parseISO(entry.date), 'dd.MM.yyyy')}
                            </td>
                            <td className="px-6 py-3">
                                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                    entry.source === 'TOGGL' ? 'bg-pink-100 text-pink-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {entry.source}
                                </span>
                            </td>
                            <td className="px-6 py-3 font-medium text-gray-800">{entry.project}</td>
                            <td className="px-6 py-3 text-gray-500 truncate max-w-xs">{entry.description}</td>
                            <td className="px-6 py-3 text-right font-mono text-gray-700">{entry.duration.toFixed(2)} h</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}

// Kleine Hilfskomponente für die Kacheln
function Card({ title, value }: { title: string, value: string }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
    );
}

export default App;
