/**
 * DamageSystem.ts
 * Sistema compartilhado de resolução de dano.
 * Centraliza a matemática de mitigação (Invulnerável / Escudo) e a decisão de
 * aplicar recuo físico, que antes estava duplicada em TargetDummy e nos
 * callbacks de impacto da GameScene.
 */

import { gameplayRestrictions } from '../GameplayRestrictions';

export interface DamageMitigationOptions {
  /** Multiplicador aplicado quando a restrição IsShield está ativa. */
  shieldMultiplier?: number;
  /** Dano mínimo garantido mesmo com mitigação de escudo. */
  minimumDamage?: number;
}

export interface DamageResolution {
  /** Dano efetivamente aplicado (0 quando imune ou já morto). */
  actualDamage: number;
  /** Se o impacto foi bloqueado por invulnerabilidade. */
  immune: boolean;
  /** Se o recuo deve ser aplicado (ou seja, o alvo não está Anchored). */
  appliesKnockback: boolean;
}

export class DamageSystem {
  public static readonly SHIELD_MULTIPLIER = 0.5;
  public static readonly MINIMUM_DAMAGE = 1;

  /** Dano base com a mitigação de todas as restrições ativas. */
  public static mitigate(amount: number, options: DamageMitigationOptions = {}): number {
    if (this.isImmune()) return 0;
    if (gameplayRestrictions.hasRestriction('IsShield')) {
      const multiplier = options.shieldMultiplier ?? this.SHIELD_MULTIPLIER;
      const minimum = options.minimumDamage ?? this.MINIMUM_DAMAGE;
      return Math.max(minimum, Math.round(amount * multiplier));
    }
    return amount;
  }

  /**
   * Resolve um impacto completo: imunidade, mitigação e recuo.
   * Não altera a vida do alvo; apenas calcula o resultado.
   */
  public static resolve(
    amount: number,
    options: DamageMitigationOptions = {}
  ): DamageResolution {
    if (this.isImmune()) {
      return { actualDamage: 0, immune: true, appliesKnockback: false };
    }
    return {
      actualDamage: this.mitigate(amount, options),
      immune: false,
      appliesKnockback: this.allowsKnockback(),
    };
  }

  public static isImmune(): boolean {
    return gameplayRestrictions.hasRestriction('Invulnerable');
  }

  public static allowsKnockback(): boolean {
    return !gameplayRestrictions.hasRestriction('Anchored');
  }
}
