interface CooldownEntry {
  total: number;
  remaining: number;
}

/**
 * Small shared clock used by HUD actions. The system owns only timers; ability
 * definitions and visuals remain in their own modules.
 */
export class CooldownSystem {
  private entries = new Map<string, CooldownEntry>();

  public start(id: string, duration: number): void {
    this.entries.set(id, { total: Math.max(0, duration), remaining: Math.max(0, duration) });
  }

  public update(dt: number): void {
    for (const entry of this.entries.values()) {
      entry.remaining = Math.max(0, entry.remaining - dt);
    }
  }

  public remaining(id: string): number {
    return this.entries.get(id)?.remaining || 0;
  }

  public total(id: string): number {
    return this.entries.get(id)?.total || 0;
  }

  public isReady(id: string): boolean {
    return this.remaining(id) <= 0;
  }

  public reset(id?: string): void {
    if (id) this.entries.delete(id);
    else this.entries.clear();
  }
}
