// 小柯機器人螢幕錄製工具：主程式（首頁、錄影流程、設定、更新）
import { $, h, uid, fmtTime, fmtBytes, sleep, pickFile, download, isTouch, isIPad } from './util.js';
import { ic } from './icons.js';
import { t, LANGS, getLang, setLang, onLangChange } from './i18n.js';
import { Store, newProject, packProject, unpackProject } from './project.js';
import { MediaSet } from './media.js';
import { Recording, RecorderSupport, listDevices, unlockDeviceLabels } from './recorder.js';
import { Desktop, whenDesktopReady, desktopInfo, NativeRec } from './desktop.js';
import { APP_VERSION, checkWebUpdate, checkDesktopUpdate, applyWebUpdate, registerSW } from './updater.js';
import { Shortcuts, DEFAULT_SHORTCUTS } from './shortcuts.js';
import { openEditor, closeEditor } from './editor.js';

const app = $('#app');
const PREF_KEY = 'xkr.prefs';
export const prefs = Object.assign({
  surface: 'monitor', mic: true, micId: '', sys: true, cam: false, camId: '', countdown: 3, fps: 30, facing: 'user', native: true, nativeTarget: '',
}, (() => { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; } })());
export const savePrefs = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { } };

// 手機／平板：瀏覽器不支援錄螢幕
export const canScreen = () => RecorderSupport.display && !(isTouch() && !Desktop.available && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) && !isIPad();

export function toast(msg, err = false, ms = 3500) {
  const el = h('div', { class: 'toast' + (err ? ' err' : '') }, msg);
  $('#toasts').append(el);
  setTimeout(() => el.remove(), ms);
}

export function dialog(title, body, buttons = []) {
  const dlg = h('dialog', {});
  const close = v => { dlg.close(); dlg.remove(); res(v); };
  let res;
  const p = new Promise(r => (res = r));
  dlg.append(
    h('div', { class: 'dlg-h' }, h('span', { class: 'grow' }, title), h('button', { class: 'btn icon ghost', onclick: () => close(null), 'aria-label': t('close') }, ic('x'))),
    h('div', { class: 'dlg-b' }, body),
    buttons.length ? h('div', { class: 'dlg-f' }, buttons.map(b => h('button', { class: 'btn ' + (b.cls || ''), onclick: () => (b.onclick ? b.onclick(close) : close(b.value)) }, b.label))) : null,
  );
  dlg.addEventListener('cancel', e => { e.preventDefault(); close(null); });
  document.body.append(dlg);
  dlg.showModal();
  p.dialog = dlg; p.close = close;
  return p;
}

export function confirmBox(msg, okLabel, danger = false) {
  return dialog(t('confirm'), h('p', {}, msg), [{ label: t('cancel'), value: false }, { label: okLabel || t('ok'), value: true, cls: danger ? 'rec' : 'pri' }]);
}

const toggle = (checked, onchange) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked, onchange: e => onchange(e.target.checked) }), h('span'));

// ======================= 首頁 =======================
let updateInfo = null;

let navToken = 0;

export async function showHome() {
  const my = ++navToken;
  document.title = t('appName');
  const devs = await listDevices();
  const nativeCaps = Desktop.available ? await NativeRec.capabilities() : null;
  const targets = nativeCaps?.ok ? await NativeRec.targets().catch(() => []) : [];
  const mobile = !canScreen();

  const view = h('div', { class: 'view', id: 'home' });
  const top = h('div', { class: 'topbar' },
    h('div', { class: 'brand grow' }, h('img', { src: 'icons/icon-192.png', alt: '' }), h('span', {}, t('appName'))),
    langSelect(),
    h('button', { class: 'btn icon ghost', title: t('settings'), 'aria-label': t('settings'), onclick: showSettings }, ic('settings')),
  );
  view.append(top);
  if (updateInfo?.newer) view.append(updateBar());

  const main = h('div', { class: 'home-main' });
  const wrap = h('div', { class: 'home-wrap' });

  // ---- 錄影卡片 ----
  const recCard = h('div', { class: 'card' });
  recCard.append(h('h1', {}, t('heroTitle')), h('p', { class: 'dim', style: { margin: '0 0 6px' } }, t('heroSub')));

  if (mobile) {
    recCard.append(h('div', { class: 'note' }, ic('phone'), ' ', t('mobileNote')));
    const pick = h('div', { class: 'src-pick', style: { gridTemplateColumns: '1fr 1fr' } });
    for (const [k, label] of [['user', t('frontCam')], ['environment', t('backCam')]]) {
      pick.append(h('button', { class: prefs.facing === k ? 'on' : '', onclick: () => { prefs.facing = k; savePrefs(); showHome(); } }, ic('camera'), label));
    }
    recCard.append(pick);
  } else if (nativeCaps?.ok && prefs.native) {
    // 桌面版原生錄製：選螢幕或視窗
    const sel = h('select', { onchange: e => { prefs.nativeTarget = e.target.value; savePrefs(); } },
      targets.map(tg => h('option', { value: tg.id, selected: tg.id === prefs.nativeTarget }, (tg.kind === 'window' ? '🪟 ' : '🖥 ') + tg.name)));
    if (!prefs.nativeTarget && targets[0]) prefs.nativeTarget = targets[0].id;
    recCard.append(h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('recordWhat')), h('div', { class: 'row' }, sel, h('button', { class: 'btn icon', title: t('refresh'), onclick: showHome }, ic('refresh')))));
  } else {
    const pick = h('div', { class: 'src-pick' });
    for (const [k, icon, label] of [['monitor', 'screen', t('srcScreen')], ['window', 'window', t('srcWindow')], ['browser', 'tab', t('srcTab')]]) {
      pick.append(h('button', { class: prefs.surface === k ? 'on' : '', onclick: () => { prefs.surface = k; savePrefs(); showHome(); } }, ic(icon), label));
    }
    recCard.append(pick);
  }

  const opts = h('div', { class: 'rec-opts' });
  const micSel = h('select', { onchange: e => { prefs.micId = e.target.value; savePrefs(); } },
    h('option', { value: '' }, t('defaultMic')),
    devs.mics.filter(d => d.deviceId && d.deviceId !== 'default').map(d => h('option', { value: d.deviceId, selected: d.deviceId === prefs.micId }, d.label || t('mic') + ' ' + d.deviceId.slice(0, 4))));
  if (devs.mics.length && !devs.mics.some(d => d.label)) micSel.append(h('option', { value: '__unlock' }, t('showDeviceNames')));
  micSel.addEventListener('change', async e => { if (e.target.value === '__unlock') { await unlockDeviceLabels('audio'); showHome(); } });
  opts.append(h('div', { class: 'opt' }, ic(prefs.mic ? 'mic' : 'micOff'), h('span', { class: 'grow' }, t('mic')), micSel, toggle(prefs.mic, v => { prefs.mic = v; savePrefs(); showHome(); })));
  if (!mobile) {
    const sysHint = nativeCaps?.ok && prefs.native ? (nativeCaps.systemAudio ? '' : t('sysAudioNativeNo')) : t('sysAudioHint');
    opts.append(h('div', { class: 'opt' }, ic('speaker'), h('span', { class: 'grow' }, t('systemAudio'), sysHint ? h('div', { class: 'small dim' }, sysHint) : null), toggle(prefs.sys, v => { prefs.sys = v; savePrefs(); })));
    const camSel = h('select', { onchange: async e => { if (e.target.value === '__unlock') { await unlockDeviceLabels('video'); return showHome(); } prefs.camId = e.target.value; savePrefs(); } },
      h('option', { value: '' }, t('defaultCam')),
      devs.cams.filter(d => d.deviceId).map(d => h('option', { value: d.deviceId, selected: d.deviceId === prefs.camId }, d.label || t('camera') + ' ' + d.deviceId.slice(0, 4))));
    if (devs.cams.length && !devs.cams.some(d => d.label)) camSel.append(h('option', { value: '__unlock' }, t('showDeviceNames')));
    opts.append(h('div', { class: 'opt' }, ic('camera'), h('span', { class: 'grow' }, t('webcamOverlay')), camSel, toggle(prefs.cam, v => { prefs.cam = v; savePrefs(); })));
  }
  const seg = (vals, cur, fn, fmt = v => v) => h('div', { class: 'seg' }, vals.map(v => h('button', { class: v === cur ? 'on' : '', onclick: () => { fn(v); savePrefs(); showHome(); } }, fmt(v))));
  opts.append(h('div', { class: 'opt' }, ic('refresh'), h('span', { class: 'grow' }, t('countdown')), seg([0, 3, 5], prefs.countdown, v => (prefs.countdown = v), v => (v ? v + 's' : t('off')))));
  opts.append(h('div', { class: 'opt' }, ic('speed'), h('span', { class: 'grow' }, t('frameRate')), seg([30, 60], prefs.fps, v => (prefs.fps = v), v => v + ' fps')));
  if (nativeCaps?.ok) opts.append(h('div', { class: 'opt' }, ic('cursor'), h('span', { class: 'grow' }, t('nativeCapture'), h('div', { class: 'small dim' }, t('nativeCaptureHint'))), toggle(prefs.native, v => { prefs.native = v; savePrefs(); showHome(); })));
  recCard.append(opts);
  const canRec = mobile ? RecorderSupport.media : (RecorderSupport.display || nativeCaps?.ok);
  recCard.append(h('button', { class: 'btn rec bigrec', disabled: !canRec || !RecorderSupport.webcodecs, onclick: startRecording }, ic('record'), mobile ? t('startCamRec') : t('startRec'), h('span', { class: 'small', style: { opacity: .7 } }, ' ' + Shortcuts.label(Shortcuts.map.recordStart))));
  if (!RecorderSupport.webcodecs) recCard.append(h('div', { class: 'note warn', style: { marginTop: '10px' } }, t('browserTooOld')));

  // ---- 匯入卡片 ----
  const side = h('div', { class: 'card', style: { display: 'grid', gap: '10px', alignContent: 'start' } },
    h('h3', { style: { margin: 0 } }, t('editExisting')),
    h('button', { class: 'btn', onclick: importVideo }, ic('upload'), t('importVideo')),
    h('button', { class: 'btn', onclick: importProjectFile }, ic('folder'), t('openProjectFile')),
    mobile ? h('div', { class: 'note small' }, t('mobileImportTip')) : null,
    h('h3', { style: { margin: '8px 0 0' } }, t('features')),
    h('ul', { class: 'feature-list' }, ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10'].map(k => h('li', {}, t(k)))),
    h('div', { class: 'small dim' }, t('privacy')),
  );
  wrap.append(h('div', { class: 'hero' }, recCard, side));

  // ---- 專案列表 ----
  const list = await Store.list();
  const grid = h('div', { class: 'projects' });
  for (const p of list) {
    grid.append(h('div', { class: 'proj', onclick: () => openProject(p.id) },
      h('div', { class: 'th', style: { backgroundImage: p.thumb ? `url(${p.thumb})` : 'none' } }),
      h('div', { class: 'meta' }, h('b', {}, p.name || t('untitled')), h('span', { class: 'small dim' }, fmtTime(p.duration, false)),
        h('button', { class: 'btn icon ghost sm', title: t('delete'), onclick: async e => { e.stopPropagation(); if (await confirmBox(t('deleteConfirm', { name: p.name || t('untitled') }), t('delete'), true)) { await Store.remove(p.id); showHome(); } } }, ic('trash')))));
  }
  wrap.append(h('div', {}, h('div', { class: 'row', style: { marginBottom: '10px' } }, h('h2', { class: 'grow', style: { margin: 0, fontSize: '18px' } }, t('myRecordings')), h('span', { class: 'small dim', id: 'storage' })),
    list.length ? grid : h('div', { class: 'empty' }, t('noRecordings'))));
  wrap.append(h('div', { class: 'small dim', style: { textAlign: 'center' } }, `${t('appName')} v${APP_VERSION}${Desktop.info ? ' · ' + t('desktopEdition') + ' ' + Desktop.info.version : ''} · `, h('a', { href: 'https://github.com/achir1015/xiaoke-recorder', target: '_blank', rel: 'noopener' }, 'GitHub')));
  main.append(wrap);
  view.append(main);
  if (my !== navToken) return; // 載入期間使用者已經打開別的畫面
  closeEditor();
  app.replaceChildren(view);
  Store.estimate().then(e => { if (e && $('#storage')) $('#storage').textContent = t('storageUsed', { used: fmtBytes(e.usage || 0), total: fmtBytes(e.quota || 0) }); });
}

function langSelect() {
  return h('label', { class: 'row', title: 'Language' }, ic('globe'),
    h('select', { style: { width: 'auto', minHeight: '32px' }, onchange: e => setLang(e.target.value) },
      LANGS.map(l => h('option', { value: l.code, selected: l.code === getLang() }, l.name))));
}

function updateBar() {
  const u = updateInfo;
  return h('div', { class: 'update-bar' }, ic('refresh'), h('b', {}, t('updateAvailable', { v: u.latest })),
    h('span', { class: 'small grow' }, (u.notes || []).slice(0, 2).join(' · ')),
    h('button', { class: 'btn sm pri', onclick: () => runUpdate(u) }, t('updateNow')));
}

async function runUpdate(u) {
  if (!Desktop.available) return applyWebUpdate();
  if (!u.url) { window.open(u.page, '_blank'); return; }
  const bar = h('i'), msg = h('p', {}, t('downloadingUpdate'));
  const d = dialog(t('updateNow'), h('div', {}, msg, h('div', { class: 'progress' }, bar)));
  await Desktop.api.install_update(u.url, u.latest);
  for (; ;) {
    await sleep(500);
    const s = await Desktop.api.update_status();
    bar.style.width = (s.pct || 0) + '%';
    if (s.state === 'error') { msg.textContent = t('updateFailed') + ' ' + (s.message || ''); break; }
    if (s.state === 'manual') { msg.textContent = t('updateMacManual'); break; }
    if (s.state === 'launching') msg.textContent = t('updateInstalling');
  }
  void d;
}

// ======================= 匯入 =======================
async function importVideo() {
  const f = await pickFile('video/*,.mp4,.mov,.webm,.mkv');
  if (!f) return;
  await createProjectFromBlobs({ name: f.name.replace(/\.[^.]+$/, ''), screen: { blob: f, track: 0 }, sys: { blob: f, track: 0, optional: true } });
}

async function importProjectFile() {
  const f = await pickFile('.xkrec');
  if (!f) return;
  try { const p = await unpackProject(f); openProject(p.id); }
  catch (e) { toast(t('badProjectFile'), true); }
}

export async function exportProjectFile(p) {
  const blob = await packProject(p);
  download(blob, (p.name || 'project') + '.xkrec');
}

// 把錄到/匯入的檔案存成專案並打開編輯器
// spec: { name, screen:{blob,track}, camera?, mic?, sys?, cursor? }
export async function createProjectFromBlobs(spec) {
  const busy = dialog(t('preparing'), h('p', {}, t('preparingProject')));
  try {
    const keys = new Map(), sources = {};
    for (const name of ['screen', 'camera', 'mic', 'sys']) {
      const s = spec[name];
      if (!s?.blob) continue;
      if (!keys.has(s.blob)) { const k = 'b_' + uid() + uid(); await Store.putBlob(k, s.blob); keys.set(s.blob, k); }
      sources[name] = { blobKey: keys.get(s.blob), track: s.track || 0 };
    }
    const p = newProject(spec.name || defaultName(), sources, { cursor: spec.cursor });
    const m = await MediaSet.open(p);
    if (spec.sys?.optional && !m.audio.sys) delete p.sources.sys;
    p.duration = m.duration; p.width = m.width; p.height = m.height;
    if (spec.cursor) p.edit.cursor.show = true;
    if (!m.video.camera) p.edit.camera.show = false;
    try {
      const [th] = await m.thumbnails(1, 180);
      p.thumb = th.toDataURL('image/jpeg', 0.7);
    } catch { }
    m.dispose();
    await Store.save(p);
    busy.close();
    openProject(p.id);
  } catch (e) {
    console.error(e);
    busy.close();
    toast(t('openFailed') + ' ' + (e.message || e), true, 6000);
  }
}

const defaultName = () => t('recordingName', { date: new Date().toLocaleString(getLang(), { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) });

export async function openProject(id) {
  navToken++;
  const p = await Store.get(id);
  if (!p) return toast(t('openFailed'), true);
  try { await openEditor(p); }
  catch (e) { console.error(e); toast(t('openFailed') + ' ' + (e.message || e), true, 6000); showHome(); }
}

// ======================= 錄影 =======================
let activeRec = null;

async function countdown(n) {
  if (!n) return;
  const el = h('div', { class: 'countdown' });
  document.body.append(el);
  for (let i = n; i > 0; i--) { el.textContent = i; await sleep(1000); }
  el.remove();
}

async function startRecording() {
  if (activeRec) return;
  const mobile = !canScreen();
  const nativeCaps = Desktop.available && prefs.native ? await NativeRec.capabilities() : null;
  const useNative = !mobile && nativeCaps?.ok;
  const rec = new Recording({
    fps: prefs.fps,
    surface: prefs.surface,
    systemAudio: !mobile && !useNative && prefs.sys,
    mic: { on: prefs.mic, deviceId: prefs.micId },
    camera: { on: !mobile && prefs.cam, deviceId: prefs.camId },
    cameraOnly: mobile,
    facing: prefs.facing,
    noScreen: useNative,
  });
  try {
    await rec.acquire();
  } catch (e) {
    rec.cancel();
    if (e?.name !== 'NotAllowedError' && e?.name !== 'AbortError') toast(t('recStartFailed') + ' ' + (e.message || e), true, 6000);
    return;
  }
  if (rec.micError) toast(t('micUnavailable'), true);
  activeRec = rec;
  navToken++;
  showRecView(rec, useNative);
  await countdown(prefs.countdown);
  try {
    if (useNative) {
      const r = await NativeRec.start({ target: prefs.nativeTarget, fps: prefs.fps, systemAudio: prefs.sys });
      if (r.status !== 'ok') throw new Error(r.message || 'native');
      rec.native = true;
    }
    if (rec.tracks.mic || rec.tracks.camera || rec.tracks.screen) await rec.start();
    else { rec.sources = []; rec.state = 'recording'; rec.output = { finalize: async () => { }, cancel: async () => { } }; }
    rec._t0 = performance.now();
  } catch (e) {
    activeRec = null;
    await rec.cancel();
    if (rec.native) NativeRec.cancel();
    toast(t('recStartFailed') + ' ' + (e.message || e), true, 6000);
    return showHome();
  }
  rec.emit('state', 'recording');
}

function showRecView(rec, native) {
  const view = h('div', { class: 'view rec-view' });
  const stage = h('div', { class: 'rec-stage' });
  if (rec.display || rec.camStream) {
    const v = h('video', { autoplay: true, muted: true, playsInline: true });
    v.srcObject = rec.display || rec.camStream;
    stage.append(v);
  } else stage.append(h('div', { class: 'note' }, ic('screen'), ' ', t('nativeRecording')));
  const time = h('span', {}, '00:00');
  const timeBox = h('div', { class: 'rec-time' }, h('i', { class: 'rec-dot' }), time);
  const pauseBtn = h('button', { class: 'btn', onclick: () => togglePause() }, ic('pause'), h('span', {}, t('pause')));
  const stopBtn = h('button', { class: 'btn rec', onclick: () => finish() }, ic('stop'), t('stopRec'));
  const cancelBtn = h('button', { class: 'btn ghost', onclick: async () => { if (await confirmBox(t('discardConfirm'), t('discard'), true)) discard(); } }, ic('trash'), h('span', { class: 'hide-sm' }, t('discard')));

  // ---- 麥克風控制：開／關、換麥克風、音量表 ----
  const micBox = h('div', { class: 'mic-box' });
  const meter = h('i');
  if (rec.mic) {
    const micBtn = h('button', { class: 'btn icon', title: t('micToggle') + ' ' + Shortcuts.label(Shortcuts.map.micToggle) });
    const micSel = h('select', { 'aria-label': t('chooseMic') });
    const paint = async () => {
      micBtn.replaceChildren(ic(rec.mic.enabled ? 'mic' : 'micOff'));
      micBtn.classList.toggle('on', rec.mic.enabled);
      micBtn.setAttribute('aria-pressed', rec.mic.enabled);
      const { mics } = await listDevices();
      micSel.replaceChildren(...mics.filter(d => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications')
        .map(d => h('option', { value: d.deviceId, selected: d.deviceId === rec.mic.deviceId }, d.label || t('mic'))));
    };
    micBtn.onclick = () => { rec.mic.setEnabled(!rec.mic.enabled); toast(rec.mic.enabled ? t('micOn') : t('micOff'), false, 1500); };
    micSel.onchange = async () => {
      try { await rec.mic.setDevice(micSel.value); if (!rec.mic.enabled) rec.mic.setEnabled(true); toast(t('micSwitched', { name: rec.mic.label }), false, 2000); }
      catch (e) { toast(t('micUnavailable'), true); paint(); }
    };
    rec.mic.on('change', paint);
    rec.mic.on('lost', () => { toast(t('micLost'), true); rec.mic.setEnabled(false); });
    navigator.mediaDevices.addEventListener?.('devicechange', paint);
    paint();
    micBox.append(micBtn, micSel, h('div', { class: 'meter' }, meter));
  } else micBox.classList.add('hidden');

  const pipBtn = 'documentPictureInPicture' in window ? h('button', { class: 'btn ghost hide-sm', title: t('floatingBar'), onclick: () => openPip() }, ic('pip')) : null;
  const hud = h('div', { class: 'rec-hud' }, timeBox, pauseBtn, stopBtn, micBox, pipBtn, cancelBtn);
  view.append(stage, hud);
  app.replaceChildren(view);

  let raf;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    time.textContent = fmtTime(rec.time, false);
    if (rec.mic) meter.style.width = Math.min(100, rec.mic.level() * 140) + '%';
    if (pipTime) pipTime.textContent = time.textContent;
  };
  tick();

  async function togglePause() {
    if (rec.state === 'recording') { rec.pause(); if (rec.native) await NativeRec.pause(); }
    else if (rec.state === 'paused') { rec.resume(); if (rec.native) await NativeRec.resume(); }
  }
  rec.on('state', s => {
    view.classList.toggle('paused', s === 'paused');
    pauseBtn.replaceChildren(ic(s === 'paused' ? 'record' : 'pause'), h('span', {}, s === 'paused' ? t('resume') : t('pause')));
  });
  rec.togglePause = togglePause;
  rec.finish = finish;

  // 錄影中如果分享畫面被系統停止（例如按瀏覽器的「停止分享」）也會走到這裡
  rec.on('done', () => { if (!rec._finishing) finish(); });
  rec.on('error', e => toast(t('recError') + ' ' + (e?.message || e), true, 6000));

  async function finish() {
    if (rec._finishing) return;
    rec._finishing = true;
    cancelAnimationFrame(raf);
    pipWin?.close();
    const busy = dialog(t('preparing'), h('p', {}, t('savingRecording')));
    try {
      const res = await rec.stop();
      let spec = { name: defaultName() };
      if (rec.native) {
        const n = await NativeRec.stop();
        if (n.status !== 'ok') throw new Error(n.message || 'native');
        spec.screen = { blob: await NativeRec.fetch(n.screen), track: 0 };
        if (n.sys) spec.sys = { blob: await NativeRec.fetch(n.sys), track: 0 };
        if (n.cursor) spec.cursor = await (await fetch(n.cursor)).json();
      } else if (res) spec.screen = { blob: res.blob, track: res.layout.screen };
      if (res?.blob?.size) {
        for (const k of ['camera', 'mic', 'sys']) if (res.layout[k] !== undefined) spec[k] = { blob: res.blob, track: res.layout[k] };
      }
      busy.close();
      activeRec = null;
      await createProjectFromBlobs(spec);
    } catch (e) {
      console.error(e);
      busy.close();
      activeRec = null;
      toast(t('recSaveFailed') + ' ' + (e.message || e), true, 8000);
      showHome();
    }
  }
  async function discard() {
    cancelAnimationFrame(raf);
    pipWin?.close();
    rec._finishing = true;
    await rec.cancel();
    if (rec.native) await NativeRec.cancel();
    activeRec = null;
    showHome();
  }

  // 浮動控制列（Chrome／Edge：錄別的視窗時也能看到時間和按鈕）
  let pipWin = null, pipTime = null;
  async function openPip() {
    try {
      pipWin = await documentPictureInPicture.requestWindow({ width: 340, height: 64 });
      const d = pipWin.document;
      d.body.style.cssText = 'margin:0;background:#171a21;color:#fff;font:600 16px system-ui;display:flex;align-items:center;gap:8px;padding:10px;';
      pipTime = d.createElement('span'); pipTime.style.cssText = 'flex:1;font-family:monospace;font-size:20px';
      const mk = (label, fn, bg) => { const b = d.createElement('button'); b.textContent = label; b.style.cssText = `border:0;border-radius:8px;padding:8px 12px;background:${bg};color:#fff;font:inherit;cursor:pointer`; b.onclick = fn; return b; };
      d.body.append(pipTime, mk('⏯', () => togglePause(), '#2a2f3a'), mk('🎤', () => rec.mic?.setEnabled(!rec.mic.enabled), '#2a2f3a'), mk('■ ' + t('stopRec'), () => finish(), '#ff3b30'));
      pipWin.addEventListener('pagehide', () => { pipWin = null; pipTime = null; });
    } catch (e) { toast(String(e.message || e), true); }
  }
}

// ======================= 設定 =======================
export async function showSettings() {
  const body = h('div');
  body.append(h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('language')), langSelect()));

  // 版本更新
  const upd = h('div', { class: 'small dim' }, `${t('currentVersion')} ${Desktop.info?.version || APP_VERSION}`);
  const updBtn = h('button', { class: 'btn sm', onclick: async () => {
    updBtn.disabled = true; upd.textContent = t('checking');
    const u = Desktop.available ? await checkDesktopUpdate() : await checkWebUpdate();
    updBtn.disabled = false;
    if (!u || u.error) { upd.textContent = t('updateCheckFailed'); return; }
    updateInfo = u;
    if (u.newer) { upd.replaceChildren(h('b', {}, t('updateAvailable', { v: u.latest })), h('br'), (Array.isArray(u.notes) ? u.notes.join('\n') : u.notes || '')); upd.append(h('div', {}, h('button', { class: 'btn sm pri', style: { marginTop: '6px' }, onclick: () => runUpdate(u) }, t('updateNow')))); }
    else upd.textContent = t('upToDate', { v: u.latest || APP_VERSION });
  } }, ic('refresh'), t('checkUpdate'));
  body.append(h('h3', {}, t('updates')), h('div', { class: 'row wrap' }, updBtn), upd);

  // 快速鍵
  body.append(h('h3', {}, t('shortcuts')));
  const scList = h('div');
  const paintSc = () => {
    scList.replaceChildren(...Object.keys(DEFAULT_SHORTCUTS).map(a => {
      const k = h('span', { class: 'kbd', tabindex: 0 }, Shortcuts.label(Shortcuts.map[a]));
      k.onclick = () => {
        k.classList.add('listen'); k.textContent = t('pressKeys');
        const on = e => {
          e.preventDefault(); e.stopPropagation();
          if (e.key === 'Escape') { done(); return; }
          const c = Shortcuts.fromEvent(e);
          if (!c) return;
          const clash = Object.keys(Shortcuts.map).find(x => x !== a && Shortcuts.map[x] === c);
          if (clash) Shortcuts.set(clash, '');
          Shortcuts.set(a, c); done();
        };
        const done = () => { removeEventListener('keydown', on, true); paintSc(); };
        addEventListener('keydown', on, true);
      };
      return h('div', { class: 'sc-row' }, h('span', {}, t('sc_' + a)), k);
    }));
  };
  paintSc();
  body.append(scList, h('button', { class: 'btn sm', style: { marginTop: '8px' }, onclick: () => { Shortcuts.reset(); paintSc(); } }, t('resetShortcuts')));

  // 安裝說明
  body.append(h('h3', {}, t('installApp')), h('div', { class: 'small dim', html: t('installHelp') }));
  body.append(h('h3', {}, t('about')), h('div', { class: 'small dim' }, t('aboutText'), ' ', h('a', { href: 'https://github.com/achir1015/xiaoke-recorder', target: '_blank', rel: 'noopener' }, 'GitHub')));
  dialog(t('settings'), body, [{ label: t('close'), value: true, cls: 'pri' }]);
}

// ======================= 全域快速鍵（錄影中）=======================
addEventListener('keydown', e => {
  if (e.target.closest?.('input,textarea,select,[contenteditable]')) return;
  const a = Shortcuts.match(e);
  if (!a) return;
  if (activeRec) {
    if (a === 'recordPause') { e.preventDefault(); activeRec.togglePause?.(); }
    else if (a === 'micToggle' && activeRec.mic) { e.preventDefault(); activeRec.mic.setEnabled(!activeRec.mic.enabled); }
    else if (a === 'recordStart') { e.preventDefault(); activeRec.finish?.(); }
  } else if (a === 'recordStart' && $('#home')) { e.preventDefault(); startRecording(); }
});

// ======================= 啟動 =======================
async function boot() {
  registerSW();
  await whenDesktopReady(Desktop.available ? 0 : (location.hostname === '127.0.0.1' ? 2500 : 300));
  await desktopInfo();
  document.documentElement.classList.toggle('desktop-app', Desktop.available);
  onLangChange(() => { if ($('#home')) showHome(); else window.dispatchEvent(new Event('xkr-lang')); });
  const q = new URLSearchParams(location.search);
  await showHome();
  if (q.get('action') === 'import') importVideo();
  // 版本檢查（啟動時＋每 30 分鐘）
  const check = async () => {
    const u = Desktop.available ? await checkDesktopUpdate() : await checkWebUpdate();
    if (u?.newer && (!updateInfo || updateInfo.latest !== u.latest)) {
      updateInfo = u;
      if ($('#home')) showHome();
      toast(t('updateAvailable', { v: u.latest }), false, 6000);
    }
  };
  setTimeout(check, 3000);
  setInterval(check, 30 * 60 * 1000);
}
boot();
