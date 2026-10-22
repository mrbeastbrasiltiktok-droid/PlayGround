/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Settings as SettingsIcon, Sparkles, RotateCcw, Code2 } from 'lucide-react';
import { GameScene } from './game/GameScene';
import { VirtualJoystick } from './components/VirtualJoystick';
import { CombatButtons } from './components/CombatButtons';
import { AimReticle } from './components/AimReticle';
import { SettingsModal } from './components/SettingsModal';
import { PowerSelectModal, PowerSetType } from './components/PowerSelectModal';
import { BeamClashBanner } from './components/BeamClashBanner';
import { OrientationGuard } from './components/OrientationGuard';
import { BuildModeContainer } from './components/BuildMode/BuildModeContainer';
import { settingsManager, GameSettings } from './game/SettingsManager';
import { audioSystem } from './game/AudioSystem';
import { BeamClashState } from './game/IronManAbilities';
import { scriptRuntimeEngine } from './game/ScriptRuntimeEngine';
import * as THREE from 'three';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameSceneRef = useRef<GameScene | null>(null);
  const [gameSceneState, setGameSceneState] = useState<GameScene | null>(null);

  const [settings, setSettings] = useState<GameSettings>(settingsManager.get());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Script-Only Build Mode State
  const [isBuildMode, setIsBuildMode] = useState(false);
  const [inspectTarget, setInspectTarget] = useState<string | null>(null);

  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasMovedRef = useRef<boolean>(false);
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Reactive UI component override listener
  const [, setCompTick] = useState(0);
  useEffect(() => {
    const unsub = scriptRuntimeEngine.subscribeUiComponents(() => {
      setCompTick((t) => t + 1);
    });
    return unsub;
  }, []);

  // Power Selection Modal
  const [powerSet, setPowerSet] = useState<PowerSetType>('ironman');
  const [isPowerModalOpen, setIsPowerModalOpen] = useState(false);

  // Synchronize powerSet requested by script compiler / character edits
  useEffect(() => {
    scriptRuntimeEngine.onPowerSetRequested = (newSet: PowerSetType) => {
      setPowerSet(newSet);
      gameSceneRef.current?.setPowerSet(newSet);
    };
    return () => {
      scriptRuntimeEngine.onPowerSetRequested = undefined;
    };
  }, []);

  const handleToggleBuildMode = useCallback(() => {
    audioSystem.playUiClick();
    setIsBuildMode((prev) => {
      const next = !prev;
      gameSceneRef.current?.setBuildMode(next);
      return next;
    });
  }, []);

  const [isFlying, setIsFlying] = useState(false);

  const handleRespawn = useCallback(() => {
    audioSystem.playUiClick();
    setIsFlying(false);
    gameSceneRef.current?.respawnPlayer();
  }, []);

  // Beam Clash Real-time State
  const [clashState, setClashState] = useState<BeamClashState>({
    active: false,
    rival: null,
    progress: 0.5,
    clashPoint: new THREE.Vector3(),
    duration: 0,
    maxDuration: 6.0,
    lastTapTime: 0,
  });

  // Camera Drag Touch Tracking
  const cameraTouchIdRef = useRef<number | null>(null);
  const lastTouchPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!mountRef.current) return;

    const game = new GameScene(mountRef.current);
    gameSceneRef.current = game;
    setGameSceneState(game);

    // Initial power set
    game.setPowerSet('ironman');

    const unsub = settingsManager.subscribe((newSettings) => {
      setSettings(newSettings);
    });

    return () => {
      unsub();
      game.dispose();
      gameSceneRef.current = null;
      setGameSceneState(null);
    };
  }, []);

  // Poll Beam Clash state for reactive UI updates
  useEffect(() => {
    let animId = 0;
    const checkClash = () => {
      if (gameSceneRef.current?.ironManAbilities) {
        const cs = gameSceneRef.current.ironManAbilities.clashState;
        if (cs.active !== clashState.active || Math.abs(cs.progress - clashState.progress) > 0.01) {
          setClashState({ ...cs });
        }
      }
      animId = requestAnimationFrame(checkClash);
    };
    animId = requestAnimationFrame(checkClash);
    return () => cancelAnimationFrame(animId);
  }, [clashState.active, clashState.progress]);

  const handleJoystickMove = useCallback((x: number, y: number, active: boolean) => {
    gameSceneRef.current?.setJoystickInput(x, y, active);
  }, []);

  const handleAttack = useCallback((): boolean => {
    return gameSceneRef.current?.triggerAttack() ?? false;
  }, []);

  const handleAbility = useCallback((id: number): boolean => {
    return gameSceneRef.current?.triggerAbility(id) ?? false;
  }, []);

  const handleDash = useCallback((): boolean => {
    return gameSceneRef.current?.triggerDash() ?? false;
  }, []);

  const handleToggleFlight = useCallback((): boolean => {
    const nextState = gameSceneRef.current?.toggleFlight() ?? false;
    setIsFlying(nextState);
    return nextState;
  }, []);

  const handleSelectPowerSet = useCallback((newSet: PowerSetType) => {
    setPowerSet(newSet);
    gameSceneRef.current?.setPowerSet(newSet);
  }, []);

  // Screen Touch / Pointer Dragging for Third-Person Camera Orbit & Preview Element Inspection
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-control="true"]')) {
      return;
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (activePointersRef.current.size === 1) {
      cameraTouchIdRef.current = e.pointerId;
      lastTouchPosRef.current = { x: e.clientX, y: e.clientY };
      startPosRef.current = { x: e.clientX, y: e.clientY };
      hasMovedRef.current = false;
    }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (cameraTouchIdRef.current === e.pointerId && gameSceneRef.current) {
      const dx = e.clientX - lastTouchPosRef.current.x;
      const dy = e.clientY - lastTouchPosRef.current.y;
      lastTouchPosRef.current = { x: e.clientX, y: e.clientY };

      const totalDist = Math.hypot(e.clientX - startPosRef.current.x, e.clientY - startPosRef.current.y);
      if (totalDist > 6) {
        hasMovedRef.current = true;
      }

      if (isBuildMode) {
        if (e.buttons === 2 || e.shiftKey) {
          gameSceneRef.current.addBuildCameraPan(dx, dy);
        } else {
          gameSceneRef.current.addBuildCameraOrbit(-dx, dy);
        }
      } else {
        gameSceneRef.current.addCameraDrag(-dx, dy);
      }
    }
  }, [isBuildMode]);

  const handlePointerEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);

    if (cameraTouchIdRef.current === e.pointerId) {
      // If user tapped without dragging in Build Mode, inspect tapped 3D element!
      if (isBuildMode && !hasMovedRef.current && gameSceneRef.current) {
        const hitKey = gameSceneRef.current.raycastInspectPreview(e.clientX, e.clientY);
        if (hitKey) {
          audioSystem.playUiClick();
          setInspectTarget(hitKey);
        }
      }
      cameraTouchIdRef.current = null;
    }
  }, [isBuildMode]);

  // Dynamically resolved components (supports hot-swapped compiled versions!)
  const ActiveCombatButtons =
    (scriptRuntimeEngine.getComponent('combat-buttons') as typeof CombatButtons) || CombatButtons;
  const ActiveAimReticle =
    (scriptRuntimeEngine.getComponent('aim-reticle') as typeof AimReticle) || AimReticle;
  const ActiveVirtualJoystick =
    (scriptRuntimeEngine.getComponent('virtual-joystick') as typeof VirtualJoystick) || VirtualJoystick;
  const ActiveBeamClashBanner =
    (scriptRuntimeEngine.getComponent('beam-clash-banner') as typeof BeamClashBanner) || BeamClashBanner;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onWheel={(e) => {
        if (isBuildMode && gameSceneRef.current) {
          gameSceneRef.current.addBuildCameraZoom(e.deltaY * 0.015);
        }
      }}
      className="relative w-full h-full overflow-hidden select-none touch-none bg-[#a1c3e6]"
      style={{ touchAction: 'none' }}
    >
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Script-Only Build Mode Interface Overlay */}
      {isBuildMode && gameSceneState && (
        <BuildModeContainer
          gameScene={gameSceneState}
          onExitBuildMode={handleToggleBuildMode}
          inspectTarget={inspectTarget}
          onSelectInspectTarget={setInspectTarget}
          currentPowerSet={powerSet}
          onSelectPowerSet={handleSelectPowerSet}
        />
      )}

      {/* Standard Gameplay Controls & HUD (Active in Play Mode) */}
      {!isBuildMode && (
        <>
          {/* Aim Reticle & Aim Assist Corner Brackets */}
          <ActiveAimReticle
            gameScene={gameSceneState}
            reticleStyle={settings.reticleStyle}
            aimAssistEnabled={settings.aimAssist}
          />

          {/* Beam Clash Tug-of-War Interactive Banner */}
          <ActiveBeamClashBanner clashState={clashState} />

          {/* Mobile Virtual Joystick (Bottom-Left) */}
          <div data-control="true">
            <ActiveVirtualJoystick onMove={handleJoystickMove} />
          </div>

          {/* Combat Buttons (Bottom-Right: Attack + 4 Semicircle Abilities + Dash + Flight) */}
          <div data-control="true">
            <ActiveCombatButtons
              onAttack={handleAttack}
              onAbility={handleAbility}
              onDash={handleDash}
              onToggleFlight={handleToggleFlight}
              isFlying={isFlying}
              powerSet={powerSet}
              isClashActive={clashState.active}
            />
          </div>

          {/* Power Selection Button (Top-Center) */}
          <button
            onClick={() => {
              audioSystem.playUiClick();
              setIsPowerModalOpen(true);
            }}
            style={{
              position: 'fixed',
              top: 'max(16px, env(safe-area-inset-top, 16px))',
              left: '50%',
              transform: 'translateX(-50%)',
              height: '38px',
              padding: '0 16px',
              borderRadius: '20px',
              backgroundColor: 'rgba(25, 28, 35, 0.72)',
              border:
                powerSet === 'agatha'
                  ? '1.5px solid rgba(168, 85, 247, 0.85)'
                  : powerSet === 'ironman'
                  ? '1.5px solid rgba(245, 158, 11, 0.65)'
                  : '1.5px solid rgba(255, 255, 255, 0.22)',
              boxShadow:
                powerSet === 'agatha'
                  ? '0 4px 14px rgba(0, 0, 0, 0.35), 0 0 12px rgba(168, 85, 247, 0.35)'
                  : powerSet === 'ironman'
                  ? '0 4px 14px rgba(0, 0, 0, 0.35), 0 0 10px rgba(245, 158, 11, 0.2)'
                  : '0 4px 14px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: '#e2e8f0',
              cursor: 'pointer',
              zIndex: 60,
              touchAction: 'none',
              transition: 'transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease',
            }}
            className="active:scale-95 hover:bg-slate-900/85"
            title="Select Character Power Set"
          >
            <Sparkles
              size={16}
              className={
                powerSet === 'agatha'
                  ? 'text-purple-400'
                  : powerSet === 'ironman'
                  ? 'text-amber-400'
                  : 'text-cyan-400'
              }
            />
            <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.06em' }}>
              {powerSet === 'agatha' ? 'AGATHA HARKNESS' : powerSet === 'ironman' ? 'HOMEM DE FERRO' : 'CLASSIC POWERS'}
            </span>
          </button>

          {/* Respawn / Reset Position Button (Top-Right) */}
          <button
            onClick={handleRespawn}
            style={{
              position: 'fixed',
              top: 'max(16px, env(safe-area-inset-top, 16px))',
              right: 'calc(max(16px, env(safe-area-inset-right, 16px)) + 52px)',
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: 'rgba(25, 28, 35, 0.65)',
              border: '1.5px solid rgba(255, 255, 255, 0.22)',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e2e8f0',
              cursor: 'pointer',
              zIndex: 60,
              touchAction: 'none',
              transition: 'transform 0.15s ease, background-color 0.15s ease',
            }}
            className="active:scale-90 hover:bg-slate-900/80"
            title="Respawn & Reset Position"
          >
            <RotateCcw size={18} className="text-amber-400" />
          </button>
        </>
      )}

      {/* Script-Only Build Mode Toggle Button (Top-Right, accessible anytime) */}
      <button
        onClick={handleToggleBuildMode}
        style={{
          position: 'fixed',
          top: 'max(16px, env(safe-area-inset-top, 16px))',
          right: isBuildMode
            ? 'max(16px, env(safe-area-inset-right, 16px))'
            : 'calc(max(16px, env(safe-area-inset-right, 16px)) + 104px)',
          height: '42px',
          padding: '0 14px',
          borderRadius: '21px',
          backgroundColor: isBuildMode ? '#00a2ff' : 'rgba(25, 28, 35, 0.72)',
          border: isBuildMode ? '1.5px solid #38bdf8' : '1.5px solid rgba(0, 162, 255, 0.55)',
          boxShadow: isBuildMode
            ? '0 4px 16px rgba(0, 162, 255, 0.45), 0 0 12px rgba(0, 162, 255, 0.35)'
            : '0 4px 14px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: '#ffffff',
          cursor: 'pointer',
          zIndex: 85,
          touchAction: 'none',
          transition: 'transform 0.15s ease, background-color 0.15s ease',
        }}
        className="active:scale-95 hover:bg-slate-900/85"
        title={isBuildMode ? 'Exit to Play Test (Run Latest Applied Code)' : 'Open Script Build Mode (Source Code Editor)'}
      >
        <Code2 size={16} className={isBuildMode ? 'text-white' : 'text-cyan-400'} />
        <span style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em' }}>
          {isBuildMode ? 'PLAY TEST' : 'SCRIPT BUILD'}
        </span>
      </button>

      {/* Settings Button (Top-Right) */}
      {!isBuildMode && (
        <button
          onClick={() => {
            audioSystem.playUiClick();
            setIsSettingsOpen(true);
          }}
          style={{
            position: 'fixed',
            top: 'max(16px, env(safe-area-inset-top, 16px))',
            right: 'max(16px, env(safe-area-inset-right, 16px))',
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'rgba(25, 28, 35, 0.65)',
            border: '1.5px solid rgba(255, 255, 255, 0.22)',
            boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#e2e8f0',
            cursor: 'pointer',
            zIndex: 60,
            touchAction: 'none',
            transition: 'transform 0.15s ease, background-color 0.15s ease',
          }}
          className="active:scale-90 hover:bg-slate-900/80"
          title="Settings"
        >
          <SettingsIcon size={20} className="text-slate-200" />
        </button>
      )}

      {/* Power Selection Modal */}
      <PowerSelectModal
        isOpen={isPowerModalOpen}
        activeSet={powerSet}
        onSelect={handleSelectPowerSet}
        onClose={() => setIsPowerModalOpen(false)}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Fullscreen Landscape Orientation Guard */}
      <OrientationGuard />
    </div>
  );
}
