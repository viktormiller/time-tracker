import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { ArrowLeft, Save, Loader2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { calculateDuration } from '../lib/duration';
import { getTimezone } from '../lib/timezone';

const API_URL = '/api';

// Validation schema matching backend
const addEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'Start time must be in HH:mm format'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'End time must be in HH:mm format'),
  description: z.string().optional(),
  project: z.string().optional()
}).refine(
  (data) => {
    const [startHour, startMin] = data.startTime.split(':').map(Number);
    const [endHour, endMin] = data.endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  },
  {
    message: 'End time must be after start time',
    path: ['endTime']
  }
);

type AddEntryFormData = z.infer<typeof addEntrySchema>;

interface AddEntryProps {
  onBack: () => void;
  onSuccess: () => void;
  existingProjects: string[];
}

export function AddEntry({ onBack, onSuccess, existingProjects }: AddEntryProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showProjectSuggestions, setShowProjectSuggestions] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<AddEntryFormData>({
    resolver: zodResolver(addEntrySchema),
    defaultValues: {
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '17:00',
      description: '',
      project: ''
    }
  });

  const startTime = watch('startTime');
  const endTime = watch('endTime');
  const projectInput = watch('project');

  // Calculate live duration preview
  const duration = useMemo(() => {
    if (!startTime || !endTime) return null;
    try {
      const [startHour, startMin] = startTime.split(':').map(Number);
      const [endHour, endMin] = endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      if (endMinutes > startMinutes) {
        return calculateDuration(startTime, endTime);
      }
    } catch (e) {
      // Invalid time format
    }
    return null;
  }, [startTime, endTime]);

  // Filter project suggestions
  const projectSuggestions = useMemo(() => {
    if (!projectInput) return existingProjects;
    return existingProjects.filter(p =>
      p.toLowerCase().includes(projectInput.toLowerCase())
    );
  }, [projectInput, existingProjects]);

  const onSubmit = async (data: AddEntryFormData) => {
    setSubmitting(true);
    try {
      // Send timezone to backend for proper conversion
      const timezone = getTimezone();

      // Send the data with timezone - backend will handle conversion
      const payload = {
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        project: data.project,
        description: data.description,
        timezone: timezone
      };

      await axios.post(`${API_URL}/entries`, payload);
      alert('Entry created successfully!');
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create entry:', error);
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.map((e: any) => e.message).join('\n');
        alert(`Validation error:\n${errorMessages}`);
      } else {
        alert('Failed to create entry. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 p-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition"
            title="Back to dashboard"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Add Manual Entry</h1>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Date Field */}
            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date *
              </label>
              <input
                type="date"
                id="date"
                {...register('date')}
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm p-3 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.date && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.date.message}</p>
              )}
            </div>

            {/* Time Fields Row */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Time *
                </label>
                <input
                  type="time"
                  id="startTime"
                  {...register('startTime')}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm p-3 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors.startTime && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.startTime.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Time *
                </label>
                <input
                  type="time"
                  id="endTime"
                  {...register('endTime')}
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm p-3 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
                {errors.endTime && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.endTime.message}</p>
                )}
              </div>
            </div>

            {/* Duration Preview */}
            {duration !== null && (
              <div className="flex items-center gap-2 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <Clock size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                  Duration: {duration.toFixed(2)} hours
                </span>
              </div>
            )}

            {/* Project Field with Autocomplete */}
            <div className="relative">
              <label htmlFor="project" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project
              </label>
              <input
                type="text"
                id="project"
                {...register('project')}
                onFocus={() => setShowProjectSuggestions(true)}
                onBlur={() => setTimeout(() => setShowProjectSuggestions(false), 200)}
                placeholder="Start typing or select from existing projects"
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm p-3 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.project && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.project.message}</p>
              )}

              {/* Project Suggestions Dropdown */}
              {showProjectSuggestions && projectSuggestions.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {projectSuggestions.map((proj, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setValue('project', proj);
                        setShowProjectSuggestions(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-sm text-gray-700 dark:text-gray-200 first:rounded-t-lg last:rounded-b-lg"
                    >
                      {proj}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Description Field */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                id="description"
                {...register('description')}
                rows={4}
                placeholder="What did you work on?"
                className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 shadow-sm p-3 border focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description.message}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onBack}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 font-medium transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg font-medium transition shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Create Entry
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Help Text */}
        <div className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="font-medium mb-2">Tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Start and end times are used to automatically calculate duration</li>
            <li>Project field supports autocomplete from existing projects</li>
            <li>Manual entries will show with a "MANUAL" source badge</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
