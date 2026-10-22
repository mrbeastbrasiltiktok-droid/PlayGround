/**
 * ScriptPersistence.ts
 * Single source of truth for the script editor.
 *
 * Every script tracks independent, verifiable states:
 * original -> draft -> validated -> applied -> running -> last working.
 *
 * localStorage is the synchronous mirror used for instant UI reads and for
 * migration from the old keys. IndexedDB is the durable copy. Writes are
 * serialized so a slower write can never overwrite a newer revision.
 */

import { PROJECT_SCRIPTS } from './RealProjectScripts';

export interface WorkingBackup {
  id: string;
  timestamp: number;
  label: string;
  code: string;
  kind?: 'original' | 'applied' | 'last-working' | 'manual' | 'recovered';
  revision?: number;
}

export type ScriptErrorKind = 'syntax' | 'dependency' | 'integration' | 'runtime';

export interface ScriptRecord {
  id: string;
  draft: string | null;
  draftUpdatedAt: number;
  applied: string | null;
  appliedAt: number;
  validated: string | null;
  validatedAt: number;
  lastWorking: string | null;
  lastWorkingAt: number;
  backups: WorkingBackup[];
  revision: number;
  lastError: string | null;
  lastErrorKind: ScriptErrorKind | null;
  lastErrorAt: number;
}

export interface ScriptRepositorySnapshot {
  schemaVersion: number;
  revision: number;
  updatedAt: number;
  scripts: Record<string, ScriptRecord>;
}

const SNAPSHOT_KEY = 'stickman_script_repository_v4';
const LEGACY_DRAFT_PREFIX = 'script_draft_';
const LEGACY_APPLIED_PREFIX = 'script_applied_';
const LEGACY_SOURCE_PREFIX = 'script_source_';
const DB_NAME = 'stickman_script_db';
const DB_STORE = 'snapshots';
const DB_KEY = 'official';
const SCHEMA_VERSION = 4;
const MAX_BACKUPS = 30;

const now = () => Date.now();
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function emptyRecord(id: string, original: string): ScriptRecord {
  return {
    id,
    draft: null,
    draftUpdatedAt: 0,
    applied: null,
    appliedAt: 0,
    validated: null,
    validatedAt: 0,
    lastWorking: null,
    lastWorkingAt: 0,
    backups: original
      ? [
          {
            id: `orig-${id}`,
            timestamp: 0,
            label: 'Versão Original de Fábrica',
            code: original,
            kind: 'original',
            revision: 0,
          },
        ]
      : [],
    revision: 0,
    lastError: null,
    lastErrorKind: null,
    lastErrorAt: 0,
  };
}

function normalizeRecord(raw: Partial<ScriptRecord>, id: string, original: string): ScriptRecord {
  const base = emptyRecord(id, original);
  const backups = Array.isArray(raw.backups)
    ? raw.backups.filter(
        (b): b is WorkingBackup =>
          !!b && typeof b.code === 'string' && typeof b.id === 'string' && typeof b.timestamp === 'number'
      )
    : base.backups;

  if (original && !backups.some((b) => b.kind === 'original')) {
    backups.unshift(base.backups[0]);
  }

  const legacyApplied = (() => {
    try {
      return (
        localStorage.getItem(`${LEGACY_APPLIED_PREFIX}${id}`) ||
        localStorage.getItem(`${LEGACY_SOURCE_PREFIX}${id}`) ||
        null
      );
    } catch {
      return null;
    }
  })();

  const applied = typeof raw.applied === 'string' ? raw.applied : legacyApplied;
  const appliedAt = raw.appliedAt || (applied ? now() : 0);

  let draft = typeof raw.draft === 'string' ? raw.draft : null;
  if (draft === null) {
    try {
      draft = localStorage.getItem(`${LEGACY_DRAFT_PREFIX}${id}`);
    } catch {
      draft = null;
    }
  }

  const lastWorking = typeof raw.lastWorking === 'string' ? raw.lastWorking : applied;

  if (applied && !backups.some((b) => b.code === applied)) {
    backups.unshift({
      id: `recovered-${id}-${appliedAt}`,
      timestamp: appliedAt,
      label: 'Versão Aplicada Recuperada',
      code: applied,
      kind: 'recovered',
      revision: raw.revision || 1,
    });
  }

  return {
    ...base,
    ...raw,
    id,
    draft,
    applied,
    appliedAt,
    validated: typeof raw.validated === 'string' ? raw.validated : null,
    validatedAt: raw.validatedAt || 0,
    lastWorking,
    lastWorkingAt: raw.lastWorkingAt || (lastWorking ? appliedAt : 0),
    backups: backups.slice(0, MAX_BACKUPS),
    revision: typeof raw.revision === 'number' ? raw.revision : applied || draft ? 1 : 0,
    lastError: typeof raw.lastError === 'string' ? raw.lastError : null,
    lastErrorKind: (raw.lastErrorKind as ScriptErrorKind) || null,
    lastErrorAt: raw.lastErrorAt || 0,
  };
}

class ScriptPersistence {
  private snapshot: ScriptRepositorySnapshot = {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    updatedAt: 0,
    scripts: {},
  };
  private listeners: Set<() => void> = new Set();
  private writeChain: Promise<void> = Promise.resolve();
  private dbPromise: Promise<IDBDatabase | null> | null = null;
  private initializedIdb = false;
  private originals: Record<string, string> = {};
  private draftTimer: number | null = null;

  constructor() {
    PROJECT_SCRIPTS.forEach((s) => {
      this.originals[s.id] = s.originalSource;
    });
    this.loadLocalSnapshot();
    this.migrateLegacyKeys();
    this.writeLocalSnapshot();
    this.initializedIdb = true;
    void this.hydrateFromIndexedDb();
    if (typeof window !== 'undefined') {
      const flush = () => this.flushPendingPersist();
      window.addEventListener('beforeunload', flush);
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
      });
    }
  }

  /**
   * Coalesces rapid draft edits into a single durable write so typing in the
   * editor stays responsive even for very large source files.
   */
  private schedulePersist(reason: string): void {
    if (typeof window === 'undefined') {
      this.persist(reason);
      return;
    }
    if (this.draftTimer !== null) {
      window.clearTimeout(this.draftTimer);
    }
    this.draftTimer = window.setTimeout(() => {
      this.draftTimer = null;
      this.persist(reason);
    }, 350);
  }

  public flushPendingPersist(): void {
    if (this.draftTimer !== null) {
      window.clearTimeout(this.draftTimer);
      this.draftTimer = null;
      this.persist('draft-flush');
    }
  }

  public registerOriginals(scripts: { id: string; originalSource: string }[]): void {
    scripts.forEach((s) => {
      this.originals[s.id] = s.originalSource;
      if (!this.snapshot.scripts[s.id]) {
        this.snapshot.scripts[s.id] = emptyRecord(s.id, s.originalSource);
      }
    });
  }

  private readLocal<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private loadLocalSnapshot(): void {
    const local = this.readLocal<ScriptRepositorySnapshot>(SNAPSHOT_KEY);
    if (local && local.schemaVersion && local.scripts) {
      this.snapshot = {
        schemaVersion: SCHEMA_VERSION,
        revision: Number(local.revision) || 0,
        updatedAt: Number(local.updatedAt) || 0,
        scripts: {},
      };
      Object.entries(local.scripts).forEach(([id, record]) => {
        this.snapshot.scripts[id] = normalizeRecord(record, id, this.originals[id] || '');
      });
    }
    Object.entries(this.originals).forEach(([id, source]) => {
      if (!this.snapshot.scripts[id]) {
        this.snapshot.scripts[id] = emptyRecord(id, source);
      }
    });
  }

  private migrateLegacyKeys(): void {
    Object.entries(this.originals).forEach(([id, source]) => {
      const record = this.snapshot.scripts[id] || emptyRecord(id, source);
      this.snapshot.scripts[id] = normalizeRecord(record, id, source);
    });
  }

  private getDb(): Promise<IDBDatabase | null> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') {
          resolve(null);
          return;
        }
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(DB_STORE)) {
            db.createObjectStore(DB_STORE);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.dbPromise;
  }

  private async hydrateFromIndexedDb(): Promise<void> {
    if (!this.initializedIdb) return;
    const db = await this.getDb();
    if (!db) return;
    try {
      const stored = await new Promise<ScriptRepositorySnapshot | null>((resolve) => {
        const tx = db.transaction(DB_STORE, 'readonly');
        const req = tx.objectStore(DB_STORE).get(DB_KEY);
        req.onsuccess = () => resolve((req.result as ScriptRepositorySnapshot) || null);
        req.onerror = () => resolve(null);
      });

      if (!stored || !stored.scripts) return;
      if ((stored.revision || 0) <= this.snapshot.revision) return;

      Object.entries(stored.scripts).forEach(([id, record]) => {
        const original = this.originals[id] || '';
        const normalized = normalizeRecord(record, id, original);
        const local = this.snapshot.scripts[id];
        if (!local || normalized.revision >= local.revision) {
          this.snapshot.scripts[id] = normalized;
        }
      });
      this.snapshot.revision = stored.revision;
      this.snapshot.updatedAt = stored.updatedAt;
      this.writeLocalSnapshot(false);
      this.notify();
    } catch {
      // IndexedDB is an additional durable copy; localStorage remains usable.
    }
  }

  private writeLocalSnapshot(notify = true): void {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(this.snapshot));
    } catch {
      // Ignore quota errors; IndexedDB may still succeed.
    }
    if (notify) this.notify();
  }

  private persist(reason: string): void {
    this.snapshot.revision += 1;
    this.snapshot.updatedAt = now();
    this.writeLocalSnapshot();
    const snapshot = clone(this.snapshot);
    this.writeChain = this.writeChain
      .then(async () => {
        const db = await this.getDb();
        if (!db) return;
        await new Promise<void>((resolve) => {
          const tx = db.transaction(DB_STORE, 'readwrite');
          tx.objectStore(DB_STORE).put(snapshot, DB_KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        });
      })
      .catch(() => {
        console.warn(`[ScriptPersistence] Falha ao persistir (${reason}), cópia local mantida.`);
      });
  }

  public get(id: string, originalSource?: string): ScriptRecord {
    const original = originalSource ?? this.originals[id] ?? '';
    const existing = this.snapshot.scripts[id];
    if (!existing) {
      const created = emptyRecord(id, original);
      this.snapshot.scripts[id] = created;
      this.persist('create');
      return clone(created);
    }
    return clone(existing);
  }

  public getDraft(id: string, originalSource: string): string {
    const record = this.get(id, originalSource);
    return record.draft ?? record.applied ?? originalSource;
  }

  public getEffectiveCode(id: string, originalSource: string): string {
    const record = this.get(id, originalSource);
    return record.applied ?? record.lastWorking ?? originalSource;
  }

  public setDraft(id: string, code: string, originalSource: string): ScriptRecord {
    const record = this.get(id, originalSource);
    record.draft = code;
    record.draftUpdatedAt = now();
    record.revision += 1;
    this.snapshot.scripts[id] = record;
    this.schedulePersist('draft');
    return clone(record);
  }

  public markValidated(id: string, code: string, originalSource: string): ScriptRecord {
    const record = this.get(id, originalSource);
    record.validated = code;
    record.validatedAt = now();
    record.lastError = null;
    record.lastErrorKind = null;
    record.lastErrorAt = 0;
    record.revision += 1;
    this.snapshot.scripts[id] = record;
    this.persist('validated');
    return clone(record);
  }

  public commitApplied(
    id: string,
    code: string,
    originalSource: string,
    label?: string
  ): ScriptRecord {
    const record = this.get(id, originalSource);
    record.applied = code;
    record.appliedAt = now();
    record.lastWorking = code;
    record.lastWorkingAt = record.appliedAt;
    record.lastError = null;
    record.lastErrorKind = null;
    record.lastErrorAt = 0;
    record.revision += 1;
    record.backups = this.withBackup(record.backups, {
      id: `bk-${id}-${record.revision}-${record.appliedAt}`,
      timestamp: record.appliedAt,
      label: label || `Versão Aplicada (${new Date(record.appliedAt).toLocaleString('pt-BR')})`,
      code,
      kind: 'applied',
      revision: record.revision,
    });
    this.snapshot.scripts[id] = record;
    this.persist('applied');
    return clone(record);
  }

  public markError(
    id: string,
    error: string,
    kind: ScriptErrorKind,
    originalSource: string
  ): ScriptRecord {
    const record = this.get(id, originalSource);
    record.lastError = error;
    record.lastErrorKind = kind;
    record.lastErrorAt = now();
    record.revision += 1;
    this.snapshot.scripts[id] = record;
    this.persist('error');
    return clone(record);
  }

  public addManualBackup(
    id: string,
    code: string,
    originalSource: string,
    label?: string
  ): ScriptRecord {
    const record = this.get(id, originalSource);
    record.revision += 1;
    record.backups = this.withBackup(record.backups, {
      id: `manual-${id}-${record.revision}-${now()}`,
      timestamp: now(),
      label: label || `Backup Manual (${new Date().toLocaleString('pt-BR')})`,
      code,
      kind: 'manual',
      revision: record.revision,
    });
    this.snapshot.scripts[id] = record;
    this.persist('manual-backup');
    return clone(record);
  }

  public resetToOriginal(id: string, originalSource: string): ScriptRecord {
    const record = this.get(id, originalSource);
    const previous = record.applied && record.applied !== originalSource ? record.applied : record.draft;
    record.revision += 1;
    if (previous && previous !== originalSource) {
      record.backups = this.withBackup(record.backups, {
        id: `before-reset-${id}-${record.revision}`,
        timestamp: now(),
        label: 'Versão personalizada preservada antes da restauração',
        code: previous,
        kind: 'manual',
        revision: record.revision,
      });
    }
    record.draft = null;
    record.draftUpdatedAt = 0;
    record.applied = null;
    record.appliedAt = 0;
    record.validated = null;
    record.validatedAt = 0;
    record.lastError = null;
    record.lastErrorKind = null;
    record.lastErrorAt = 0;
    this.snapshot.scripts[id] = record;
    this.persist('reset');
    return clone(record);
  }

  private withBackup(backups: WorkingBackup[], backup: WorkingBackup): WorkingBackup[] {
    const deduped = backups.filter(
      (b, index) =>
        !(index === 0 && b.code === backup.code && b.kind !== 'original') &&
        (b.kind === 'original' || b.code !== backup.code)
    );
    return [backup, ...deduped].slice(0, MAX_BACKUPS);
  }

  public listBackups(id: string, originalSource: string): WorkingBackup[] {
    return this.get(id, originalSource).backups;
  }

  public getBackup(id: string, backupId: string, originalSource: string): WorkingBackup | null {
    return this.listBackups(id, originalSource).find((b) => b.id === backupId) || null;
  }

  public exportSnapshot(): string {
    return JSON.stringify(
      {
        ...this.snapshot,
        exportedAt: now(),
        application: 'Stickman Script Engine',
      },
      null,
      2
    );
  }

  public importSnapshot(json: string): { success: boolean; message: string } {
    try {
      const parsed = JSON.parse(json) as Partial<ScriptRepositorySnapshot>;
      if (!parsed || typeof parsed !== 'object' || !parsed.scripts) {
        return { success: false, message: 'Backup inválido: campo "scripts" ausente.' };
      }
      let imported = 0;
      Object.entries(parsed.scripts).forEach(([id, raw]) => {
        const original = this.originals[id] || '';
        if (!this.snapshot.scripts[id] || !original) return;
        const next = normalizeRecord(raw as ScriptRecord, id, original);
        const current = this.snapshot.scripts[id];
        if (next.revision > current.revision) {
          this.snapshot.scripts[id] = next;
          imported += 1;
        }
      });
      this.persist('import');
      return {
        success: true,
        message: `Backup importado. ${imported} script(s) atualizado(s) sem sobrescrever revisões mais novas.`,
      };
    } catch (e) {
      return { success: false, message: `JSON inválido: ${(e as Error).message}` };
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        // Listeners must not break persistence.
      }
    });
  }
}

export const scriptPersistence = new ScriptPersistence();
