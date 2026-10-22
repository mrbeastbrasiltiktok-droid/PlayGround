export interface CooldownEntry {
  remaining: number;
  total: number;
}

export class CooldownSystem {
  private entries = new Map<string, CooldownEntry>();

  public start(id: string, duration: number): void {
    const total = Math.max(0, duration);
    this.entries.set(id, { remaining: total, total });
  }

  public update(dt: number): void {
    for (const entry of this.entries.values()) {
      entry.remaining = Math.max(0, entry.remaining - Math.max(0, dt));
    }
  }

  public remaining(id: string): number {
    return this.entries.get(id)?.remaining ?? 0;
  }

  public total(id: string): number {
    return this.entries.get(id)?.total ?? 0;
  }

  public isReady(id: string): boolean {
    return this.remaining(id) <= 0;
  }

  public reset(id: string): void {
    this.entries.delete(id);
  }

  public clear(): void {
    this.entries.clear();
  }
}

export default CooldownSystem;
