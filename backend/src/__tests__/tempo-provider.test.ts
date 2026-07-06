import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { TempoProvider } from '../providers/tempo.provider';
import { JiraIssueInfo } from '../services/jira.service';

vi.mock('axios');

const makeProvider = () => new TempoProvider({} as any);

const baseWorklog = {
  tempoWorklogId: 12345,
  timeSpentSeconds: 5400, // 1.5h
  startDate: '2026-07-01',
  description: '',
};

describe('TempoProvider.transformEntry', () => {
  it('uses resolved Jira data for numeric issue IDs (Tempo v4 format)', () => {
    const provider = makeProvider();
    (provider as any).resolvedIssues = new Map<string, JiraIssueInfo>([
      ['41013', { issueKey: 'WEKA-280', summary: 'Letzte Fragen für ASI GoLive', projectName: 'TALENTUS' }],
    ]);

    const entry = provider.transformEntry({
      ...baseWorklog,
      issue: { id: 41013, self: 'https://api.tempo.io/4/issues/41013' },
    });

    expect(entry.project).toBe('WEKA-280 - TALENTUS');
    expect(entry.description).toBe('Letzte Fragen für ASI GoLive'); // summary fallback
    expect(entry.duration).toBe(1.5);
    expect(entry.externalId).toBe('12345');
  });

  it('falls back to "Issue #<id>" when the ID cannot be resolved', () => {
    const provider = makeProvider();
    (provider as any).resolvedIssues = new Map();

    const entry = provider.transformEntry({
      ...baseWorklog,
      issue: { id: 41013 },
    });

    expect(entry.project).toBe('Issue #41013');
  });

  it('still supports responses that carry issue.key directly', () => {
    const provider = makeProvider();
    (provider as any).resolvedIssues = new Map();

    const entry = provider.transformEntry({
      ...baseWorklog,
      issue: { key: 'ABC-27', project: { name: 'Demo' } },
    });

    expect(entry.project).toBe('ABC-27 - Demo');
  });

  it('keeps a real worklog comment over the issue summary', () => {
    const provider = makeProvider();
    (provider as any).resolvedIssues = new Map<string, JiraIssueInfo>([
      ['41013', { issueKey: 'WEKA-280', summary: 'Issue Summary', projectName: 'TALENTUS' }],
    ]);

    const entry = provider.transformEntry({
      ...baseWorklog,
      description: 'Deployment vorbereitet',
      issue: { id: 41013 },
    });

    expect(entry.description).toBe('Deployment vorbereitet');
  });

  it('replaces Tempo\'s auto-generated "Working on issue" placeholder with the summary', () => {
    const provider = makeProvider();
    (provider as any).resolvedIssues = new Map<string, JiraIssueInfo>([
      ['41013', { issueKey: 'WEKA-280', summary: 'Issue Summary', projectName: 'TALENTUS' }],
    ]);

    const entry = provider.transformEntry({
      ...baseWorklog,
      description: 'Working on issue #41013',
      issue: { id: 41013 },
    });

    expect(entry.description).toBe('Issue Summary');
  });
});

describe('TempoProvider.fetchFromAPI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TEMPO_API_TOKEN = 'test-token';
  });

  it('follows metadata.next across pages and merges all results', async () => {
    const provider = makeProvider();

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        results: [{ tempoWorklogId: 1 }, { tempoWorklogId: 2 }],
        metadata: { next: 'https://api.tempo.io/4/worklogs?offset=1000&limit=1000' },
      },
    });
    vi.mocked(axios.get).mockResolvedValueOnce({
      data: {
        results: [{ tempoWorklogId: 3 }],
        metadata: {},
      },
    });

    const results = await provider.fetchFromAPI('2026-01-01', '2026-07-01');

    expect(results.map((r) => r.tempoWorklogId)).toEqual([1, 2, 3]);
    expect(axios.get).toHaveBeenCalledTimes(2);
    // First call carries the query params, second call uses the next-URL as-is
    expect(vi.mocked(axios.get).mock.calls[0][0]).toBe('https://api.tempo.io/4/worklogs');
    expect(vi.mocked(axios.get).mock.calls[1][0]).toBe('https://api.tempo.io/4/worklogs?offset=1000&limit=1000');
    expect((vi.mocked(axios.get).mock.calls[1][1] as any).params).toBeUndefined();
  });

  it('returns a single page when there is no next link', async () => {
    const provider = makeProvider();

    vi.mocked(axios.get).mockResolvedValueOnce({
      data: { results: [{ tempoWorklogId: 7 }], metadata: { count: 1 } },
    });

    const results = await provider.fetchFromAPI('2026-06-01', '2026-07-01');

    expect(results).toHaveLength(1);
    expect(axios.get).toHaveBeenCalledTimes(1);
  });
});
