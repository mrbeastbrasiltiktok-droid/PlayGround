#!/usr/bin/env node
/**
 * End-to-end synchronization test:
 * draft -> save -> reload -> apply -> run -> reload -> export -> verify.
 *
 * It uses a disposable Chromium profile and restores the real applied-scripts
 * file in `finally`, so a failed assertion cannot leave test code applied.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { strFromU8, unzipSync } from 'fflate';

const ROOT = process.cwd();
const PORT = Number(process.env.SYNC_TEST_PORT || 4182);
const CDP = Number(process.env.SYNC_TEST_CDP || 9232);
const URL = `http://127.0.0.1:${PORT}/`;
const OUT = process.env.SYNC_TEST_ZIP || '/tmp/opencode/MeuJogo-Sync-Test.zip';
const PROFILE = `/tmp/opencode/chrome-sync-${PORT}`;
const APPLIED = path.join(ROOT, '.build-script/applied-scripts.json');
const CUSTOM_NAME = 'Sync Test';
const CUSTOM_ID = 'custom-synctest';
const DAMAGE_MARK = '\n// __sync_test_damage__\n';
const CODE_A = `export function onUpdate(_scene: any, _dt: number): void {
  (globalThis as any).__syncTicks = ((globalThis as any).__syncTicks || 0) + 1;
}
`;
const CODE_B = `export function onUpdate(_scene: any, _dt: number): void {
  (globalThis as any).__syncTicks = ((globalThis as any).__syncTicks || 0) + 1000;
}
`;

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' :: ' + detail : ''}`);
}

async function waitHttp(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {}
    await sleep(300);
  }
  return false;
}

async function waitJson(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {}
    await sleep(300);
  }
  throw new Error(`timeout ${url}`);
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.errors = [];
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
      } else if (message.method === 'Runtime.exceptionThrown') {
        this.errors.push(
          message.params?.exceptionDetails?.exception?.description || 'exception'
        );
      } else if (message.method === 'Runtime.consoleAPICalled' && message.params?.type === 'error') {
        this.errors.push(
          (message.params.args || []).map((arg) => arg.value ?? arg.description).join(' ')
        );
      }
    });
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description || 'evaluation failed');
    }
    return result.result?.value;
  }
}

async function waitForReady(cdp, label) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await sleep(400);
    const ready = await cdp.evaluate(
      "import('/src/game/ScriptRuntimeEngine.ts').then(m => !!(m.scriptRuntimeEngine.isEngineReady() && m.scriptRuntimeEngine.getGameScene())).catch(() => false)"
    );
    if (ready) return;
  }
  throw new Error(`${label}: game scene did not become ready`);
}

function backupAppliedState() {
  return fs.existsSync(APPLIED) ? fs.readFileSync(APPLIED) : null;
}

function restoreAppliedState(backup) {
  fs.mkdirSync(path.dirname(APPLIED), { recursive: true });
  if (backup) fs.writeFileSync(APPLIED, backup);
  else fs.rmSync(APPLIED, { force: true });
}

let dev;
let chrome;
let appliedBackup = null;
try {
  appliedBackup = backupAppliedState();
  restoreAppliedState(null);
  fs.rmSync(PROFILE, { recursive: true, force: true });

  dev = spawn(
    'node_modules/.bin/vite',
    ['--port', String(PORT), '--strictPort', '--host', '127.0.0.1'],
    { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] }
  );
  if (!(await waitHttp(URL))) throw new Error('vite did not start');

  chrome = spawn(
    'chromium',
    [
      '--headless=new',
      `--remote-debugging-port=${CDP}`,
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--use-gl=swiftshader',
      '--enable-unsafe-swiftshader',
      `--user-data-dir=${PROFILE}`,
    ],
    { stdio: ['ignore', 'ignore', 'ignore'] }
  );
  await waitJson(`http://127.0.0.1:${CDP}/json/version`);
  const target = await (
    await fetch(`http://127.0.0.1:${CDP}/json/new?${encodeURIComponent(URL)}`, {
      method: 'PUT',
    })
  ).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  const cdp = new Cdp(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Page.navigate', { url: URL });
  await waitForReady(cdp, 'initial load');

  // Phase 1: save a draft, apply A, then leave a newer draft B unapplied.
  const phase1 = await cdp.evaluate(`(async () => {
    const { scriptRuntimeEngine: engine } = await import('/src/game/ScriptRuntimeEngine.ts');
    await engine.whenReady();
    const scene = engine.getGameScene();
    const created = engine.createCustomScript(${JSON.stringify(CUSTOM_NAME)});
    const id = created?.id || ${JSON.stringify(CUSTOM_ID)};
    const firstDraft = engine.saveScriptDraft(id, ${JSON.stringify(CODE_A)});
    const afterDraft = engine.getScriptState(id);
    const applied = await engine.compileAndApply(id, ${JSON.stringify(CODE_A)}, scene);
    await new Promise((resolve) => setTimeout(resolve, 900));
    const ticksAfterApply = Number((globalThis as any).__syncTicks || 0);
    const afterApply = engine.getScriptState(id);
    const secondDraft = engine.saveScriptDraft(id, ${JSON.stringify(CODE_B)});
    const afterSecondDraft = engine.getScriptState(id);

    const damage = engine.getScriptById('damage-system');
    const damageRestart = await engine.applyForRestart(
      'damage-system',
      damage.originalSource + ${JSON.stringify(DAMAGE_MARK)}
    );
    const afterRestart = engine.getScriptState('damage-system');
    return {
      id,
      created: !!created,
      firstDraft: firstDraft.success,
      secondDraft: secondDraft.success,
      applied: applied.success,
      damageRestart: damageRestart.success,
      ticksAfterApply,
      afterDraft: {
        saved: afterDraft.savedSource,
        applied: afterDraft.appliedSource,
        running: afterDraft.runningSource,
      },
      afterApply: {
        saved: afterApply.savedSource,
        applied: afterApply.appliedSource,
        running: afterApply.runningSource,
      },
      afterSecondDraft: {
        saved: afterSecondDraft.savedSource,
        applied: afterSecondDraft.appliedSource,
        running: afterSecondDraft.runningSource,
        hasUnappliedChanges: afterSecondDraft.hasUnappliedChanges,
      },
      afterRestart: {
        capability: afterRestart.capability,
        applied: afterRestart.appliedSource,
        running: afterRestart.runningSource,
        requiresRestart: afterRestart.status === 'pending',
      },
      appliedStoreSource: engine.getAppliedStoreSource(),
    };
  })()`);

  check('custom script created', phase1.created === true);
  check('explicit draft save succeeds', phase1.firstDraft === true);
  check('saving a draft does not apply it', phase1.afterDraft.applied === null, JSON.stringify(phase1.afterDraft));
  check('saving a draft does not run it', phase1.afterDraft.running === null);
  check('apply hot-swap succeeds', phase1.applied === true);
  check('applied code runs in the real loop', phase1.ticksAfterApply > 0, `ticks=${phase1.ticksAfterApply}`);
  check('apply records running source', phase1.afterApply.running === CODE_A);
  check('newer saved draft is kept separate', phase1.afterSecondDraft.saved === CODE_B);
  check('newer saved draft is not applied', phase1.afterSecondDraft.applied === CODE_A);
  check('newer saved draft is not running', phase1.afterSecondDraft.running === CODE_A);
  check('unapplied change is reported', phase1.afterSecondDraft.hasUnappliedChanges === true);
  check('restart-required apply succeeds', phase1.damageRestart === true);
  check('restart-required version is applied', phase1.afterRestart.applied?.endsWith(DAMAGE_MARK) === true);
  check('restart-required version is not running', phase1.afterRestart.running === null);
  check('applied store reached server', phase1.appliedStoreSource === 'server', phase1.appliedStoreSource);

  const serverState = await (await fetch(`http://127.0.0.1:${PORT}/__playground/applied-scripts`)).json();
  const serverCustom = (serverState.scripts || []).find((entry) => entry.id === phase1.id);
  const serverDamage = (serverState.scripts || []).find((entry) => entry.id === 'damage-system');
  check('server persisted custom applied source', serverCustom?.code === CODE_A);
  check('server persisted restart-required source', serverDamage?.code?.endsWith(DAMAGE_MARK) === true);

  // Phase 2: full reload must rehydrate the saved draft and applied/running A,
  // while the restart-required code remains applied but not live.
  await cdp.send('Page.reload', { ignoreCache: true });
  await waitForReady(cdp, 'after reload');

  const phase2 = await cdp.evaluate(`(async () => {
    const { scriptRuntimeEngine: engine } = await import('/src/game/ScriptRuntimeEngine.ts');
    await engine.whenReady();
    let state = engine.getScriptState(${JSON.stringify(CUSTOM_ID)});
    for (let attempt = 0; attempt < 24 && state.runningSource !== ${JSON.stringify(CODE_A)}; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      state = engine.getScriptState(${JSON.stringify(CUSTOM_ID)});
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
    const ticks = Number((globalThis as any).__syncTicks || 0);
    const damage = engine.getScriptState('damage-system');

    let captured = null;
    const originalCreate = URL.createObjectURL;
    URL.createObjectURL = (blob) => {
      if (blob && blob.type && blob.type.includes('zip')) captured = blob;
      return originalCreate.call(URL, blob);
    };
    try {
      const exporter = await import('/src/game/ProjectExporter.ts');
      await exporter.exportProjectZip({ buildModeSceneJson: null });
    } finally {
      URL.createObjectURL = originalCreate;
    }
    if (!captured) throw new Error('export did not produce a ZIP blob');
    const bytes = new Uint8Array(await captured.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return {
      saved: state.savedSource,
      applied: state.appliedSource,
      running: state.runningSource,
      ticks,
      damageApplied: damage.appliedSource,
      damageRunning: damage.runningSource,
      zip: { base64: btoa(binary), size: bytes.length },
    };
  })()`);

  check('saved draft survives reload', phase2.saved === CODE_B);
  check('applied source survives reload', phase2.applied === CODE_A);
  check('applied hot-swap is rehydrated', phase2.running === CODE_A);
  check('rehydrated applied code runs', phase2.ticks > 0, `ticks=${phase2.ticks}`);
  check('saved draft did not replace applied on reload', phase2.running !== CODE_B);
  check('restart-required source survives reload', phase2.damageApplied?.endsWith(DAMAGE_MARK) === true);
  check('restart-required source is still not live', phase2.damageRunning === null);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, Buffer.from(phase2.zip.base64, 'base64'));
  console.log(`saved ${OUT} (${phase2.zip.size} bytes)`);

  const archive = unzipSync(new Uint8Array(fs.readFileSync(OUT)));
  const manifest = JSON.parse(strFromU8(archive['build-script/export-manifest.json']));
  const custom = (manifest.scripts || []).find((script) => script.id === CUSTOM_ID);
  const damage = (manifest.scripts || []).find((script) => script.id === 'damage-system');
  const customMain = custom ? strFromU8(archive[custom.filePath]) : '';
  const customPending = (manifest.pendingScripts || []).find((entry) => entry.id === CUSTOM_ID);
  const damageMain = damage ? strFromU8(archive[damage.filePath]) : '';
  check('manifest additionally contains the custom script', !!custom);
  check('custom main source is the running applied version', customMain === CODE_A);
  check('custom draft is archived as pending', customPending?.reason === 'draft-not-applied');
  check(
    'pending archive contains the unapplied draft',
    !!customPending && strFromU8(archive[customPending.archivedPath]) === CODE_B
  );
  check('restart-required main source is the applied version', damageMain.endsWith(DAMAGE_MARK) === true);
  check('exported states are present', !!custom?.states?.running?.present && !!damage?.states?.applied?.present);

  const verification = spawnSync(process.execPath, ['scripts/verify-export.mjs', OUT], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  process.stdout.write(verification.stdout || '');
  process.stderr.write(verification.stderr || '');
  check('verify-export accepts the synchronization ZIP', verification.status === 0, `exit=${verification.status}`);

  if (cdp.errors.length > 0) {
    console.log(`\nBrowser errors captured (${cdp.errors.length}):`);
    for (const error of cdp.errors.slice(0, 8)) console.log(`  ${error}`);
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exitCode = failed.length ? 1 : 0;
} catch (error) {
  console.error('HARNESS ERROR:', error);
  process.exitCode = 1;
} finally {
  try {
    chrome?.kill('SIGKILL');
  } catch {}
  try {
    dev?.kill('SIGKILL');
  } catch {}
  await sleep(300);
  try {
    restoreAppliedState(appliedBackup);
  } catch (error) {
    console.error('Could not restore applied-scripts.json:', error);
    process.exitCode = 1;
  }
}
