// Navigation sound effects from the theme (navigationsounds.xml → <sound> elements)
export class SoundManager {
  private buffers = new Map<string, ArrayBuffer>();
  private ctx: AudioContext | null = null;
  enabled = true;

  async preload(themeRoot: string, sounds: Record<string, string>) {
    await Promise.all(Object.entries(sounds).map(async ([name, rawPath]) => {
      const url = new URL(rawPath.replace(/^\.\//, ''), themeRoot).href;
      try {
        const r = await fetch(url);
        if (!r.ok) return;
        this.buffers.set(name, await r.arrayBuffer());
      } catch { /* optional */ }
    }));
  }

  private audio(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try { this.ctx = new AudioContext(); } catch { return null; }
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  play(name: 'scroll' | 'back' | 'select' | 'launch' | 'systembrowse' | 'quicksysselect' | 'favorite') {
    const ac = this.audio();
    const raw = this.buffers.get(name);
    if (!ac || !raw) return;
    ac.decodeAudioData(raw.slice(0)).then((buf) => {
      const src = ac.createBufferSource();
      src.buffer = buf;
      src.connect(ac.destination);
      src.start();
    }).catch(() => {});
  }
}
