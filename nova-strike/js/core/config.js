// NOVA STRIKE — global balance, movement tuning, hero definitions, settings defaults.
// Original arena hero-shooter. Three hero archetypes share one controller.

export const Config = {
  arenaRadius: 38,
  killTarget: 15,
  matchTime: 360,
  respawnTime: 4,
  quality: 'auto',

  // movement tuning (shared controller)
  gravity: -24,
  jumpVel: 10.2,
  groundAccel: 70,      // units/s^2 toward wish speed
  groundDecel: 62,      // friction when no input
  airAccel: 34,
  airDecel: 6,          // momentum preserved in air
  flyAccel: 46,         // thruster response
  flyVertSpeed: 8.4,    // ascend/descend speed
  hoverSink: 0.6,       // gentle sink when energy empty
  flyEnergyDrain: 0.11, // per second ascending
  flyEnergyRegen: 0.22, // per second grounded
  flyMaxAlt: 26,
  ceilingSoft: 0.985,   // velocity retained at altitude cap (no hard stop)
  maxFall: -34,
  dashSpeed: 27,
  dashTime: 0.26,
  dashCd: 2.4,

  // combat feel
  chargeTime: 0.7,      // hold FIRE to charge
  chargeMul: 2.6,       // charged shot damage multiplier
  hitStopLight: 0.035,
  hitStopHeavy: 0.09,

  // stagger rules
  staggerLight: 0.32,   // light flinch duration
  staggerHeavy: 0.55,   // launch duration
  knockdownTime: 0.65,  // grounded winded time on landing
  knockdownInvuln: 1.1, // invulnerable while getting up
  staggerThreshold: 130,// dmg above this = heavy stagger
  launchThreshold: 210, // dmg above this = launched into air
  spawnInvuln: 2.0,
};

export const QualityTiers = {
  high:   { pixelRatio: 2,   shadows: true,  particles: 1.0,  antialias: true  },
  medium: { pixelRatio: 1.5, shadows: true,  particles: 0.6,  antialias: true  },
  low:    { pixelRatio: 1,   shadows: false, particles: 0.35, antialias: false },
};

export function pickQuality() {
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  if (mobile && (mem <= 3 || cores <= 4)) return 'low';
  if (mobile || mem <= 4) return 'medium';
  return 'high';
}

export const HeroAbilities = {
  vanguard: {
    fly: 'THRUSTERS',
    q: { key: 'Q', name: 'BARRAGE', cd: 7, desc: '5-bolt repulsor spread' },
    e: { key: 'E', name: 'ASCEND', cd: 0, desc: 'Hold to fly' },
  },
  phoenix: {
    fly: 'WINGS',
    q: { key: 'Q', name: 'NOVA BURST', cd: 9, desc: 'Knockback fire nova + burn' },
    e: { key: 'E', name: 'SOAR', cd: 0, desc: 'Airborne: glide · Ground: leap' },
  },
  inferno: {
    fly: 'COMET',
    q: { key: 'Q', name: 'FLAME DASH', cd: 6, desc: 'Burning dash' },
    e: { key: 'E', name: 'IGNITE', cd: 0, desc: 'Hold to fly' },
  },
};

// Shared hero archetypes. All run on the same CharacterController.
export const HEROES = {
  vanguard: {
    id: 'vanguard', name: 'IRON VANGUARD', title: 'Armored Avenger',
    desc: 'Repulsor bolts, rocket flight, piercing Unibeam.',
    hp: 1200, speed: 8.2, flySpeed: 12, dmg: 85, fireRate: 5.5, projSpeed: 55,
    chargeColor: 0x9fe8ff,
    colors: { primary: 0xb81f24, secondary: 0xd8a833, glow: 0x66d9ff, skin: 0xc9a06a },
    ult: { name: 'UNIBEAM', desc: 'Piercing chest beam' },
  },
  phoenix: {
    id: 'phoenix', name: 'SOL PHOENIX', title: 'Cosmic Firebird',
    desc: 'Seeking firebolts with burn, nova burst, rebirth storm.',
    hp: 950, speed: 8.6, flySpeed: 12, dmg: 70, fireRate: 4.2, projSpeed: 42,
    chargeColor: 0xffd98a,
    colors: { primary: 0x1f8a4c, secondary: 0xf5c542, glow: 0xff9a3c, skin: 0xe8b98a },
    ult: { name: 'FIRESTORM', desc: 'Skyfall meteors + self heal' },
  },
  inferno: {
    id: 'inferno', name: 'PYRO TORCH', title: 'Living Inferno',
    desc: 'Splash fireballs, flame dash, cataclysmic Supernova.',
    hp: 1050, speed: 9.0, flySpeed: 11.5, dmg: 95, fireRate: 3.2, projSpeed: 38,
    chargeColor: 0xffe08a,
    colors: { primary: 0x7a1410, secondary: 0xff7a1a, glow: 0xffc63c, skin: 0xff8a4a },
    ult: { name: 'SUPERNOVA', desc: 'Massive AoE detonation' },
  },
};

export const BOT_NAMES = ['Comet', 'Vex', 'Drift', 'Halo', 'Raptor', 'Nova'];

export const DefaultSettings = {
  sensitivity: 1.0,   // look multiplier 0.4 - 2.0
  buttonScale: 1.0,   // 0.75 - 1.35
  opacity: 0.8,       // 0.3 - 1.0
  aimAssist: true,
  quality: 'auto',
  invertY: false,
};
