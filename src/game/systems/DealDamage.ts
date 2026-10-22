import * as THREE from 'three';
import type { TargetDummy } from '../TargetDummy';

export interface DamageResult {
  killed: boolean;
  actualDamage: number;
}

export interface DealDamageHooks {
  onConfirmedHit: () => void;
  onDamageNumber: (value: number, worldPos: THREE.Vector3) => void;
}

export class DealDamageSystem {
  private hooks: DealDamageHooks;

  constructor(hooks: DealDamageHooks) {
    this.hooks = hooks;
  }

  public apply = (
    target: TargetDummy,
    amount: number,
    hitPos: THREE.Vector3,
    knockback?: THREE.Vector3
  ): DamageResult => {
    const result = target.takeDamage(amount, hitPos, knockback);
    if (result.actualDamage > 0) {
      this.hooks.onConfirmedHit();
    }
    this.hooks.onDamageNumber(
      result.actualDamage,
      hitPos.clone().add(new THREE.Vector3(0, 0.4, 0))
    );
    return result;
  };
}

export default DealDamageSystem;
