import { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, X } from 'lucide-react';

const API_URL = '/api';

interface EstimateProject {
  id: string;
  projectName: string;
}

interface ProjectWithContext {
  name: string;
  totalHours: number;
  entryCount: number;
}

interface Estimate {
  id: string;
  clientName: string;
  name: string;
  estimatedHours: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  projects: EstimateProject[];
  actualHours?: number;
  percentage?: number;
  status?: 'green' | 'yellow' | 'red';
}

interface EstimatesProps {
  onBack: () => void;
}

export function Estimates({ onBack }: EstimatesProps) {
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ProjectWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    clientName: '',
    name: '',
    estimatedHours: 0,
    notes: '',
    projects: [] as string[],
  });
  const [projectInput, setProjectInput] = useState('');
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  useEffect(() => {
    fetchEstimates();
    fetchAvailableProjects();
  }, []);

  const fetchEstimates = async () => {
    setLoading(true);
    try {
      const response = await axios.get<Estimate[]>(`${API_URL}/estimates`);
      setEstimates(response.data);
    } catch (err) {
      console.error('Failed to fetch estimates:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableProjects = async () => {
    try {
      const response = await axios.get<ProjectWithContext[]>(`${API_URL}/projects/unique`);
      setAvailableProjects(response.data);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  };

  const openModal = (estimate?: Estimate) => {
    if (estimate) {
      setEditingEstimate(estimate);
      setFormData({
        clientName: estimate.clientName,
        name: estimate.name,
        estimatedHours: estimate.estimatedHours,
        notes: estimate.notes || '',
        projects: estimate.projects.map(p => p.projectName),
      });
    } else {
      setEditingEstimate(null);
      setFormData({
        clientName: '',
        name: '',
        estimatedHours: 0,
        notes: '',
        projects: [],
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingEstimate(null);
    setProjectInput('');
    setShowProjectDropdown(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.projects.length === 0) {
      alert('Bitte mindestens ein Projekt auswählen');
      return;
    }

    try {
      if (editingEstimate) {
        await axios.put(`${API_URL}/estimates/${editingEstimate.id}`, formData);
      } else {
        await axios.post(`${API_URL}/estimates`, formData);
      }
      closeModal();
      fetchEstimates();
    } catch (err) {
      console.error('Failed to save estimate:', err);
      alert('Fehler beim Speichern der Schätzung');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Möchtest du diese Schätzung wirklich löschen?')) return;

    try {
      await axios.delete(`${API_URL}/estimates/${id}`);
      fetchEstimates();
    } catch (err) {
      console.error('Failed to delete estimate:', err);
      alert('Fehler beim Löschen der Schätzung');
    }
  };

  const addProject = (projectName: string) => {
    if (projectName && !formData.projects.includes(projectName)) {
      setFormData({ ...formData, projects: [...formData.projects, projectName] });
    }
    setProjectInput('');
    setShowProjectDropdown(false);
  };

  const removeProject = (projectName: string) => {
    setFormData({
      ...formData,
      projects: formData.projects.filter(p => p !== projectName),
    });
  };

  const filteredProjects = availableProjects.filter(
    p => p.name.toLowerCase().includes(projectInput.toLowerCase()) && !formData.projects.includes(p.name)
  );

  const getProgressBarColor = (status?: 'green' | 'yellow' | 'red') => {
    switch (status) {
      case 'green':
        return 'bg-green-500 dark:bg-green-600';
      case 'yellow':
        return 'bg-yellow-500 dark:bg-yellow-600';
      case 'red':
        return 'bg-red-500 dark:bg-red-600';
      default:
        return 'bg-gray-300 dark:bg-gray-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
              title="Zurück zum Dashboard"
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Schätzungen</h1>
          </div>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium"
          >
            <Plus size={20} />
            Neue Schätzung
          </button>
        </div>

        {/* Estimates List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-gray-400" />
          </div>
        ) : estimates.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 p-12 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
            <p className="text-gray-500 dark:text-gray-400">Noch keine Schätzungen vorhanden</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {estimates.map((estimate) => (
              <div
                key={estimate.id}
                className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                      {estimate.clientName} - {estimate.name}
                    </h3>
                    {estimate.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{estimate.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openModal(estimate)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                      title="Bearbeiten"
                    >
                      <Pencil size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(estimate.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition"
                      title="Löschen"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Project badges */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {estimate.projects.map((project) => (
                    <span
                      key={project.id}
                      className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
                    >
                      {project.projectName}
                    </span>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Fortschritt</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {estimate.actualHours?.toFixed(1)} / {estimate.estimatedHours.toFixed(1)} Stunden ({estimate.percentage?.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${getProgressBarColor(estimate.status)} transition-all duration-300`}
                      style={{ width: `${Math.min((estimate.percentage || 0), 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editingEstimate ? 'Schätzung bearbeiten' : 'Neue Schätzung'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Client Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Kundenname
                  </label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Estimate Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Bezeichnung
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Estimated Hours */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Geschätzte Stunden
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.estimatedHours}
                    onChange={(e) => setFormData({ ...formData, estimatedHours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notizen (optional)
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={3}
                  />
                </div>

                {/* Projects */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Projekte
                  </label>

                  {/* Selected projects */}
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.projects.map((project) => (
                      <span
                        key={project}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-sm"
                      >
                        {project}
                        <button
                          type="button"
                          onClick={() => removeProject(project)}
                          className="hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full p-0.5"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Project input */}
                  <div className="relative">
                    <input
                      type="text"
                      value={projectInput}
                      onChange={(e) => {
                        setProjectInput(e.target.value);
                        setShowProjectDropdown(true);
                      }}
                      onFocus={() => setShowProjectDropdown(true)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Projekt suchen oder eingeben..."
                    />

                    {/* Dropdown */}
                    {showProjectDropdown && (projectInput.length > 0 || filteredProjects.length > 0) && (
                      <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredProjects.length > 0 ? (
                          filteredProjects.map((project) => (
                            <button
                              key={project.name}
                              type="button"
                              onClick={() => addProject(project.name)}
                              className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-gray-600 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-medium text-gray-900 dark:text-white">
                                  {project.name}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {project.totalHours.toFixed(1)}h · {project.entryCount} {project.entryCount === 1 ? 'Eintrag' : 'Einträge'}
                                </span>
                              </div>
                            </button>
                          ))
                        ) : projectInput.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => addProject(projectInput)}
                            className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                          >
                            "{projectInput}" hinzufügen
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                  >
                    Abbrechen
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition font-medium"
                  >
                    {editingEstimate ? 'Speichern' : 'Erstellen'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
