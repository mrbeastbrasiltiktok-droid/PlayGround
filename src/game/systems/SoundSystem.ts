import { audioSystem, AudioSystem } from '../AudioSystem';

export type SoundEvent =
  | 'attack-cast'
  | 'impact'
  | 'hit'
  | 'destroy'
  | 'ui-click'
  | 'error'
  | 'repulsor'
  | 'missile-launch'
  | 'explosion'
  | 'beam-burst'
  | 'beam-clash'
  | 'laser-spin'
  | 'thruster-dash'
  | 'flight-toggle'
  | 'unibeam-charge'
  | 'arcane-blast'
  | 'dark-drain-pulse'
  | 'shadow-step'
  | 'arcane-flight'
  | 'arcane-choke-start'
  | 'arcane-choke-tick'
  | 'chaos-orb-cast'
  | 'chaos-orb-impact'
  | 'runic-ward';

/**
 * Central sound routing for gameplay modules. The synthesizer stays in
 * AudioSystem; this layer gives abilities and systems stable semantic events
 * instead of coupling them to individual oscillator methods.
 */
export class SoundSystem {
  private backend: AudioSystem;

  constructor(backend: AudioSystem = audioSystem) {
    this.backend = backend;
  }

  public setBackend(backend: AudioSystem): void {
    this.backend = backend;
  }

  public play(event: SoundEvent, payload?: { flying?: boolean }): void {
    switch (event) {
      case 'attack-cast': this.backend.playAttackCast(); break;
      case 'impact': this.backend.playImpact(); break;
      case 'hit': this.backend.playHit(); break;
      case 'destroy': this.backend.playDestroy(); break;
      case 'ui-click': this.backend.playUiClick(); break;
      case 'error': this.backend.playError(); break;
      case 'repulsor': this.backend.playRepulsor(); break;
      case 'missile-launch': this.backend.playMissileLaunch(); break;
      case 'explosion': this.backend.playExplosion(); break;
      case 'beam-burst': this.backend.playBeamBurst(); break;
      case 'beam-clash': this.backend.playBeamClash(); break;
      case 'laser-spin': this.backend.playLaserSpin(); break;
      case 'thruster-dash': this.backend.playThrusterDash(); break;
      case 'flight-toggle': this.backend.playFlightToggle(payload?.flying ?? false); break;
      case 'unibeam-charge': this.backend.playUnibeamCharge(); break;
      case 'arcane-blast': this.backend.playArcaneBlast(); break;
      case 'dark-drain-pulse': this.backend.playDarkDrainPulse(); break;
      case 'shadow-step': this.backend.playShadowStep(); break;
      case 'arcane-flight': this.backend.playArcaneFlight(payload?.flying ?? false); break;
      case 'arcane-choke-start': this.backend.playArcaneChokeStart(); break;
      case 'arcane-choke-tick': this.backend.playArcaneChokeTick(); break;
      case 'chaos-orb-cast': this.backend.playChaosOrbCast(); break;
      case 'chaos-orb-impact': this.backend.playChaosOrbImpact(); break;
      case 'runic-ward': this.backend.playRunicWard(); break;
    }
  }

  public playAttackCast(): void { this.play('attack-cast'); }
  public playImpact(): void { this.play('impact'); }
  public playHit(): void { this.play('hit'); }
  public playDestroy(): void { this.play('destroy'); }
  public playUiClick(): void { this.play('ui-click'); }
  public playError(): void { this.play('error'); }
  public playRepulsor(): void { this.play('repulsor'); }
  public playMissileLaunch(): void { this.play('missile-launch'); }
  public playExplosion(): void { this.play('explosion'); }
  public playBeamBurst(): void { this.play('beam-burst'); }
  public playBeamClash(): void { this.play('beam-clash'); }
  public playLaserSpin(): void { this.play('laser-spin'); }
  public playThrusterDash(): void { this.play('thruster-dash'); }
  public playFlightToggle(isFlying: boolean): void { this.play('flight-toggle', { flying: isFlying }); }
  public playUnibeamCharge(): void { this.play('unibeam-charge'); }
  public playArcaneBlast(): void { this.play('arcane-blast'); }
  public playDarkDrainPulse(): void { this.play('dark-drain-pulse'); }
  public playShadowStep(): void { this.play('shadow-step'); }
  public playArcaneFlight(isFlying: boolean): void { this.play('arcane-flight', { flying: isFlying }); }
  public playArcaneChokeStart(): void { this.play('arcane-choke-start'); }
  public playArcaneChokeTick(): void { this.play('arcane-choke-tick'); }
  public playChaosOrbCast(): void { this.play('chaos-orb-cast'); }
  public playChaosOrbImpact(): void { this.play('chaos-orb-impact'); }
  public playRunicWard(): void { this.play('runic-ward'); }
}

export const soundSystem = new SoundSystem();
