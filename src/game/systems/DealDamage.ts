import * as THREE from 'three';

export interface DamageableTarget {
  takeDamage(
    amount: number,
    hitPosition?: THREE.Vector3,
    knockback?: THREE.Vector3
  ): { actualDamage: number; [key: string]: unknown };
}

export interface FloatingDamageNumber {
  id: number;
  value: number;
  worldPos: THREE.Vector3;
  age: number;
  maxAge: number;
}

export interface DamageContext {
  damageNumbers?: FloatingDamageNumber[];
  allocateDamageId?: () => number;
  onConfirmed?: () => void;
}

export interface DamageResult {
  actualDamage: number;
  confirmed: boolean;
  numberId?: number;
}

/**
 * Single damage entry point for abilities, projectiles and runtime scripts.
 * Keeping hit confirmation, floating numbers and target feedback here prevents
 * the three previously divergent damage callbacks from drifting apart.
 */
export function dealDamage(
  target: DamageableTarget,
  amount: number,
  hitPosition: THREE.Vector3,
  knockback?: THREE.Vector3,
  context: DamageContext = {}
): DamageResult {
  const result = target.takeDamage(amount, hitPosition, knockback);
  const confirmed = result.actualDamage > 0;

  if (confirmed) context.onConfirmed?.();

  let numberId: number | undefined;
  if (context.damageNumbers && context.allocateDamageId) {
    numberId = context.allocateDamageId();
    context.damageNumbers.push({
      id: numberId,
      value: result.actualDamage,
      worldPos: hitPosition.clone().add(new THREE.Vector3(0, 0.4, 0)),
      age: 0,
      maxAge: 0.95,
    });
  }

  return { actualDamage: result.actualDamage, confirmed, numberId };
}
