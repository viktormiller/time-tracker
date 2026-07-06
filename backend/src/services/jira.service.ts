import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { loadSecret } from '../utils/secrets';

export interface JiraIssueInfo {
  issueKey: string;
  summary: string | null;
  projectName: string | null;
}

// Kind to Jira rate limits: at most 5 issue lookups in flight
const BATCH_SIZE = 5;

/**
 * Resolves numeric Jira issue IDs (all the Tempo v4 API returns) to issue
 * keys, summaries and project names via the Jira REST API.
 *
 * Resolutions are cached in the JiraIssueCache table, so each issue is
 * fetched from Jira at most once — subsequent syncs are pure DB lookups.
 *
 * Configuration (all three required for API lookups, cache works without):
 *   JIRA_BASE_URL   e.g. https://schubwerk.atlassian.net
 *   jira_email      Docker secret or JIRA_EMAIL env var (Atlassian account email)
 *   jira_api_token  Docker secret or JIRA_API_TOKEN env var
 */
export class JiraIssueResolver {
  constructor(private prisma: PrismaClient) {}

  isConfigured(): boolean {
    return !!(
      process.env.JIRA_BASE_URL &&
      loadSecret('jira_email', { required: false }) &&
      loadSecret('jira_api_token', { required: false })
    );
  }

  /**
   * Resolve issue IDs from cache first, then fetch missing ones from Jira.
   * IDs that cannot be resolved (Jira not configured, issue deleted, no
   * permission) are simply absent from the returned map.
   */
  async resolveIssueIds(issueIds: string[]): Promise<Map<string, JiraIssueInfo>> {
    const resolved = new Map<string, JiraIssueInfo>();
    const uniqueIds = Array.from(new Set(issueIds));
    if (uniqueIds.length === 0) return resolved;

    const cached = await this.prisma.jiraIssueCache.findMany({
      where: { issueId: { in: uniqueIds } },
    });
    for (const entry of cached) {
      resolved.set(entry.issueId, {
        issueKey: entry.issueKey,
        summary: entry.summary,
        projectName: entry.projectName,
      });
    }

    const missing = uniqueIds.filter((id) => !resolved.has(id));
    if (missing.length === 0 || !this.isConfigured()) return resolved;

    console.log(`[Jira] Resolving ${missing.length} issue IDs via Jira API...`);

    for (let i = 0; i < missing.length; i += BATCH_SIZE) {
      const batch = missing.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((id) => this.fetchIssue(id)));

      for (let j = 0; j < batch.length; j++) {
        const id = batch[j];
        const result = results[j];
        if (result.status === 'rejected') {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          console.warn(`[Jira] Failed to resolve issue ${id}: ${reason}`);
          continue;
        }
        if (!result.value) continue; // 404: issue deleted or not visible — keep fallback display

        resolved.set(id, result.value);
        await this.prisma.jiraIssueCache.upsert({
          where: { issueId: id },
          update: result.value,
          create: { issueId: id, ...result.value },
        });
      }
    }

    return resolved;
  }

  private async fetchIssue(issueId: string): Promise<JiraIssueInfo | null> {
    const baseUrl = (process.env.JIRA_BASE_URL as string).replace(/\/+$/, '');
    const email = loadSecret('jira_email', { required: false }) as string;
    const token = loadSecret('jira_api_token', { required: false }) as string;

    try {
      const response = await axios.get(`${baseUrl}/rest/api/3/issue/${issueId}`, {
        params: { fields: 'summary,project' },
        auth: { username: email, password: token },
      });
      return {
        issueKey: response.data.key,
        summary: response.data.fields?.summary ?? null,
        projectName: response.data.fields?.project?.name ?? null,
      };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) return null;
      throw error;
    }
  }
}
