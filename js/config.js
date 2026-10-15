// Central game data: heroes, balance, modes.
export const HEROES = [
 { id:'aegis', name:'AEGIS', icon:'🛡', role:'VANGUARD', diff:'★☆☆',
   desc:'Frontline bulwark. Holds points with a deployable Bastion Wall and seismic slam.',
   story:'Forged in the orbital foundries, AEGIS volunteered for the heaviest frame ever built — and never took a step back.',
   hp:650, speed:5.2, colors:{main:0x2b6cff, trim:0xffb300, glow:0x27e0ff, skin:0xc9a06a},
   weapon:{name:'ARC REPEATER', type:'hitscan', dmg:16, rpm:320, mag:40, spread:0.028, range:46, falloff:[20,46]},
   abilities:[
     {slot:'E', name:'BASTION WALL', desc:'Deploy an energy wall (450 HP, 6s) that blocks all fire.', cd:12},
     {slot:'SHIFT', name:'SEISMIC CHARGE', desc:'Dash forward, knocking up & damaging enemies (60).', cd:9}],
   ult:{name:'JUGGERNAUT DOME', desc:'6s dome shield + 2x fire rate. You are unstoppable.', charge:100},
   stats:{mob:2, dmg:3, surv:5} },
 { id:'volt', name:'VOLT', icon:'⚡', role:'DUELIST', diff:'★★☆',
   desc:'High-mobility skirmisher. Burst pulse rifle, blink dash and shock grenade.',
   story:'A storm-chaser who bottled lightning. VOLT strikes before the thunder is heard.',
   hp:420, speed:6.4, colors:{main:0x10131f, trim:0x27e0ff, glow:0xf6ff5c, skin:0xb98a5a},
   weapon:{name:'PULSE BURST', type:'hitscan', dmg:13, rpm:520, mag:30, spread:0.022, range:52, falloff:[24,52]},
   abilities:[
     {slot:'E', name:'SHOCK GRENADE', desc:'Arc grenade: 70 damage in 5m + slow.', cd:10},
     {slot:'SHIFT', name:'BLINK DASH', desc:'Instant 9m dash. 1s +40% speed after.', cd:7}],
   ult:{name:'OVERDRIVE', desc:'8s: infinite ammo, +60% fire rate, chain lightning hits.', charge:100},
   stats:{mob:5, dmg:4, surv:2} },
 { id:'hexa', name:'HEXA', icon:'✚', role:'STRATEGIST', diff:'★★☆',
   desc:'Combat medic. Healing beam tether + regenerative orb. Keeps the push alive.',
   story:'Six academies, six disciplines, one oath: no one flatlines on her watch.',
   hp:440, speed:5.8, colors:{main:0xe8f4ff, trim:0x37e08b, glow:0x37e08b, skin:0xd9a878},
   weapon:{name:'PRISM ORBS', type:'projectile', dmg:22, rpm:170, mag:20, speed:34, size:0.28, range:50},
   abilities:[
     {slot:'E', name:'MEND ORB', desc:'Lobbed orb: heals allies 90 in 5m / hurts foes 40.', cd:11},
     {slot:'SHIFT', name:'AEGIS PYLON', desc:'Deploy pylon healing allies 30/s for 6s (4m).', cd:13}],
   ult:{name:'RESTORATION NOVA', desc:'Massive burst: heal team 220 + cleanse + overshield.', charge:100},
   stats:{mob:3, dmg:2, surv:4} },
 { id:'ronin', name:'RONIN', icon:'🗡', role:'DUELIST', diff:'★★★',
   desc:'Melee assassin. Katana combo, wind shuriken, shadow-step behind enemies.',
   story:'The last blade of a fallen clan. Honor demands he end fights up close.',
   hp:460, speed:6.8, colors:{main:0x8f1020, trim:0x1a1a1a, glow:0xff4d6d, skin:0xcaa068},
   weapon:{name:'MOONBLADE', type:'melee', dmg:55, rpm:95, range:3.4, arc:1.1},
   abilities:[
     {slot:'E', name:'WIND SHURIKEN', desc:'Triple piercing shuriken (3×30).', cd:8},
     {slot:'SHIFT', name:'SHADOW STEP', desc:'Blink to behind targeted enemy + 30 bonus next slash.', cd:9}],
   ult:{name:'THOUSAND CUTS', desc:'5s: +80% speed, slashes hit all nearby, trail damage.', charge:100},
   stats:{mob:5, dmg:5, surv:2} },
 { id:'inferno', name:'INFERNO', icon:'🔥', role:'DUELIST', diff:'★★☆',
   desc:'Area denial artillery. Magma bolts, firewall, and a meteor ultimate.',
   story:'She walked out of the reactor fire carrying it with her. Now she throws it.',
   hp:450, speed:5.6, colors:{main:0x531104, trim:0xff6a00, glow:0xffb300, skin:0xb57e52},
   weapon:{name:'MAGMA BOLT', type:'projectile', dmg:38, rpm:110, mag:12, speed:26, size:0.4, splash:3.2, range:55},
   abilities:[
     {slot:'E', name:'FIREWALL', desc:'Wall of flame 6s: 25/s to enemies inside.', cd:12},
     {slot:'SHIFT', name:'ROCKET LEAP', desc:'Launch skyward + slam dealing 70 AoE on land.', cd:10}],
   ult:{name:'STARFALL METEOR', desc:'Call a meteor: 160 center / falloff to 8m after 1.2s delay.', charge:100},
   stats:{mob:3, dmg:5, surv:3} },
 { id:'spectre', name:'SPECTRE', icon:'◈', role:'DUELIST', diff:'★★★',
   desc:'Precision railgun sniper. Charge shots, recon pulse, tactical teleport.',
   story:'Nobody has seen SPECTRE and lived to describe the second encounter.',
   hp:400, speed:6.0, colors:{main:0x3a2b7a, trim:0xb49bff, glow:0xb49bff, skin:0x9a744c},
   weapon:{name:'RAILPIKE', type:'charged', dmg:95, rpm:55, mag:6, spread:0.002, range:90, falloff:[40,90]},
   abilities:[
     {slot:'E', name:'RECON PULSE', desc:'Reveal enemies through walls 5s + 40 dmg pulse.', cd:11},
     {slot:'SHIFT', name:'PHASE TELEPORT', desc:'Teleport 14m forward, brief untargetable.', cd:8}],
   ult:{name:'ORBITAL LANCE', desc:'Designate a 6m beam zone: 90/s for 4s from the sky.', charge:100},
   stats:{mob:4, dmg:5, surv:1} },
];
export const HERO_MAP = Object.fromEntries(HEROES.map(h=>[h.id,h]));
export const MODES = {
 control:{name:'CONVERGENCE', target:100, time:360, desc:'Hold the point to 100%'},
 tdm:{name:'TEAM CLASH', target:30, time:360, desc:'First team to 30 eliminations'},
 training:{name:'TRAINING RANGE', target:0, time:0, desc:'Practice freely'}
};
export const SETTINGS_DEFAULTS = { sens:1.2, aim:true, btnsize:1, opacity:0.9, quality:'med', music:0.5, sfx:0.8, shake:true };
