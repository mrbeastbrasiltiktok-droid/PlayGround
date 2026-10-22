/**
 * HealthSystem.ts
 * Sistema compartilhado de vida. Concentra o clamping, a aplicação de dano,
 * a cura e a razão de vida usada pelas barras de HUD.
 */

export interface HealthDamageResult {
  killed: boolean;
  actualDamage: number;
  remaining: number;
}

export class HealthSystem {
  /** Aplica dano não-negativo e retorna a vida restante (nunca abaixo de 0). */
  public static applyDamage(current: number, amount: number): number {
    return Math.max(0, current - Math.max(0, amount));
  }

  /** Aplica cura e retorna a vida (nunca acima do máximo). */
  public static applyHeal(current: number, amount: number, max: number): number {
    return this.clamp(current + Math.max(0, amount), max);
  }

  public static clamp(current: number, max: number): number {
    return Math.max(0, Math.min(max, current));
  }

  public static isDead(current: number): boolean {
    return current <= 0;
  }

  /** Razão de vida normalizada entre 0 e 1 (segura para máximo zero). */
  public static ratio(current: number, max: number): number {
    if (max <= 0) return 0;
    return Math.max(0, Math.min(1, current / max));
  }

  public static percent(current: number, max: number): number {
    return this.ratio(current, max) * 100;
  }
}
