import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileCode,
  Folder,
  FolderOpen,
  Layers,
  RotateCcw,
  Search,
  Shield,
  X,
} from 'lucide-react';
import type { ProjectScriptInfo } from '../../game/RealProjectScripts';
import { scriptRuntimeEngine } from '../../game/ScriptRuntimeEngine';
import { audioSystem } from '../../game/AudioSystem';
import {
  buildScriptExplorerTree,
  collectExpandedDefaults,
  filterExplorerTree,
  type ExplorerIcon,
  type ExplorerNode,
} from '../../game/ScriptExplorerTree';

const WIDTH_KEY = 'playground.scriptExplorer.width';
const COLLAPSED_KEY = 'playground.scriptExplorer.collapsed';

const GROUPS = [
  { id: 'all', label: 'Todos' },
  { id: 'characters', label: 'Personagens' },
  { id: 'systems', label: 'Sistemas' },
  { id: 'interface', label: 'Interface' },
] as const;

const ICONS: Record<ExplorerIcon, React.ComponentType<{ size?: number; className?: string }>> = {
  root: Layers,
  folder: Folder,
  character: Shield,
  ability: FileCode,
  controller: Layers,
  system: Layers,
  flight: Layers,
  combat: FileCode,
  animation: Layers,
  sound: Layers,
  vfx: Layers,
  movement: Layers,
  cooldown: Layers,
  restrictions: Shield,
  world: Layers,
  script: FileCode,
  config: FileCode,
  ui: FileCode,
  modal: FileCode,
  device: Shield,
};

function readNumber(key: string, fallback: number): number {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) && value > 0 ? value : fallback;
  } catch {
    return fallback;
  }
}

function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === 'true';
  } catch {
    return fallback;
  }
}

interface ScriptExplorerProps {
  scripts: ProjectScriptInfo[];
  selectedScriptId: string;
  onSelectScript: (id: string) => void;
  onRestoreAll: () => void;
  mobileOpen?: boolean;
}

interface RowProps {
  node: ExplorerNode;
  depth: number;
  selectedScriptId: string;
  expanded: Record<string, boolean>;
  searching: boolean;
  onToggle: (id: string) => void;
  onSelectScript: (id: string) => void;
}

const StatusDot: React.FC<{ script: ProjectScriptInfo }> = ({ script }) => {
  const status = scriptRuntimeEngine.getScriptStatus(script.id);
  const state = scriptRuntimeEngine.getScriptState(script.id);
  const hasApplied = status.status === 'applied';
  const hasRestartApplied =
    state.capability === 'restart-required' && state.appliedSource !== null;

  if (status.status === 'error') {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500" title="Erro na compilação" />;
  }
  if (hasApplied) {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" title="Aplicado e ativo no jogo" />;
  }
  if (hasRestartApplied) {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-500" title="Aplicado para o próximo build/reinício" />;
  }
  if ((script.runtimeIntegration || 'hot-swap') !== 'hot-swap') {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" title="Exige reinicialização do jogo" />;
  }
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" title="Pendente" />;
};

const Row: React.FC<RowProps> = ({
  node,
  depth,
  selectedScriptId,
  expanded,
  searching,
  onToggle,
  onSelectScript,
}) => {
  const Icon = ICONS[node.icon] || FileCode;
  const isFolder = node.kind === 'folder';
  const isOpen = isFolder && (searching || expanded[node.id] === true);
  const script = node.scriptId
    ? scriptRuntimeEngine.getScriptById(node.scriptId)
    : null;
  const isSelected = node.kind === 'script' && node.scriptId === selectedScriptId;

  return (
    <div role="none">
      <button
        type="button"
        role="treeitem"
        aria-expanded={isFolder ? isOpen : undefined}
        aria-selected={isSelected}
        title={node.label}
        onClick={() => {
          audioSystem.playUiClick?.();
          if (isFolder) onToggle(node.id);
          else if (node.scriptId) onSelectScript(node.scriptId);
        }}
        className={`group flex w-full items-center gap-1.5 rounded py-[5px] pr-2 text-left transition-colors ${
          isSelected
            ? 'bg-[#27272a] text-white'
            : 'text-[#c4c4cc] hover:bg-[#18181b] hover:text-white'
        }`}
        style={{ paddingLeft: `${7 + depth * 13}px` }}
      >
        {isFolder ? (
          isOpen ? (
            <ChevronDown size={12} className="shrink-0 text-[#71717a]" />
          ) : (
            <ChevronRight size={12} className="shrink-0 text-[#71717a]" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {isFolder && isOpen ? (
          <FolderOpen size={14} className="shrink-0 text-[#a1a1aa]" />
        ) : (
          <Icon
            size={14}
            className={`shrink-0 ${
              node.icon === 'character'
                ? 'text-purple-400'
                : node.icon === 'flight' || node.icon === 'system'
                ? 'text-cyan-400'
                : 'text-[#a1a1aa]'
            }`}
          />
        )}

        <span
          className={`min-w-0 flex-1 truncate text-[11.5px] ${
            isFolder ? 'font-medium' : ''
          }`}
        >
          {node.label}
        </span>

        {script && <StatusDot script={script} />}
      </button>

      {isFolder && isOpen && node.children && (
        <div role="group" className="space-y-px">
          {node.children.map((child) => (
            <Row
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedScriptId={selectedScriptId}
              expanded={expanded}
              searching={searching}
              onToggle={onToggle}
              onSelectScript={onSelectScript}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const ScriptExplorer: React.FC<ScriptExplorerProps> = ({
  scripts,
  selectedScriptId,
  onSelectScript,
  onRestoreAll,
  mobileOpen = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<(typeof GROUPS)[number]['id']>('all');
  const [width, setWidth] = useState(() => Math.min(384, Math.max(228, readNumber(WIDTH_KEY, 272))));
  const [collapsed, setCollapsed] = useState(() => readBoolean(COLLAPSED_KEY, false));
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    collectExpandedDefaults(buildScriptExplorerTree(scripts))
  );
  const resizingRef = useRef(false);

  const tree = useMemo(() => buildScriptExplorerTree(scripts), [scripts]);
  const searching = searchQuery.trim().length > 0;
  const visibleTree = useMemo(
    () => filterExplorerTree(tree, searchQuery, activeGroup),
    [tree, searchQuery, activeGroup]
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(WIDTH_KEY, String(width));
    } catch {
      // Storage may be unavailable in private mode; the explorer still resizes.
    }
  }, [width]);

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSED_KEY, String(collapsed));
    } catch {
      // Ignore storage failures.
    }
  }, [collapsed]);

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!resizingRef.current) return;
      setWidth(Math.min(384, Math.max(228, event.clientX)));
    };
    const onUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const toggleFolder = useCallback((id: string) => {
    setExpanded((current) => ({ ...current, [id]: !current[id] }));
  }, []);

  const isCollapsed = collapsed && !mobileOpen;

  if (isCollapsed) {
    return (
      <aside className="relative z-30 flex w-10 shrink-0 flex-col items-center border-r border-[#27272a] bg-[#101013] py-2">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="rounded p-1.5 text-[#a1a1aa] transition-colors hover:bg-[#27272a] hover:text-white"
          title="Expandir Explorer de scripts"
          aria-label="Expandir Explorer de scripts"
        >
          <Layers size={16} />
        </button>
        <div className="mt-3 select-none text-[9px] font-semibold tracking-[0.18em] text-[#52525b] [writing-mode:vertical-rl]">
          SCRIPTS · {scripts.length}
        </div>
      </aside>
    );
  }

  const characterCount = tree.children?.find((node) => node.id === 'folder:characters')?.children?.length || 0;
  const systemCount = tree.children?.find((node) => node.id === 'folder:systems')?.children?.length || 0;
  const interfaceCount = tree.children?.find((node) => node.id === 'folder:interface')?.children?.length || 0;

  return (
    <aside
      className="relative z-30 flex shrink-0 flex-col border-r border-[#27272a] bg-[#101013]"
      style={{ width, maxWidth: '86vw' }}
      aria-label="Explorer de scripts"
    >
      <div className="flex items-center justify-between border-b border-[#27272a] px-2.5 py-2">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a1a1aa]">
          <Layers size={13} />
          Explorer
        </div>
        <div className="flex items-center gap-1">
          <span className="rounded bg-[#18181b] px-1.5 py-0.5 font-mono text-[9px] text-[#71717a]">
            {scripts.length}
          </span>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="rounded p-1 text-[#71717a] transition-colors hover:bg-[#27272a] hover:text-white"
            title="Minimizar Explorer"
            aria-label="Minimizar Explorer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="border-b border-[#27272a] p-2">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#71717a]" />
          <input
            type="text"
            placeholder="Buscar scripts e sistemas..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded border border-[#27272a] bg-[#18181b] py-1.5 pl-8 pr-7 text-[11px] text-white placeholder-[#71717a] outline-none transition-colors focus:border-zinc-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#71717a] hover:text-white"
              aria-label="Limpar busca"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-0.5 overflow-x-auto text-[9.5px] no-scrollbar">
          {GROUPS.map((group) => {
            const count =
              group.id === 'all'
                ? scripts.length
                : group.id === 'characters'
                ? characterCount
                : group.id === 'systems'
                ? systemCount
                : interfaceCount;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroup(group.id)}
                className={`whitespace-nowrap rounded px-1.5 py-1 transition-colors ${
                  activeGroup === group.id
                    ? 'bg-[#27272a] text-white'
                    : 'text-[#71717a] hover:bg-[#18181b] hover:text-[#d4d4d8]'
                }`}
              >
                {group.label}
                <span className="ml-1 font-mono opacity-50">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1.5" role="tree" aria-label="Scripts do projeto">
        {!visibleTree || !visibleTree.children?.length ? (
          <div className="px-2 py-8 text-center text-[11px] text-[#71717a]">
            Nenhum script encontrado
          </div>
        ) : (
          <div className="space-y-px">
            {visibleTree.children.map((node) => (
              <Row
                key={node.id}
                node={node}
                depth={0}
                selectedScriptId={selectedScriptId}
                expanded={expanded}
                searching={searching}
                onToggle={toggleFolder}
                onSelectScript={(id) => {
                  onSelectScript(id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#27272a] px-2.5 py-1.5 text-[9.5px] text-[#71717a]">
        <span>{scripts.length} módulos</span>
        <button
          type="button"
          onClick={onRestoreAll}
          className="flex items-center gap-1 transition-colors hover:text-amber-400"
          title="Restaurar todos os scripts para o padrão de fábrica"
        >
          <RotateCcw size={10} />
          Restaurar
        </button>
      </div>

      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Redimensionar Explorer"
        onPointerDown={() => {
          resizingRef.current = true;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
        }}
        className="absolute -right-1 top-0 z-40 hidden h-full w-2 cursor-col-resize md:block"
      />
    </aside>
  );
};
