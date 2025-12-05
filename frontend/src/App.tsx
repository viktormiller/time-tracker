import { useEffect, useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Upload, FileUp, Loader2, RefreshCw, Filter, XCircle } from 'lucide-react';
import { format, parseISO, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';

// --- TYPEN ---
interface TimeEntry {
  id: string;
  date: string;
  duration: number;
  project: string;
  description: string;
  source: string;
}

interface DailyStats {
  dateStr: string;
  displayDate: string;
  totalHours: number;
  togglHours: number;
  tempoHours: number;
  projects: string[];
}

const API_URL = '/api';

function App() {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Filter States
  const [filterSource, setFilterSource] = useState<string>('ALL');
  const [filterProject, setFilterProject] = useState<string>('ALL');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Daten laden
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await axios.get<TimeEntry[]>(`${API_URL}/stats`);
      if (Array.isArray(res.data)) {
         setEntries(res.data);
      }
    } catch (error) {
      console.error("Fehler beim Laden:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. Filter Logik (useMemo für Performance)
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      const matchesSource = filterSource === 'ALL' || entry.source === filterSource;
      const matchesProject = filterProject === 'ALL' || entry.project === filterProject;
      return matchesSource && matchesProject;
    });
  }, [entries, filterSource, filterProject]);

  // Liste aller verfügbaren Projekte für das Dropdown
  const uniqueProjects = useMemo(() => {
    const projects = new Set(entries.map(e => e.project).filter(Boolean));
    return Array.from(projects).sort();
  }, [entries]);

  // 3. Daten aggregieren für das Diagramm (basiert auf gefilterten Daten)
  const aggregatedData: DailyStats[] = useMemo(() => {
    const map = new Map<string, DailyStats>();

    filteredEntries.forEach(entry => {
      const dateObj = parseISO(entry.date);
      const dateKey = format(dateObj, 'yyyy-MM-dd');

      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateStr: dateKey,
          displayDate: format(dateObj, 'dd.MM', { locale: de }),
          totalHours: 0,
          togglHours: 0,
          tempoHours: 0,
          projects: []
        });
      }

      const dayStat = map.get(dateKey)!;
      dayStat.totalHours += entry.duration;
      
      // Aufteilung nach Quelle für Stacked Bar Chart
      if (entry.source === 'TOGGL') {
        dayStat.togglHours += entry.duration;
      } else {
        dayStat.tempoHours += entry.duration;
      }

      if (entry.project && !dayStat.projects.includes(entry.project)) {
        dayStat.projects.push(entry.project);
      }
    });

    return Array.from(map.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [filteredEntries]);

  // KPIs berechnen
  const totalHoursFiltered = filteredEntries.reduce((acc, curr) => acc + curr.duration, 0);
  const today = new Date();
  const hoursToday = filteredEntries
    .filter(e => isSameDay(parseISO(e.date), today))
    .reduce((acc, curr) => acc + curr.duration, 0);

  // Upload Handler
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
    <div className="min-h-screen bg-gray-50 text-gray-800 p-6 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Area */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">vihais Tracker</h1>
            <p className="text-sm text-gray-500">Arbeitszeiten Übersicht</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
              <button 
                  onClick={fetchData} 
                  className="p-2.5 text-gray-600 hover:bg-gray-100 rounded-lg transition" 
                  title="Aktualisieren"
              >
                  <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
              </button>
              
              <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>

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
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg font-medium transition shadow-sm disabled:opacity-50 text-sm"
                  >
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      CSV Import
                  </button>
              </div>
          </div>
        </header>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-gray-500 mr-2">
                <Filter size={18} />
                <span className="text-sm font-medium">Filter:</span>
            </div>

            {/* Source Filter */}
            <select 
                value={filterSource} 
                onChange={(e) => setFilterSource(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 min-w-[120px]"
            >
                <option value="ALL">Alle Quellen</option>
                <option value="TOGGL">Toggl Track</option>
                <option value="TEMPO">Jira Tempo</option>
            </select>

            {/* Project Filter */}
            <select 
                value={filterProject} 
                onChange={(e) => setFilterProject(e.target.value)}
                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 min-w-[150px] max-w-xs"
            >
                <option value="ALL">Alle Projekte</option>
                {uniqueProjects.map(proj => (
                    <option key={proj} value={proj}>{proj}</option>
                ))}
            </select>

            {/* Reset Button (nur zeigen wenn Filter aktiv) */}
            {(filterSource !== 'ALL' || filterProject !== 'ALL') && (
                <button 
                    onClick={() => { setFilterSource('ALL'); setFilterProject('ALL'); }}
                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 ml-auto"
                >
                    <XCircle size={16} /> Filter löschen
                </button>
            )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card title="Stunden Heute" value={hoursToday.toFixed(2)} unit="h" color="text-indigo-600" />
          <Card title="Summe (Gefiltert)" value={totalHoursFiltered.toFixed(2)} unit="h" color="text-gray-900" />
          <Card title="Einträge" value={filteredEntries.length.toString()} unit="#" color="text-gray-600" />
        </div>

        {/* Chart Section */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold mb-6 text-gray-800">Tägliche Arbeitszeit</h2>
          
          {aggregatedData.length > 0 ? (
              <div className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aggregatedData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis 
                        dataKey="displayDate" 
                        tick={{fill: '#9ca3af', fontSize: 12}} 
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis 
                        tick={{fill: '#9ca3af', fontSize: 12}} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => `${val}h`}
                    />
                    <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                        cursor={{fill: '#f9fafb'}}
                    />
                    <Legend iconType="circle" />
                    {/* Stacked Bars: stackId="a" sorgt für das Stapeln */}
                    <Bar name="Toggl" dataKey="togglHours" stackId="a" fill="#E57CD8" radius={[0, 0, 4, 4]} />
                    <Bar name="Tempo" dataKey="tempoHours" stackId="a" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
              </ResponsiveContainer>
              </div>
          ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-lg bg-gray-50/50">
                  <FileUp size={48} className="mb-4 opacity-30"/>
                  <p>Keine Daten für diesen Filterzeitraum.</p>
              </div>
          )}
        </div>

        {/* Table Section (Scrollbar!) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col h-[500px]">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-800">Alle Einträge ({filteredEntries.length})</h3>
          </div>
          
          <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-500 sticky top-0 z-10 shadow-sm">
                      <tr>
                          <th className="px-6 py-3 font-medium">Datum</th>
                          <th className="px-6 py-3 font-medium">Quelle</th>
                          <th className="px-6 py-3 font-medium">Projekt</th>
                          <th className="px-6 py-3 font-medium">Beschreibung</th>
                          <th className="px-6 py-3 font-medium text-right">Dauer</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {filteredEntries.map((entry) => (
                          <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-3 text-gray-600">
                                  {format(parseISO(entry.date), 'dd.MM.yyyy')}
                              </td>
                              <td className="px-6 py-3">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      entry.source === 'TOGGL' 
                                      ? 'bg-pink-100 text-pink-800' 
                                      : 'bg-blue-100 text-blue-800'
                                  }`}>
                                      {entry.source}
                                  </span>
                              </td>
                              <td className="px-6 py-3 font-medium text-gray-800">{entry.project}</td>
                              <td className="px-6 py-3 text-gray-500 max-w-md truncate" title={entry.description}>
                                {entry.description}
                              </td>
                              <td className="px-6 py-3 text-right font-mono text-gray-700">{entry.duration.toFixed(2)} h</td>
                          </tr>
                      ))}
                  </tbody>
              </table>
              {filteredEntries.length === 0 && (
                <div className="p-10 text-center text-gray-400">Keine Einträge gefunden.</div>
              )}
          </div>
        </div>

      </div>
    </div>
  );
}

// Komponenten
function Card({ title, value, unit, color }: { title: string, value: string, unit: string, color: string }) {
    return (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
            <div className="flex items-baseline gap-1">
                <span className={`text-3xl font-bold ${color}`}>{value}</span>
                <span className="text-gray-400 font-medium">{unit}</span>
            </div>
        </div>
    );
}

export default App;
