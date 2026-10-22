/**
 * CooldownSystem.ts
 * Sistema compartilhado de recarga (cooldown) por chave nomeada.
 * Usado para gate de habilidades, dash e cadência de ataques sem depender de
 * estado duplicado em vários módulos.
 */

export class CooldownSystem {
  private durations = new Map<string, number>();
  private remaining = new Map<string, number>();

  /** Define a duração total de uma chave (não reinicia a recarga em andamento). */
  public setDuration(key: string, duration: number): void {
    this.durations.set(key, Math.max(0, duration));
  }

  public getDuration(key: string): number {
    return this.durations.get(key) ?? 0;
  }

  /** Inicia (ou reinicia) a recarga de uma chave. */
  public start(key: string, duration?: number): void {
    const total = duration ?? this.getDuration(key);
    this.setDuration(key, total);
    this.remaining.set(key, Math.max(0, total));
  }

  /** Decrementa todas as recargas ativas. */
  public update(dt: number): void {
    if (dt <= 0) return;
    for (const [key, value] of this.remaining) {
      const next = value - dt;
      if (next <= 0) {
        this.remaining.delete(key);
      } else {
        this.remaining.set(key, next);
      }
    }
  }

  /** Tempo restante em segundos. */
  public getRemaining(key: string): number {
    return this.remaining.get(key) ?? 0;
  }

  public isReady(key: string): boolean {
    return this.getRemaining(key) <= 0;
  }

  public reset(key?: string): void {
    if (key === undefined) {
      this.remaining.clear();
      return;
    }
    this.remaining.delete(key);
  }

  /** Fração decorrida [0..1] da recarga da chave (1 = pronta). */
  public progress(key: string): number {
    const total = this.getDuration(key);
    if (total <= 0) return 1;
    return 1 - Math.min(1, this.getRemaining(key) / total);
  }
}
