import { ExternalLink } from 'lucide-react';

interface Props {
  project: string;
  source: string;
  jiraBaseUrl: string | null;
}

// Regex to detect Jira issue key pattern (e.g., ABC-123, PROJ-1)
const JIRA_KEY_REGEX = /^([A-Z][A-Z0-9]+-\d+)/;

/**
 * Displays project name with clickable Jira link for Tempo entries.
 * Format from backend: "ABC-27 - Project Name" or just "ABC-27"
 */
export function ProjectCell({ project, source, jiraBaseUrl }: Props) {
  // Only process Tempo entries for Jira links
  if (source !== 'TEMPO' || !jiraBaseUrl || !project) {
    return <span className="font-medium text-gray-800">{project || '-'}</span>;
  }

  // Extract issue key from project string
  const match = project.match(JIRA_KEY_REGEX);
  if (!match) {
    return <span className="font-medium text-gray-800">{project}</span>;
  }

  const issueKey = match[1];
  const issueUrl = `${jiraBaseUrl}/browse/${issueKey}`;

  // Display: clickable key + remaining project name
  const remainingText = project.slice(issueKey.length).replace(/^\s*-\s*/, '');

  return (
    <span className="font-medium">
      <a
        href={issueUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
        title={`Open ${issueKey} in Jira`}
      >
        {issueKey}
        <ExternalLink size={12} className="opacity-50" />
      </a>
      {remainingText && <span className="text-gray-600"> - {remainingText}</span>}
    </span>
  );
}

export default ProjectCell;
