import { fetchWithAuth, authPost, authPatch, authPut } from './authApi';

const API = '/api';

export interface TeamSummary {
  id: string;
  name: string;
  color: string;
  active: boolean;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamRecord {
  id: string;
  name: string;
  color: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listTeams(signal?: AbortSignal): Promise<TeamSummary[]> {
  const res = await fetchWithAuth<{ teams: TeamSummary[] }>(`${API}/teams`, { signal });
  return res.teams;
}

export async function createTeam(input: { name: string; color?: string }): Promise<TeamRecord> {
  const res = await authPost<{ team: TeamRecord }>(`${API}/teams`, input);
  return res.team;
}

export async function updateTeam(
  id: string,
  input: { name?: string; color?: string; active?: boolean },
): Promise<TeamRecord> {
  const res = await authPatch<{ team: TeamRecord }>(`${API}/teams/${id}`, input);
  return res.team;
}

export async function getTeamMembers(id: string): Promise<string[]> {
  const res = await fetchWithAuth<{ userIds: string[] }>(`${API}/teams/${id}/members`);
  return res.userIds;
}

export async function setTeamMembers(id: string, userIds: string[]): Promise<void> {
  await authPut(`${API}/teams/${id}/members`, { userIds });
}

export const PIPELINE_CONDITIONS = ['Used', 'New', 'Refurbished'] as const;
export type PipelineConditionLabel = (typeof PIPELINE_CONDITIONS)[number];
