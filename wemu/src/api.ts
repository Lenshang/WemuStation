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
  favorites: () => json<string[]>('/api/favorites'),
  toggleFavorite: async (key: string): Promise<{ favorite: boolean }> => {
    const r = await fetch('/api/favorites/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key })
    });
    return r.json() as Promise<{ favorite: boolean }>;
  },
  favoriteGames: () => json<{ games: GameEntry[] }>('/api/favorite-games').then((r) => r.games),
  recentGames: () => json<{ games: GameEntry[] }>('/api/recent-games').then((r) => r.games),
  recentAdd: async (g: { sysId: string; fileName: string; name: string; image: string; video: string; url: string }) => {
    await fetch('/api/recent-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(g)
    });
  },
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
