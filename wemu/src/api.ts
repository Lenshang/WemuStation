import type { SystemInfo, GameEntry, AppConfig } from './types';

async function json<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

export const api = {
  config: () => json<AppConfig>('/api/config'),
  systems: () => json<SystemInfo[]>('/api/systems'),
  games: (sysId: string) =>
    json<{ games: GameEntry[]; hasGamelist: boolean }>(`/api/systems/${sysId}/games`),
  upload: async (sysId: string, files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f, f.name);
    const r = await fetch(`/api/upload?system=${encodeURIComponent(sysId)}`, {
      method: 'POST',
      body: fd
    });
    if (!r.ok) throw new Error(`upload failed: HTTP ${r.status}`);
    return r.json() as Promise<{ saved: string[] }>;
  }
};
