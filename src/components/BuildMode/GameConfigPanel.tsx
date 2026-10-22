/**
 * GameConfigPanel.tsx
 * Painel de ajustes do jogo em tempo real.
 * Todos os controles abaixo são ligados diretamente aos gerentes reais do jogo
 * (LiveConfigManager, SettingsManager, AgathaConfig e IronManConfig); não existe
 * nenhum controle decorativo.
 */

import React, { useEffect, useState } from 'react';
import { ArrowLeft, RotateCcw, SlidersHorizontal } from 'lucide-react';
import {
  liveConfigManager,
  DEFAULT_LIVE_CONFIG,
  LiveGameConfig,
} from '../../game/LiveConfigManager';
import {
  settingsManager,
  DEFAULT_SETTINGS,
  GameSettings,
} from '../../game/SettingsManager';
import {
  activeAgathaConfig,
  updateAgathaConfig,
  resetAgathaConfig,
  DEFAULT_AGATHA_CONFIG,
} from '../../game/abilities/agatha/AgathaConfig';
import {
  activeIronManConfig,
  updateIronManConfig,
  resetIronManConfig,
  DEFAULT_IRONMAN_CONFIG,
} from '../../game/abilities/ironman/IronManConfig';
import { audioSystem } from '../../game/AudioSystem';

interface GameConfigPanelProps {
  onBack: () => void;
}

const Section: React.FC<{
  title: string;
  onReset: () => void;
  children: React.ReactNode;
}> = ({ title, onReset, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <section className="border border-[#27272a] rounded bg-[#121215]">
      <header className="flex items-center justify-between px-3 py-2 border-b border-[#27272a]">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white"
        >
          <SlidersHorizontal size={13} className="text-[#a1a1aa]" />
          {title}
        </button>
        <button
          onClick={() => {
            audioSystem.playUiClick?.();
            onReset();
          }}
          className="flex items-center gap-1 text-[10px] text-[#a1a1aa] hover:text-amber-400 transition-colors"
          title="Restaurar valores padrão desta seção"
        >
          <RotateCcw size={11} />
          Padrões
        </button>
      </header>
      {open && <div className="p-3 space-y-3">{children}</div>}
    </section>
  );
};

const NumberRow: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
}> = ({ label, value, min, max, step = 0.01, unit, onChange }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-[#d4d4d8]">{label}</span>
      <span className="font-mono text-[#a1a1aa]">
        {value}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-emerald-500"
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        className="w-16 bg-[#18181b] border border-[#27272a] rounded px-1.5 py-0.5 text-[11px] font-mono text-white focus:outline-none focus:border-zinc-500"
      />
    </div>
  </div>
);

const ToggleRow: React.FC<{
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between text-[11px] cursor-pointer">
    <span className="text-[#d4d4d8]">{label}</span>
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`w-9 h-5 rounded-full transition-colors relative ${
        value ? 'bg-emerald-600' : 'bg-[#3f3f46]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
          value ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  </label>
);

const ColorRow: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between text-[11px]">
    <span className="text-[#d4d4d8]">{label}</span>
    <div className="flex items-center gap-2">
      <span className="font-mono text-[#a1a1aa]">{value}</span>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-7 h-6 bg-transparent border border-[#27272a] rounded cursor-pointer"
      />
    </div>
  </label>
);

const SelectRow: React.FC<{
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <label className="flex items-center justify-between text-[11px]">
    <span className="text-[#d4d4d8]">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-[#18181b] border border-[#27272a] rounded px-2 py-0.5 text-[11px] text-white focus:outline-none focus:border-zinc-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

export const GameConfigPanel: React.FC<GameConfigPanelProps> = ({ onBack }) => {
  const [live, setLive] = useState<LiveGameConfig>(liveConfigManager.get());
  const [settings, setSettings] = useState<GameSettings>(settingsManager.get());
  const [, setVersion] = useState(0);

  useEffect(() => {
    const unsubLive = liveConfigManager.subscribe(setLive);
    const unsubSettings = settingsManager.subscribe(setSettings);
    return () => {
      unsubLive();
      unsubSettings();
    };
  }, []);

  const patchLive = (key: keyof LiveGameConfig, value: number | string) => {
    liveConfigManager.update({ [key]: value } as Partial<LiveGameConfig>);
  };
  const patchSettings = (key: keyof GameSettings, value: number | boolean | string) => {
    settingsManager.update({ [key]: value } as Partial<GameSettings>);
  };
  const patchAgatha = (group: string, key: string, value: number | string) => {
    updateAgathaConfig({ [group]: { [key]: value } } as any);
    setVersion((v) => v + 1);
  };
  const patchIronMan = (group: string, key: string, value: number | string) => {
    updateIronManConfig({ [group]: { [key]: value } } as any);
    setVersion((v) => v + 1);
  };

  const agatha = activeAgathaConfig;
  const ironman = activeIronManConfig;

  return (
    <div className="flex-1 flex flex-col bg-[#09090b] min-w-0 overflow-hidden">
      <div className="h-10 border-b border-[#27272a] bg-[#121215] flex items-center gap-3 px-3 md:px-4 shrink-0">
        <button
          onClick={() => {
            audioSystem.playUiClick?.();
            onBack();
          }}
          className="flex items-center gap-1.5 px-2 py-1 rounded border border-[#27272a] hover:bg-[#1f1f23] text-[#a1a1aa] hover:text-white text-[11px]"
        >
          <ArrowLeft size={13} />
          Voltar ao Código
        </button>
        <span className="text-xs font-semibold uppercase tracking-wider text-white">
          Ajustes do Jogo em Tempo Real
        </span>
        <span className="text-[10px] text-[#71717a] hidden sm:inline">
          Alterações são aplicadas imediatamente e persistidas no navegador.
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3 items-start">
        <Section
          title="Câmera"
          onReset={() =>
            liveConfigManager.update({
              cameraFov: DEFAULT_LIVE_CONFIG.cameraFov,
              cameraDistance: DEFAULT_LIVE_CONFIG.cameraDistance,
              cameraHeight: DEFAULT_LIVE_CONFIG.cameraHeight,
              cameraShoulder: DEFAULT_LIVE_CONFIG.cameraShoulder,
              cameraSmoothing: DEFAULT_LIVE_CONFIG.cameraSmoothing,
            })
          }
        >
          <NumberRow label="Campo de visão (FOV)" value={live.cameraFov} min={35} max={90} step={1} onChange={(v) => patchLive('cameraFov', v)} />
          <NumberRow label="Distância" value={live.cameraDistance} min={2} max={12} onChange={(v) => patchLive('cameraDistance', v)} />
          <NumberRow label="Altura" value={live.cameraHeight} min={0.8} max={4} onChange={(v) => patchLive('cameraHeight', v)} />
          <NumberRow label="Deslocamento lateral" value={live.cameraShoulder} min={-2.5} max={2.5} onChange={(v) => patchLive('cameraShoulder', v)} />
          <NumberRow label="Suavidade" value={live.cameraSmoothing} min={1} max={30} step={0.5} onChange={(v) => patchLive('cameraSmoothing', v)} />
        </Section>

        <Section
          title="Controles & Interface"
          onReset={() =>
            settingsManager.update({
              volume: DEFAULT_SETTINGS.volume,
              graphics: DEFAULT_SETTINGS.graphics,
              aimAssist: DEFAULT_SETTINGS.aimAssist,
              reticleStyle: DEFAULT_SETTINGS.reticleStyle,
              cameraSensitivity: DEFAULT_SETTINGS.cameraSensitivity,
              cameraShake: DEFAULT_SETTINGS.cameraShake,
            })
          }
        >
          <NumberRow label="Sensibilidade da câmera" value={settings.cameraSensitivity} min={0.25} max={3} step={0.05} onChange={(v) => patchSettings('cameraSensitivity', v)} />
          <NumberRow label="Volume" value={settings.volume} min={0} max={100} step={1} unit="%" onChange={(v) => patchSettings('volume', v)} />
          <ToggleRow label="Tremor de câmera" value={settings.cameraShake} onChange={(v) => patchSettings('cameraShake', v)} />
          <ToggleRow label="Assistência de mira" value={settings.aimAssist} onChange={(v) => patchSettings('aimAssist', v)} />
          <SelectRow
            label="Estilo da mira"
            value={settings.reticleStyle}
            options={[
              { value: 'dot', label: 'Ponto' },
              { value: 'crosshair', label: 'Cruz' },
            ]}
            onChange={(v) => patchSettings('reticleStyle', v)}
          />
          <SelectRow
            label="Qualidade gráfica"
            value={settings.graphics}
            options={[
              { value: 'low', label: 'Baixa' },
              { value: 'medium', label: 'Média' },
              { value: 'high', label: 'Alta' },
            ]}
            onChange={(v) => patchSettings('graphics', v)}
          />
        </Section>

        <Section
          title="Movimento & Física"
          onReset={() =>
            liveConfigManager.update({
              groundMaxSpeed: DEFAULT_LIVE_CONFIG.groundMaxSpeed,
              flightMaxSpeed: DEFAULT_LIVE_CONFIG.flightMaxSpeed,
              dashSpeed: DEFAULT_LIVE_CONFIG.dashSpeed,
              dashCooldown: DEFAULT_LIVE_CONFIG.dashCooldown,
              dashDuration: DEFAULT_LIVE_CONFIG.dashDuration,
              flightAltitude: DEFAULT_LIVE_CONFIG.flightAltitude,
              playerCollisionRadius: DEFAULT_LIVE_CONFIG.playerCollisionRadius,
              jumpPadBounceMultiplier: DEFAULT_LIVE_CONFIG.jumpPadBounceMultiplier,
            })
          }
        >
          <NumberRow label="Velocidade no solo" value={live.groundMaxSpeed} min={2} max={25} onChange={(v) => patchLive('groundMaxSpeed', v)} />
          <NumberRow label="Velocidade de voo" value={live.flightMaxSpeed} min={2} max={30} onChange={(v) => patchLive('flightMaxSpeed', v)} />
          <NumberRow label="Impulso do dash" value={live.dashSpeed} min={10} max={45} step={0.5} onChange={(v) => patchLive('dashSpeed', v)} />
          <NumberRow label="Recarga do dash" value={live.dashCooldown} min={0.2} max={10} onChange={(v) => patchLive('dashCooldown', v)} />
          <NumberRow label="Duração do dash" value={live.dashDuration} min={0.1} max={1} onChange={(v) => patchLive('dashDuration', v)} />
          <NumberRow label="Altitude de voo" value={live.flightAltitude} min={1} max={12} onChange={(v) => patchLive('flightAltitude', v)} />
          <NumberRow label="Raio de colisão" value={live.playerCollisionRadius} min={0.15} max={1.5} onChange={(v) => patchLive('playerCollisionRadius', v)} />
          <NumberRow label="Trampolim" value={live.jumpPadBounceMultiplier} min={0.5} max={3} onChange={(v) => patchLive('jumpPadBounceMultiplier', v)} />
        </Section>

        <Section
          title="Efeitos & Animações"
          onReset={() =>
            liveConfigManager.update({
              cameraShakeMultiplier: DEFAULT_LIVE_CONFIG.cameraShakeMultiplier,
              animationSpeed: DEFAULT_LIVE_CONFIG.animationSpeed,
              particleIntensity: DEFAULT_LIVE_CONFIG.particleIntensity,
              damageNumberDuration: DEFAULT_LIVE_CONFIG.damageNumberDuration,
            })
          }
        >
          <NumberRow label="Intensidade do tremor" value={live.cameraShakeMultiplier} min={0} max={2} onChange={(v) => patchLive('cameraShakeMultiplier', v)} />
          <NumberRow label="Velocidade da animação" value={live.animationSpeed} min={0.25} max={2} onChange={(v) => patchLive('animationSpeed', v)} />
          <NumberRow label="Partículas" value={live.particleIntensity} min={0} max={2} onChange={(v) => patchLive('particleIntensity', v)} />
          <NumberRow label="Duração dos números de dano" value={live.damageNumberDuration} min={0.3} max={3} onChange={(v) => patchLive('damageNumberDuration', v)} />
        </Section>

        <Section
          title="Ambiente"
          onReset={() =>
            liveConfigManager.update({
              skyColor: DEFAULT_LIVE_CONFIG.skyColor,
              baseplateColor: DEFAULT_LIVE_CONFIG.baseplateColor,
              sunLightIntensity: DEFAULT_LIVE_CONFIG.sunLightIntensity,
              fogNear: DEFAULT_LIVE_CONFIG.fogNear,
              fogFar: DEFAULT_LIVE_CONFIG.fogFar,
            })
          }
        >
          <ColorRow label="Cor do céu" value={live.skyColor} onChange={(v) => patchLive('skyColor', v)} />
          <ColorRow label="Cor da base" value={live.baseplateColor} onChange={(v) => patchLive('baseplateColor', v)} />
          <NumberRow label="Intensidade do sol" value={live.sunLightIntensity} min={0.1} max={3} onChange={(v) => patchLive('sunLightIntensity', v)} />
          <NumberRow label="Névoa (início)" value={live.fogNear} min={5} max={100} step={1} onChange={(v) => patchLive('fogNear', v)} />
          <NumberRow label="Névoa (fim)" value={live.fogFar} min={50} max={500} step={1} onChange={(v) => patchLive('fogFar', v)} />
        </Section>

        <Section title="Agatha Harkness" onReset={() => { resetAgathaConfig(); setVersion((v) => v + 1); }}>
          <NumberRow label="Dano do disparo arcano" value={agatha.arcaneBlast.damage} min={1} max={200} step={1} onChange={(v) => patchAgatha('arcaneBlast', 'damage', v)} />
          <NumberRow label="Recarga do disparo" value={agatha.arcaneBlast.cooldown} min={0.05} max={5} onChange={(v) => patchAgatha('arcaneBlast', 'cooldown', v)} />
          <NumberRow label="DPS do Dreno Sombrio" value={agatha.darkDrain.dps} min={1} max={150} step={1} onChange={(v) => patchAgatha('darkDrain', 'dps', v)} />
          <NumberRow label="Duração do Dreno" value={agatha.darkDrain.duration} min={0.5} max={12} onChange={(v) => patchAgatha('darkDrain', 'duration', v)} />
          <NumberRow label="Dano direto do Orbe" value={agatha.chaosOrb.directDamage} min={1} max={200} step={1} onChange={(v) => patchAgatha('chaosOrb', 'directDamage', v)} />
          <NumberRow label="Dano em área do Orbe" value={agatha.chaosOrb.splashDamage} min={0} max={200} step={1} onChange={(v) => patchAgatha('chaosOrb', 'splashDamage', v)} />
          <NumberRow label="Raio da explosão" value={agatha.chaosOrb.splashRadius} min={0.5} max={20} onChange={(v) => patchAgatha('chaosOrb', 'splashRadius', v)} />
          <NumberRow label="Duração do Escudo Rúnico" value={agatha.runicWard.duration} min={1} max={20} onChange={(v) => patchAgatha('runicWard', 'duration', v)} />
          <NumberRow label="Vida do escudo" value={agatha.runicWard.shieldHealth} min={0} max={500} step={1} onChange={(v) => patchAgatha('runicWard', 'shieldHealth', v)} />
          <NumberRow label="Redução de dano" value={agatha.runicWard.damageReduction} min={0} max={1} onChange={(v) => patchAgatha('runicWard', 'damageReduction', v)} />
          <NumberRow label="Duração do Enforcamento" value={agatha.arcaneChoke.duration} min={0.5} max={12} onChange={(v) => patchAgatha('arcaneChoke', 'duration', v)} />
          <NumberRow label="Dano por tick do Enforcamento" value={agatha.arcaneChoke.tickDamage} min={0} max={100} step={1} onChange={(v) => patchAgatha('arcaneChoke', 'tickDamage', v)} />
          <NumberRow label="Distância do Passo Sombrio" value={agatha.shadowStep.distance} min={1} max={30} onChange={(v) => patchAgatha('shadowStep', 'distance', v)} />
          <NumberRow label="Recarga do Passo Sombrio" value={agatha.shadowStep.cooldown} min={0.2} max={20} onChange={(v) => patchAgatha('shadowStep', 'cooldown', v)} />
        </Section>

        <Section title="Homem de Ferro" onReset={() => { resetIronManConfig(); setVersion((v) => v + 1); }}>
          <NumberRow label="Dano do repulsor" value={ironman.repulsor.damage} min={1} max={200} step={1} onChange={(v) => patchIronMan('repulsor', 'damage', v)} />
          <NumberRow label="Velocidade do repulsor" value={ironman.repulsor.speed} min={5} max={120} step={1} onChange={(v) => patchIronMan('repulsor', 'speed', v)} />
          <NumberRow label="Alcance do repulsor" value={ironman.repulsor.maxRange} min={5} max={120} step={1} onChange={(v) => patchIronMan('repulsor', 'maxRange', v)} />
          <NumberRow label="Mísseis por salva" value={ironman.microMissiles.volleyCount} min={1} max={16} step={1} onChange={(v) => patchIronMan('microMissiles', 'volleyCount', v)} />
          <NumberRow label="Dano por míssil" value={ironman.microMissiles.damagePerMissile} min={1} max={100} step={1} onChange={(v) => patchIronMan('microMissiles', 'damagePerMissile', v)} />
          <NumberRow label="DPS dos raios duplos" value={ironman.dualBeams.dps} min={1} max={200} step={1} onChange={(v) => patchIronMan('dualBeams', 'dps', v)} />
          <NumberRow label="Duração dos raios" value={ironman.dualBeams.maxDuration} min={0.5} max={15} onChange={(v) => patchIronMan('dualBeams', 'maxDuration', v)} />
          <NumberRow label="Alcance dos raios" value={ironman.dualBeams.range} min={5} max={80} onChange={(v) => patchIronMan('dualBeams', 'range', v)} />
          <NumberRow label="Dano do Unibeam" value={ironman.unibeam.damage} min={1} max={300} step={1} onChange={(v) => patchIronMan('unibeam', 'damage', v)} />
          <NumberRow label="Tempo de carga do Unibeam" value={ironman.unibeam.chargeTime} min={0.05} max={2} onChange={(v) => patchIronMan('unibeam', 'chargeTime', v)} />
          <NumberRow label="Dano dos lasers giratórios" value={ironman.spinningLasers.damage} min={1} max={200} step={1} onChange={(v) => patchIronMan('spinningLasers', 'damage', v)} />
          <NumberRow label="Duração dos lasers" value={ironman.spinningLasers.duration} min={0.3} max={8} onChange={(v) => patchIronMan('spinningLasers', 'duration', v)} />
        </Section>

        <div className="md:col-span-2 xl:col-span-3 flex items-center justify-between gap-3 p-3 border border-[#27272a] rounded bg-[#121215]">
          <span className="text-[11px] text-[#71717a]">
            Padrões de fábrica: Agatha {JSON.stringify(DEFAULT_AGATHA_CONFIG.arcaneBlast.damage)} de dano · Homem de Ferro{' '}
            {JSON.stringify(DEFAULT_IRONMAN_CONFIG.repulsor.damage)} de dano no repulsor.
          </span>
          <button
            onClick={() => {
              audioSystem.playUiClick?.();
              liveConfigManager.reset();
              settingsManager.reset();
              resetAgathaConfig();
              resetIronManConfig();
              setVersion((v) => v + 1);
            }}
            className="px-3 py-1.5 border border-amber-600/50 text-amber-400 hover:bg-amber-600/10 rounded text-[11px] font-medium"
          >
            Restaurar toda a configuração
          </button>
        </div>
      </div>
    </div>
  );
};
