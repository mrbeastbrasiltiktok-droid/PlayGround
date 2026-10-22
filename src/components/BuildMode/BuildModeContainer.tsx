/**
 * BuildModeContainer.tsx
 * Redesenhado: Interface profissional, minimalista e escura para o Modo Construção e Editor de Código.
 * Totalmente em Português do Brasil com arquitetura de 3 áreas (Navegação, Editor e Contexto),
 * suporte a Modo Foco, mobile-friendly e sincronização direta com o motor do jogo.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  FolderCode,
  FileCode,
  Play,
  RotateCcw,
  Undo2,
  Redo2,
  Copy,
  Check,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  Search,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Shield,
  Zap,
  Sliders,
  Terminal,
  Layers,
  History,
  X,
  RefreshCw,
  Flame,
  Info,
  Settings2,
  Upload,
} from 'lucide-react';
import { GameScene } from '../../game/GameScene';
import {
  scriptRuntimeEngine,
  WorkingBackup,
} from '../../game/ScriptRuntimeEngine';
import {
  PROJECT_SCRIPTS,
  ProjectScriptInfo,
  ScriptCategory,
  SCRIPT_TABS,
} from '../../game/RealProjectScripts';
import {
  gameplayRestrictions,
  ActiveRestriction,
  RestrictionType,
} from '../../game/GameplayRestrictions';
import { audioSystem } from '../../game/AudioSystem';
import { BuildToast, ToastMessage } from './BuildToast';
import { GameConfigPanel } from './GameConfigPanel';

interface BuildModeContainerProps {
  gameScene: GameScene;
  onExitBuildMode: () => void;
  inspectTarget?: string | null;
  onSelectInspectTarget?: (target: string | null) => void;
  currentPowerSet?: 'classic' | 'ironman' | 'agatha';
  onSelectPowerSet?: (set: 'classic' | 'ironman' | 'agatha') => void;
}


const SEARCH_SYNONYMS: string[][] = [
  ['camera', 'cameras', 'visao', 'fov', 'zoom', 'distancia', 'altura', 'perspectiva'],
  ['animacao', 'animation', 'anima', 'movimento', 'movement', 'locomocao'],
  ['voo', 'voar', 'flight', 'fly', 'altitude', 'pairar'],
  ['dano', 'damage', 'ataque', 'attack', 'golpe', 'hit'],
  ['escudo', 'shield', 'ward', 'runic', 'protecao', 'defesa', 'defense'],
  ['salvar', 'save', 'persistencia', 'persistence', 'storage', 'armazenar', 'persist'],
  ['habilidade', 'ability', 'poder', 'power', 'skill'],
  ['agatha', 'harkness', 'maga', 'bruxa', 'magia', 'magic', 'arcana'],
  ['ironman', 'homemdeferro', 'stark', 'armadura', 'repulsor', 'unibeam'],
  ['audio', 'som', 'sound', 'volume', 'musica'],
  ['restricao', 'restriction', 'bloqueio', 'lock', 'limite'],
  ['colisao', 'collision', 'fisica', 'physics', 'ground'],
  ['particula', 'particle', 'efeito', 'effect', 'vfx'],
  ['interface', 'hud', 'ui', 'mira', 'reticle', 'controle', 'control'],
  ['construcao', 'build', 'buildmode', 'editor', 'objeto', 'object'],
];

const normalizeSearch = (value: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

function buildSearchTokens(query: string): string[] {
  const base = normalizeSearch(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (base.length === 0) return [];
  const expanded = new Set<string>(base);
  for (const token of base) {
    for (const group of SEARCH_SYNONYMS) {
      if (group.some((word) => word.includes(token) || token.includes(word))) {
        group.forEach((word) => expanded.add(word));
      }
    }
  }
  return Array.from(expanded);
}

function scoreScript(script: ProjectScriptInfo, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const name = normalizeSearch(script.name);
  const id = normalizeSearch(script.id);
  const path = normalizeSearch(script.filePath);
  const summary = normalizeSearch(script.summary);
  const category = normalizeSearch(script.category);
  const dependencies = normalizeSearch(script.dependencies.join(' '));
  const source = normalizeSearch(script.originalSource);
  let score = 0;
  for (const token of tokens) {
    if (name === token) score += 120;
    else if (name.includes(token)) score += 70;
    if (id.includes(token)) score += 55;
    if (path.includes(token)) score += 40;
    if (summary.includes(token)) score += 30;
    if (category.includes(token)) score += 25;
    if (dependencies.includes(token)) score += 18;
    if (source.includes(token)) score += 10;
  }
  return score;
}

const EDITOR_HISTORY_KEY = 'stickman_editor_history_v1';

interface EditorHistoryState {
  entries: string[];
  idx: number;
}

function loadEditorHistory(scriptId: string, fallback: string): EditorHistoryState {
  try {
    const raw = localStorage.getItem(EDITOR_HISTORY_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, EditorHistoryState>;
      const record = parsed[scriptId];
      if (record && Array.isArray(record.entries) && record.entries.length > 0) {
        const entries = [...record.entries];
        const idx = Math.max(0, Math.min(record.idx, entries.length - 1));
        if (entries[idx] !== fallback) {
          entries.push(fallback);
          return { entries, idx: entries.length - 1 };
        }
        return { entries, idx };
      }
    }
  } catch {
    // Corrupted history must not break the editor.
  }
  return { entries: [fallback], idx: 0 };
}

function saveEditorHistory(scriptId: string, entries: string[], idx: number): void {
  try {
    const MAX = 60;
    let trimmed = entries;
    let trimmedIdx = idx;
    if (entries.length > MAX) {
      const drop = entries.length - MAX;
      trimmed = entries.slice(drop);
      trimmedIdx = idx - drop;
    }
    const raw = localStorage.getItem(EDITOR_HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, EditorHistoryState>) : {};
    parsed[scriptId] = { entries: trimmed, idx: Math.max(0, trimmedIdx) };
    localStorage.setItem(EDITOR_HISTORY_KEY, JSON.stringify(parsed));
  } catch {
    // Ignore storage quota errors.
  }
}

export const BuildModeContainer: React.FC<BuildModeContainerProps> = ({
  gameScene,
  onExitBuildMode,
  inspectTarget,
  onSelectInspectTarget,
  currentPowerSet = 'agatha',
  onSelectPowerSet,
}) => {
  // Navigation & Scripts
  const [selectedScriptId, setSelectedScriptId] = useState<string>('agatha-arcane-blast');
  const [activeCategory, setActiveCategory] = useState<ScriptCategory | 'Todos'>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'applied' | 'dirty' | 'error'>('all');
  const [workspace, setWorkspace] = useState<'code' | 'config'>('code');
  const [engineTick, setEngineTick] = useState(0);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Editor Panels State (Collapsible)
  const [isLeftNavOpen, setIsLeftNavOpen] = useState(true);
  const [isRightContextOpen, setIsRightContextOpen] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Right Panel Tab: 'diagnostico' | 'restricoes' | 'historico' | 'info'
  const [contextTab, setContextTab] = useState<'diagnostico' | 'restricoes' | 'historico' | 'info'>(
    'diagnostico'
  );

  // Active Script Code & History
  const [code, setCode] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(0);
  const [copied, setCopied] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [compileStatus, setCompileStatus] = useState<{
    success: boolean;
    message: string;
    timestamp?: string;
  } | null>(null);

  // Live Gameplay Restrictions State
  const [activeRestrictions, setActiveRestrictions] = useState<ActiveRestriction[]>([]);

  // Mobile Drawer State
  const [mobileDrawer, setMobileDrawer] = useState<'none' | 'left' | 'right'>('none');

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const lineGutterRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<number | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const showToast = (text: string, type: 'info' | 'success' | 'warn' = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Subscribe to Restrictions
  useEffect(() => {
    const unsub = gameplayRestrictions.subscribe((restrictions) => {
      setActiveRestrictions([...restrictions]);
    });
    return unsub;
  }, []);

  // Subscribe to Script Engine Updates so badges/status stay live.
  useEffect(() => {
    const unsub = scriptRuntimeEngine.subscribe(() => {
      setEngineTick((t) => t + 1);
    });
    return unsub;
  }, []);

  // Filtered Scripts Catalog (accent-insensitive, PT/EN aware search).
  const allScripts = useMemo(() => scriptRuntimeEngine.getScripts(), [engineTick]);
  const filteredScripts = useMemo(() => {
    const tokens = buildSearchTokens(searchQuery);
    const scored = allScripts
      .filter((s) => activeCategory === 'Todos' || s.category === activeCategory)
      .filter((s) => {
        if (statusFilter === 'all') return true;
        const state = scriptRuntimeEngine.getScriptState(s.id);
        if (statusFilter === 'running') return state.isRunning;
        if (statusFilter === 'applied') return state.hasApplied;
        if (statusFilter === 'dirty') return state.isDirty;
        return state.phase === 'error';
      })
      .map((s) => ({ script: s, score: scoreScript(s, tokens) }))
      .filter((entry) => entry.score > 0);

    if (tokens.length === 0) {
      return scored.map((e) => e.script);
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.map((e) => e.script);
  }, [allScripts, activeCategory, searchQuery, statusFilter, engineTick]);

  const activeScript = useMemo(
    () => scriptRuntimeEngine.getScriptById(selectedScriptId) || allScripts[0],
    [selectedScriptId, allScripts]
  );

  // Load Script Content & Drafts
  useEffect(() => {
    if (activeScript) {
      const draft = scriptRuntimeEngine.getDraft(activeScript.id);
      const restored = loadEditorHistory(activeScript.id, draft);
      setCode(restored.entries[restored.idx]);
      setHistory(restored.entries);
      setHistoryIdx(restored.idx);
      setCompileStatus(null);
      setSaveState('idle');
      setLastSavedAt(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScript?.id]);

  // Synchronize Line Numbers Scrolling with Textarea
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (lineGutterRef.current) {
      lineGutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const markSavedSoon = () => {
    setSaveState('saving');
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      setSaveState('saved');
      setLastSavedAt(new Date().toLocaleTimeString('pt-BR'));
    }, 450);
  };

  // Handle Code Change
  const handleCodeChange = (newCode: string) => {
    setCode(newCode);
    if (activeScript) {
      scriptRuntimeEngine.saveDraft(activeScript.id, newCode);
    }
    const base = history.slice(0, historyIdx + 1);
    if (base[base.length - 1] !== newCode) {
      base.push(newCode);
    }
    const nextIdx = base.length - 1;
    setHistory(base);
    setHistoryIdx(nextIdx);
    if (activeScript) saveEditorHistory(activeScript.id, base, nextIdx);
    markSavedSoon();
  };

  // Undo / Redo
  const applyHistoryIndex = (nextIdx: number) => {
    const nextCode = history[nextIdx];
    setHistoryIdx(nextIdx);
    setCode(nextCode);
    if (activeScript) {
      scriptRuntimeEngine.saveDraft(activeScript.id, nextCode);
      saveEditorHistory(activeScript.id, history, nextIdx);
    }
    markSavedSoon();
  };

  const handleUndo = () => {
    if (historyIdx > 0) {
      audioSystem.playUiClick?.();
      applyHistoryIndex(historyIdx - 1);
    }
  };

  const handleRedo = () => {
    if (historyIdx < history.length - 1) {
      audioSystem.playUiClick?.();
      applyHistoryIndex(historyIdx + 1);
    }
  };

  // Copy Code
  const handleCopy = () => {
    audioSystem.playUiClick?.();
    navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        showToast('Código copiado para a área de transferência', 'success');
      })
      .catch(() => {
        showToast('Acesso à área de transferência negado', 'warn');
      });
  };

  // Compile Only (Validation test without applying)
  const handleValidateOnly = async () => {
    if (!activeScript) return;
    audioSystem.playUiClick?.();
    setIsApplying(true);
    const res = await scriptRuntimeEngine.validateScript(activeScript.id, code);
    setIsApplying(false);

    setCompileStatus({
      success: res.success,
      message: res.success ? 'Código válido sem erros de sintaxe. Nada foi aplicado.' : res.error || 'Erro de sintaxe',
      timestamp: new Date().toLocaleTimeString('pt-BR'),
    });

    if (res.success) {
      showToast('Sintaxe validada com sucesso!', 'success');
    } else {
      showToast(res.error || 'Falha na validação', 'warn');
      setContextTab('diagnostico');
      setIsRightContextOpen(true);
    }
  };

  // Compile and Apply Live to Running Game
  const handleApplyChanges = async () => {
    if (!activeScript) return;
    audioSystem.playUiClick?.();
    setIsApplying(true);

    try {
      const res = await scriptRuntimeEngine.compileAndApply(activeScript.id, code, gameScene, false);
      setIsApplying(false);

      setCompileStatus({
        success: res.success,
        message: res.message,
        timestamp: new Date().toLocaleTimeString('pt-BR'),
      });

      if (res.success && res.applied) {
        // Automatic Character Switch to relevant hero
        if (activeScript.character === 'agatha' || activeScript.id.startsWith('agatha-')) {
          onSelectPowerSet?.('agatha');
          gameScene.setPowerSet('agatha');
          showToast('Agatha Harkness ATIVADA no jogo com suas alterações!', 'success');
        } else if (activeScript.character === 'ironman' || activeScript.id.startsWith('ironman-')) {
          onSelectPowerSet?.('ironman');
          gameScene.setPowerSet('ironman');
          showToast('Homem de Ferro ATIVADO no jogo com suas alterações!', 'success');
        } else {
          showToast(`Alterações aplicadas e executando: ${activeScript.name}`, 'success');
        }
      } else if (res.success && res.requiresReload) {
        showToast(
          `${activeScript.name}: código válido e salvo, mas este módulo só entra em execução após recarregar a página.`,
          'info'
        );
      } else {
        showToast(res.error || 'Erro na compilação', 'warn');
        setContextTab('diagnostico');
        setIsRightContextOpen(true);
      }
    } catch (err: unknown) {
      setIsApplying(false);
      showToast(`Erro inesperado: ${(err as Error).message}`, 'warn');
    }
  };

  // Revert / Rollback to previous working version
  const handleRollback = async () => {
    if (!activeScript) return;
    audioSystem.playUiClick?.();
    setIsApplying(true);
    const res = await scriptRuntimeEngine.rollback(activeScript.id, gameScene);
    setIsApplying(false);

    if (res.success && res.restoredCode !== undefined) {
      setCode(res.restoredCode);
      showToast(res.message, 'success');
    } else {
      showToast(res.message, 'warn');
    }
  };

  // Restore Original Factory Source
  const handleRestoreOriginal = async () => {
    if (!activeScript) return;
    audioSystem.playUiClick?.();
    setIsApplying(true);
    const res = await scriptRuntimeEngine.restoreOriginalScript(activeScript.id, gameScene);
    setIsApplying(false);

    if (res.success) {
      setCode(res.restoredCode || activeScript.originalSource);
      showToast(`Código original de ${activeScript.name} restaurado!`, 'info');
    } else {
      showToast(res.message, 'warn');
    }
  };

  // Restore All Factory Sources
  const handleRestoreAll = async () => {
    audioSystem.playUiClick?.();
    setIsApplying(true);
    const res = await scriptRuntimeEngine.restoreAllOriginalScripts(gameScene);
    setIsApplying(false);
    if (activeScript) {
      setCode(activeScript.originalSource);
    }
    showToast(res.message, 'info');
  };

  // Line numbers calculation
  const linesCount = useMemo(() => code.split('\n').length, [code]);
  const scriptStatus = activeScript ? scriptRuntimeEngine.getScriptStatus(activeScript.id) : null;
  const scriptState = scriptRuntimeEngine.getScriptState(activeScript?.id || selectedScriptId);
  const backups = activeScript ? scriptRuntimeEngine.getBackups(activeScript.id) : [];

  const isScriptModified = useMemo(() => {
    if (!activeScript) return false;
    return code !== activeScript.originalSource;
  }, [code, activeScript]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#09090b] text-[#f4f4f5] font-sans select-none overflow-hidden antialiased">
      {/* ============================================================== */}
      {/* 1. TOP HEADER / TOOLBAR */}
      {/* ============================================================== */}
      <header className="h-12 border-b border-[#27272a] bg-[#121215] flex items-center justify-between px-3 md:px-4 shrink-0 z-20">
        {/* Left branding & script drawer toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              audioSystem.playUiClick?.();
              setIsLeftNavOpen((prev) => !prev);
            }}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded border border-[#27272a] hover:bg-[#1f1f23] text-[#a1a1aa] hover:text-white transition-colors"
            title={isLeftNavOpen ? 'Ocultar barra de scripts' : 'Exibir barra de scripts'}
          >
            {isLeftNavOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>

          {/* Mobile navigation toggle */}
          <button
            onClick={() => setMobileDrawer((m) => (m === 'left' ? 'none' : 'left'))}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded border border-[#27272a] bg-[#18181b] text-[#a1a1aa]"
          >
            <FolderCode size={16} />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs tracking-wider text-white uppercase flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Editor de Scripts
            </span>
            <span className="text-[#52525b] text-xs hidden sm:inline">•</span>
            <span className="text-[#a1a1aa] text-xs font-mono hidden sm:inline truncate max-w-[200px]">
              {activeScript?.name}
            </span>
          </div>
        </div>

        {/* Center Character Switcher & Indicator */}
        <div className="flex items-center gap-1.5 bg-[#18181b] border border-[#27272a] rounded p-0.5">
          <button
            onClick={() => {
              audioSystem.playUiClick?.();
              onSelectPowerSet?.('agatha');
              gameScene.setPowerSet('agatha');
              showToast('Personagem ativo no Play Test: Agatha Harkness', 'info');
            }}
            className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-colors ${
              currentPowerSet === 'agatha'
                ? 'bg-[#7e22ce] text-white shadow-sm'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            <Zap size={13} />
            <span className="hidden sm:inline">Agatha Harkness</span>
            <span className="sm:hidden">Agatha</span>
          </button>
          <button
            onClick={() => {
              audioSystem.playUiClick?.();
              onSelectPowerSet?.('ironman');
              gameScene.setPowerSet('ironman');
              showToast('Personagem ativo no Play Test: Homem de Ferro', 'info');
            }}
            className={`px-2.5 py-1 text-xs rounded font-medium flex items-center gap-1.5 transition-colors ${
              currentPowerSet === 'ironman'
                ? 'bg-[#0284c7] text-white shadow-sm'
                : 'text-[#a1a1aa] hover:text-white'
            }`}
          >
            <Shield size={13} />
            <span className="hidden sm:inline">Homem de Ferro</span>
            <span className="sm:hidden">Iron Man</span>
          </button>
        </div>

        {/* Right Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* Focus Mode Toggle */}
          <button
            onClick={() => {
              audioSystem.playUiClick?.();
              setIsFocusMode((f) => {
                const next = !f;
                if (next) {
                  setIsLeftNavOpen(false);
                  setIsRightContextOpen(false);
                } else {
                  setIsLeftNavOpen(true);
                  setIsRightContextOpen(true);
                }
                return next;
              });
            }}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border border-[#27272a] hover:bg-[#1f1f23] text-[#a1a1aa] hover:text-white transition-colors ${
              isFocusMode ? 'bg-[#27272a] text-white' : ''
            }`}
            title="Alternar Modo Foco (Tela Cheia)"
          >
            {isFocusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>Foco</span>
          </button>

          {/* Context Panel Toggle */}
          <button
            onClick={() => {
              audioSystem.playUiClick?.();
              setIsRightContextOpen((prev) => !prev);
            }}
            className="hidden md:flex items-center justify-center w-8 h-8 rounded border border-[#27272a] hover:bg-[#1f1f23] text-[#a1a1aa] hover:text-white transition-colors"
            title="Painel de Diagnóstico e Restrições"
          >
            <Layers size={16} />
          </button>

          {/* Mobile Context Drawer Toggle */}
          <button
            onClick={() => setMobileDrawer((m) => (m === 'right' ? 'none' : 'right'))}
            className="md:hidden flex items-center justify-center w-8 h-8 rounded border border-[#27272a] bg-[#18181b] text-[#a1a1aa]"
          >
            <Terminal size={16} />
          </button>

          {/* Live game configuration */}
          <button
            onClick={() => {
              audioSystem.playUiClick?.();
              setWorkspace('config');
              setMobileDrawer('none');
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border transition-colors ${
              workspace === 'config'
                ? 'bg-[#27272a] border-[#3f3f46] text-white'
                : 'border-[#27272a] text-[#a1a1aa] hover:text-white hover:bg-[#1f1f23]'
            }`}
            title="Ajustar câmera, física, personagens e efeitos em tempo real"
          >
            <Settings2 size={13} />
            <span className="hidden sm:inline">Ajustes</span>
          </button>

          {/* Primary Action: Aplicar no Jogo */}
          <button
            onClick={handleApplyChanges}
            disabled={isApplying}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white rounded text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
          >
            {isApplying ? (
              <RefreshCw size={13} className="animate-spin" />
            ) : (
              <CheckCircle2 size={13} />
            )}
            <span>Aplicar no Jogo</span>
          </button>

          {/* PLAY TEST: Exit Build Mode and run the game directly */}
          <button
            onClick={() => {
              audioSystem.playUiClick?.();
              // Make sure current power set matches active script if relevant
              if (activeScript?.character === 'agatha' || activeScript?.id.startsWith('agatha-')) {
                onSelectPowerSet?.('agatha');
                gameScene.setPowerSet('agatha');
              } else if (activeScript?.character === 'ironman' || activeScript?.id.startsWith('ironman-')) {
                onSelectPowerSet?.('ironman');
                gameScene.setPowerSet('ironman');
              }
              onExitBuildMode();
            }}
            className="px-3.5 py-1.5 bg-[#f4f4f5] hover:bg-white text-black rounded text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02]"
            title="Voltar ao jogo e testar as habilidades em tempo real"
          >
            <Play size={13} className="fill-black" />
            <span>PLAY TEST</span>
          </button>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. MAIN THREE-PANEL WORKSPACE */}
      {/* ============================================================== */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ============================================================== */}
        {/* LEFT PANEL: Script Catalog Navigation */}
        {/* ============================================================== */}
        <aside
          className={`
            border-r border-[#27272a] bg-[#101013] flex flex-col shrink-0 z-30 transition-all duration-200
            ${isLeftNavOpen ? 'w-64 md:w-72' : 'w-0 hidden md:flex md:w-0 md:border-r-0 overflow-hidden'}
            ${mobileDrawer === 'left' ? 'fixed inset-y-12 left-0 w-72 flex shadow-2xl z-40' : 'hidden md:flex'}
          `}
        >
          {/* Search Box */}
          <div className="p-2.5 border-b border-[#27272a]">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717a]"
              />
              <input
                type="text"
                placeholder="Filtrar arquivos de script..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#18181b] border border-[#27272a] rounded px-2.5 pl-8 py-1.5 text-xs text-white placeholder-[#71717a] focus:outline-none focus:border-zinc-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Categories Tab Selector */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-[#27272a] overflow-x-auto text-[11px] no-scrollbar">
            <button
              onClick={() => setActiveCategory('Todos')}
              className={`px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
                activeCategory === 'Todos'
                  ? 'bg-[#27272a] text-white font-medium'
                  : 'text-[#a1a1aa] hover:text-white'
              }`}
            >
              Todos ({allScripts.length})
            </button>
            {SCRIPT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id)}
                className={`px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
                  activeCategory === tab.id
                    ? 'bg-[#27272a] text-white font-medium'
                    : 'text-[#a1a1aa] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status Filter Row */}
          <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-[#27272a] overflow-x-auto text-[10px] no-scrollbar">
            {([
              ['all', 'Tudo'],
              ['running', 'Executando'],
              ['applied', 'Aplicado'],
              ['dirty', 'Rascunho'],
              ['error', 'Erro'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-2 py-0.5 rounded whitespace-nowrap transition-colors ${
                  statusFilter === value
                    ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-600/40'
                    : 'text-[#a1a1aa] hover:text-white border border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Script Items List */}
          <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5 font-sans">
            {filteredScripts.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#71717a]">
                Nenhum script encontrado
              </div>
            ) : (
              filteredScripts.map((script) => {
                const isSelected = script.id === selectedScriptId;
                const status = scriptRuntimeEngine.getScriptStatus(script.id);
                const hasApplied = status.status === 'applied';
                const hasError = status.status === 'error';

                return (
                  <button
                    key={script.id}
                    onClick={() => {
                      audioSystem.playUiClick?.();
                      setSelectedScriptId(script.id);
                      setMobileDrawer('none');
                    }}
                    className={`w-full text-left p-2 rounded flex items-start justify-between gap-2 transition-colors ${
                      isSelected
                        ? 'bg-[#27272a] text-white'
                        : 'hover:bg-[#18181b] text-[#d4d4d8]'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <FileCode
                        size={15}
                        className={`mt-0.5 shrink-0 ${
                          script.character === 'agatha'
                            ? 'text-purple-400'
                            : script.character === 'ironman'
                            ? 'text-cyan-400'
                            : 'text-[#a1a1aa]'
                        }`}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate leading-tight">
                          {script.name}
                        </div>
                        <div className="text-[10px] text-[#71717a] font-mono truncate mt-0.5">
                          {script.filePath.split('/').pop()}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1 mt-0.5">
                      {hasError ? (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"
                          title="Erro na compilação"
                        />
                      ) : hasApplied ? (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"
                          title="Aplicado e ativo no jogo"
                        />
                      ) : (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0"
                          title="Pendente"
                        />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Footer Stats & Global Restore */}
          <div className="p-2 border-t border-[#27272a] text-[10px] text-[#71717a] flex items-center justify-between">
            <span>{filteredScripts.length} módulos</span>
            <button
              onClick={handleRestoreAll}
              className="text-[#a1a1aa] hover:text-amber-400 transition-colors underline decoration-dotted"
              title="Restaurar todos os scripts para o padrão de fábrica"
            >
              Restaurar Todos
            </button>
          </div>
        </aside>

        {/* Mobile backdrop for left drawer */}
        {mobileDrawer === 'left' && (
          <div
            onClick={() => setMobileDrawer('none')}
            className="md:hidden fixed inset-0 bg-black/60 z-30"
          />
        )}

        {/* ============================================================== */}
        {/* CENTER PANEL: Code Editor or Live Game Configuration */}
        {/* ============================================================== */}
        {workspace === 'config' ? (
          <GameConfigPanel onBack={() => setWorkspace('code')} />
        ) : (
        <main className="flex-1 flex flex-col bg-[#09090b] min-w-0 overflow-hidden relative">
          {/* File Header & Sub-toolbar */}
          <div className="h-10 border-b border-[#27272a] bg-[#121215] flex items-center justify-between px-3 md:px-4 shrink-0 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-white font-medium truncate">
                {activeScript?.filePath}
              </span>
              <span className="px-1.5 py-0.5 bg-[#27272a] text-[10px] rounded text-[#a1a1aa] font-mono uppercase shrink-0">
                {activeScript?.fileExtension}
              </span>

              {isScriptModified && (
                <span className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] rounded font-medium shrink-0">
                  • Modificado
                </span>
              )}

              {activeScript && (
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded font-medium shrink-0 border ${
                    scriptState.phase === 'error'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                      : scriptState.isRunning
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : scriptState.hasApplied
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
                      : scriptState.isDirty
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                  }`}
                  title={
                    scriptState.isRunning
                      ? 'A versão aplicada está executando no jogo'
                      : scriptState.hasApplied
                      ? 'Salvo e aplicado; este módulo só executa após recarregar'
                      : scriptState.isDirty
                      ? 'Rascunho ainda não aplicado'
                      : 'Sem alterações aplicadas'
                  }
                >
                  {scriptState.phase === 'error'
                    ? 'Erro'
                    : scriptState.isRunning
                    ? 'Executando'
                    : scriptState.hasApplied
                    ? 'Aplicado (recarregar)'
                    : scriptState.isDirty
                    ? 'Rascunho'
                    : 'Original'}
                </span>
              )}
            </div>

            {/* Quick Editor Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleUndo}
                disabled={historyIdx <= 0}
                className="p-1 rounded text-[#a1a1aa] hover:text-white disabled:opacity-30 hover:bg-[#1f1f23]"
                title="Desfazer (Ctrl+Z)"
              >
                <Undo2 size={14} />
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIdx >= history.length - 1}
                className="p-1 rounded text-[#a1a1aa] hover:text-white disabled:opacity-30 hover:bg-[#1f1f23]"
                title="Refazer (Ctrl+Y)"
              >
                <Redo2 size={14} />
              </button>
              <div className="w-px h-3.5 bg-[#27272a] mx-0.5" />
              <button
                onClick={handleCopy}
                className="p-1 rounded text-[#a1a1aa] hover:text-white hover:bg-[#1f1f23]"
                title="Copiar código"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
              <button
                onClick={handleValidateOnly}
                className="px-2 py-0.5 rounded border border-[#27272a] text-[#a1a1aa] hover:text-white text-[11px] hover:bg-[#1f1f23]"
                title="Apenas verificar sintaxe sem aplicar no jogo"
              >
                Validar
              </button>
              <button
                onClick={handleRestoreOriginal}
                className="px-2 py-0.5 rounded border border-[#27272a] text-[#a1a1aa] hover:text-rose-400 text-[11px] hover:bg-[#1f1f23]"
                title="Restaurar código original deste arquivo"
              >
                Restaurar
              </button>
            </div>
          </div>

          {/* Editor Workspace: Line Numbers + Textarea */}
          <div className="flex-1 flex overflow-hidden relative font-mono text-[13px] leading-relaxed">
            {/* Synchronized Line Numbers Gutter */}
            <div
              ref={lineGutterRef}
              className="w-12 bg-[#0c0c0e] border-r border-[#27272a] text-[#52525b] text-right pr-3 select-none overflow-hidden shrink-0 pt-3"
              style={{ lineHeight: '1.6' }}
            >
              {Array.from({ length: linesCount }, (_, i) => (
                <div key={i + 1} className="h-[20.8px]">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Code Input Area */}
            <div className="flex-1 h-full relative overflow-hidden bg-[#09090b]">
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                onScroll={handleScroll}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="w-full h-full p-3 bg-transparent text-[#e4e4e7] font-mono text-[13px] resize-none focus:outline-none overflow-auto whitespace-pre tab-2"
                style={{
                  lineHeight: '1.6',
                  tabSize: 2,
                  fontFamily: 'Consolas, Menlo, Monaco, "Courier New", monospace',
                }}
              />
            </div>
          </div>

          {/* Bottom Editor Status Bar */}
          <div className="h-7 border-t border-[#27272a] bg-[#101013] px-3 flex items-center justify-between text-[11px] text-[#71717a] shrink-0 font-mono">
            <div className="flex items-center gap-3">
              <span>{linesCount} linhas</span>
              <span>{code.length} caracteres</span>
              {compileStatus && (
                <span
                  className={
                    compileStatus.success
                      ? 'text-emerald-400 flex items-center gap-1'
                      : 'text-rose-400 flex items-center gap-1'
                  }
                >
                  {compileStatus.success ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {compileStatus.message}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span
                className={
                  saveState === 'saving'
                    ? 'text-amber-400'
                    : saveState === 'saved'
                    ? 'text-emerald-400'
                    : ''
                }
              >
                {saveState === 'saving'
                  ? 'Salvando...'
                  : saveState === 'saved'
                  ? `Salvo${lastSavedAt ? ` ${lastSavedAt}` : ''}`
                  : 'Salvo automaticamente'}
              </span>
              <span>UTF-8</span>
              <span>TypeScript (Sucrase Runtime)</span>
            </div>
          </div>
        </main>
        )}

        {/* ============================================================== */}
        {/* RIGHT PANEL: Context & Inspection Panel */}
        {/* ============================================================== */}
        <aside
          className={`
            border-l border-[#27272a] bg-[#101013] flex flex-col shrink-0 z-30 transition-all duration-200
            ${isRightContextOpen ? 'w-72 md:w-80' : 'w-0 hidden md:flex md:w-0 md:border-l-0 overflow-hidden'}
            ${mobileDrawer === 'right' ? 'fixed inset-y-12 right-0 w-80 flex shadow-2xl z-40' : 'hidden md:flex'}
          `}
        >
          {/* Context Panel Header & Tabs */}
          <div className="p-2 border-b border-[#27272a] flex items-center justify-between">
            <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Layers size={14} className="text-[#a1a1aa]" />
              Painel de Contexto
            </span>
            <button
              onClick={() => {
                setIsRightContextOpen(false);
                setMobileDrawer('none');
              }}
              className="text-[#71717a] hover:text-white p-1"
            >
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-4 border-b border-[#27272a] text-[11px] text-center font-medium">
            <button
              onClick={() => setContextTab('diagnostico')}
              className={`py-2 border-b-2 transition-colors ${
                contextTab === 'diagnostico'
                  ? 'border-emerald-500 text-white bg-[#18181b]'
                  : 'border-transparent text-[#a1a1aa] hover:text-white'
              }`}
            >
              Diagnóstico
            </button>
            <button
              onClick={() => setContextTab('restricoes')}
              className={`py-2 border-b-2 transition-colors ${
                contextTab === 'restricoes'
                  ? 'border-purple-500 text-white bg-[#18181b]'
                  : 'border-transparent text-[#a1a1aa] hover:text-white'
              }`}
            >
              Restrições
            </button>
            <button
              onClick={() => setContextTab('historico')}
              className={`py-2 border-b-2 transition-colors ${
                contextTab === 'historico'
                  ? 'border-cyan-500 text-white bg-[#18181b]'
                  : 'border-transparent text-[#a1a1aa] hover:text-white'
              }`}
            >
              Histórico
            </button>
            <button
              onClick={() => setContextTab('info')}
              className={`py-2 border-b-2 transition-colors ${
                contextTab === 'info'
                  ? 'border-amber-500 text-white bg-[#18181b]'
                  : 'border-transparent text-[#a1a1aa] hover:text-white'
              }`}
            >
              Módulo
            </button>
          </div>

          {/* Context Tab Contents */}
          <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3 font-sans">
            {/* 1. Diagnóstico */}
            {contextTab === 'diagnostico' && (
              <div className="space-y-3">
                <div className="p-3 bg-[#18181b] border border-[#27272a] rounded space-y-2">
                  <div className="font-semibold text-white flex items-center justify-between">
                    <span>Estado da Compilação</span>
                    {scriptStatus?.status === 'applied' ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] rounded font-mono">
                        Aplicado & Ativo
                      </span>
                    ) : scriptStatus?.status === 'error' ? (
                      <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] rounded font-mono">
                        Erro
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded font-mono">
                        Pendente
                      </span>
                    )}
                  </div>

                  <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
                    O código é compilado com transformações TypeScript e executado em tempo real no
                    Three.js/React.
                  </p>

                  {scriptStatus?.error && (
                    <div className="mt-2 p-2.5 bg-rose-950/40 border border-rose-800/60 rounded text-rose-300 font-mono text-[11px] leading-relaxed">
                      {scriptStatus.error}
                      {(scriptStatus.line || scriptStatus.column) && (
                        <div className="mt-1 text-rose-200/80">
                          Linha {scriptStatus.line ?? '?'}, coluna {scriptStatus.column ?? '?'}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                    <div className="px-2 py-1 rounded bg-[#0c0c0e] border border-[#27272a] flex items-center justify-between">
                      <span className="text-[#71717a]">Aplicado</span>
                      <span className={scriptState.hasApplied ? 'text-cyan-300' : 'text-[#52525b]'}>
                        {scriptState.hasApplied ? 'Sim' : 'Não'}
                      </span>
                    </div>
                    <div className="px-2 py-1 rounded bg-[#0c0c0e] border border-[#27272a] flex items-center justify-between">
                      <span className="text-[#71717a]">Executando</span>
                      <span className={scriptState.isRunning ? 'text-emerald-300' : 'text-[#52525b]'}>
                        {scriptState.isRunning ? 'Sim' : 'Não'}
                      </span>
                    </div>
                    <div className="px-2 py-1 rounded bg-[#0c0c0e] border border-[#27272a] flex items-center justify-between">
                      <span className="text-[#71717a]">Rascunho</span>
                      <span className={scriptState.isDirty ? 'text-amber-300' : 'text-[#52525b]'}>
                        {scriptState.isDirty ? 'Não aplicado' : 'Sincronizado'}
                      </span>
                    </div>
                    <div className="px-2 py-1 rounded bg-[#0c0c0e] border border-[#27272a] flex items-center justify-between">
                      <span className="text-[#71717a]">Revisão</span>
                      <span className="text-[#a1a1aa] font-mono">{scriptState.revision}</span>
                    </div>
                  </div>

                  {!scriptState.supportsLiveApply && (
                    <div className="p-2 rounded bg-amber-950/30 border border-amber-800/50 text-amber-300 text-[10px] leading-relaxed">
                      Módulo de bootstrap: o código pode ser validado e salvo, mas só entra em
                      execução após a página ser recarregada. Ele nunca fica marcado como
                      &quot;executando&quot; sem realmente estar.
                    </div>
                  )}

                  {compileStatus?.timestamp && (
                    <div className="text-[10px] text-[#71717a] pt-1">
                      Última execução: {compileStatus.timestamp}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-[#18181b] border border-[#27272a] rounded space-y-2">
                  <div className="font-semibold text-white">Fluxo de Aplicação Confiável</div>
                  <ol className="text-[#a1a1aa] text-[11px] space-y-1.5 list-decimal pl-4">
                    <li>Edite o código fonte modular do poder.</li>
                    <li>Clique em <b>Aplicar no Jogo</b>.</li>
                    <li>O personagem correspondente é ativado automaticamente.</li>
                    <li>Clique em <b>PLAY TEST</b> para testar imediatamente.</li>
                  </ol>
                </div>
              </div>
            )}

            {/* 2. Restrições de Gameplay em Tempo Real */}
            {contextTab === 'restricoes' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Status Ativos no Jogo</span>
                  <button
                    onClick={() => {
                      gameplayRestrictions.clearAll();
                      showToast('Todas as restrições foram limpas', 'info');
                    }}
                    className="text-[10px] text-[#a1a1aa] hover:text-white underline"
                  >
                    Limpar Todas
                  </button>
                </div>

                {activeRestrictions.length === 0 ? (
                  <div className="p-4 bg-[#18181b] border border-[#27272a] rounded text-center text-[#71717a] text-[11px]">
                    Nenhuma restrição ativa no momento. Todas as ações do personagem estão livres.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeRestrictions.map((r, idx) => (
                      <div
                        key={`${r.type}-${r.source}-${idx}`}
                        className="p-2.5 bg-[#18181b] border border-[#27272a] rounded flex items-start justify-between"
                      >
                        <div>
                          <div className="font-semibold text-purple-400 font-mono">{r.type}</div>
                          <div className="text-[10px] text-[#71717a] mt-0.5">Fonte: {r.source}</div>
                        </div>
                        {r.timeRemaining !== undefined && (
                          <div className="text-[10px] font-mono text-amber-400">
                            {r.timeRemaining.toFixed(1)}s
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-2.5 bg-[#18181b] border border-[#27272a] rounded text-[11px] text-[#a1a1aa] space-y-1">
                  <div className="font-semibold text-white">Identificadores Padronizados:</div>
                  <div className="font-mono text-[10px] text-zinc-400">
                    NoPowers • NoMovement • NoFlight • NoBasicAttack • IsShield • Anchored •
                    Invulnerable • Stunned • Silenced
                  </div>
                </div>
              </div>
            )}

            {/* 3. Histórico de Versões */}
            {contextTab === 'historico' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-white">Snapshots Salvos</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        audioSystem.playUiClick?.();
                        const json = scriptRuntimeEngine.exportBackup();
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `stickman-scripts-${Date.now()}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        showToast('Backup de scripts exportado', 'success');
                      }}
                      className="text-[10px] text-[#a1a1aa] hover:text-white underline decoration-dotted"
                    >
                      Exportar
                    </button>
                    <button
                      onClick={() => {
                        audioSystem.playUiClick?.();
                        importInputRef.current?.click();
                      }}
                      className="text-[10px] text-[#a1a1aa] hover:text-white underline decoration-dotted flex items-center gap-1"
                    >
                      <Upload size={10} />
                      Importar
                    </button>
                    <input
                      ref={importInputRef}
                      type="file"
                      accept="application/json,.json"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const res = scriptRuntimeEngine.importBackup(String(reader.result || ''));
                          showToast(res.message, res.success ? 'success' : 'warn');
                        };
                        reader.readAsText(file);
                        e.target.value = '';
                      }}
                    />
                    <button
                      onClick={handleRollback}
                      disabled={backups.length < 2}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 disabled:opacity-40 underline"
                    >
                      Reverter 1 Versão
                    </button>
                  </div>
                </div>

                {backups.length === 0 ? (
                  <div className="p-4 bg-[#18181b] border border-[#27272a] rounded text-center text-[#71717a] text-[11px]">
                    Nenhuma versão anterior registrada.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {backups.map((b, idx) => (
                      <div
                        key={b.id}
                        className="p-2.5 bg-[#18181b] border border-[#27272a] rounded flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-white text-[11px]">{b.label}</div>
                          <div className="text-[10px] text-[#71717a] font-mono">
                            {new Date(b.timestamp).toLocaleTimeString('pt-BR')}
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (!activeScript) return;
                            audioSystem.playUiClick?.();
                            const res = await scriptRuntimeEngine.applyBackup(
                              activeScript.id,
                              b.id,
                              gameScene
                            );
                            setCode(b.code);
                            showToast(
                              res.success
                                ? `Restaurado para: ${b.label}`
                                : res.message || 'Não foi possível restaurar este snapshot',
                              res.success ? 'success' : 'warn'
                            );
                          }}
                          className="px-2 py-1 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded text-[10px] font-medium"
                        >
                          Restaurar
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 4. Sobre o Módulo */}
            {contextTab === 'info' && activeScript && (
              <div className="space-y-3">
                <div className="p-3 bg-[#18181b] border border-[#27272a] rounded space-y-2">
                  <div className="font-semibold text-white">{activeScript.name}</div>
                  <p className="text-[#a1a1aa] text-[11px] leading-relaxed">
                    {activeScript.summary}
                  </p>
                </div>

                <div className="p-3 bg-[#18181b] border border-[#27272a] rounded space-y-2">
                  <div className="font-semibold text-white">Dependências Resolvidas</div>
                  {activeScript.dependencies.length === 0 ? (
                    <div className="text-[#71717a] text-[11px]">Nenhuma dependência local</div>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {activeScript.dependencies.map((d) => (
                        <span
                          key={d}
                          className="px-2 py-0.5 bg-[#27272a] text-[10px] font-mono rounded text-[#d4d4d8]"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-3 bg-[#18181b] border border-[#27272a] rounded space-y-1 text-[11px] text-[#a1a1aa]">
                  <div>
                    <span className="text-[#71717a]">Categoria:</span> {activeScript.category}
                  </div>
                  <div>
                    <span className="text-[#71717a]">Caminho:</span> {activeScript.filePath}
                  </div>
                  <div>
                    <span className="text-[#71717a]">Tipo:</span> {activeScript.fileExtension.toUpperCase()}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Mobile backdrop for right drawer */}
        {mobileDrawer === 'right' && (
          <div
            onClick={() => setMobileDrawer('none')}
            className="md:hidden fixed inset-0 bg-black/60 z-30"
          />
        )}
      </div>

      {/* Floating Toast Alerts */}
      <BuildToast toasts={toasts} />
    </div>
  );
};
