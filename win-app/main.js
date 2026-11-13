"use strict";
const { app, BrowserWindow, Tray, Menu, shell, ipcMain, Notification, dialog, session } = require('electron');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, spawn } = require('child_process');

const MARK = '# DeltaSound';
const APO_HOME = 'https://sourceforge.net/projects/equalizerapo/';
const APO_ROOTS = [
  'C:\\Program Files\\EqualizerAPO',
  'C:\\Program Files (x86)\\EqualizerAPO',
  path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Public', 'Programs', 'EqualizerAPO')
];

let win = null, tray = null, quitting = false;

function apoRoot() {
  for (const p of APO_ROOTS) {
    try { if (fs.existsSync(path.join(p, 'config'))) return p; } catch (_) {}
  }
  return null;
}
function configPath() {
  return path.join(apoRoot() || APO_ROOTS[0], 'config', 'config.txt');
}
const q = s => "'" + String(s).replace(/'/g, "''") + "'";

// 优先直写；权限不足时通过 UAC 提权的 PowerShell 完成（含自动备份）
function writeConfig(text) {
  return new Promise(resolve => {
    const target = configPath();
    const src = path.join(os.tmpdir(), 'deltasound-config-' + Date.now() + '.txt');
    try { fs.writeFileSync(src, text, 'utf8'); }
    catch (e) { return resolve({ ok: false, message: '临时文件写入失败：' + e.message }); }

    try {
      if (fs.existsSync(target) && !fs.existsSync(target + '.deltasound.bak')) {
        fs.copyFileSync(target, target + '.deltasound.bak');
      }
      fs.writeFileSync(target, text, 'utf8');
      return resolve({ ok: true, message: '已写入，Equalizer APO 会自动热重载' });
    } catch (_) { /* 需要提权 */ }

    const helper = path.join(os.tmpdir(), 'deltasound-elevate-' + Date.now() + '.ps1');
    const script = [
      "$ErrorActionPreference='Stop'",
      `$target=${q(target)}`,
      `$bak=${q(target + '.deltasound.bak')}`,
      `$src=${q(src)}`,
      "if((Test-Path -LiteralPath $target) -and -not (Test-Path -LiteralPath $bak)){Copy-Item -LiteralPath $target -Destination $bak -Force}",
      "Copy-Item -LiteralPath $src -Destination $target -Force"
    ].join('\r\n');
    try { fs.writeFileSync(helper, script, 'utf8'); }
    catch (e) { return resolve({ ok: false, message: '提权脚本写入失败：' + e.message }); }

    // ArgumentList 里用双引号包住 .ps1 路径，兼容「Program Files / 用户名含空格」
    const inner = `-NoProfile -ExecutionPolicy Bypass -File "${helper}"`;
    const cmd = `Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList '${inner.replace(/'/g, "''")}'`;
    execFile('powershell.exe', ['-NoProfile', '-Command', cmd], { timeout: 90000 }, (err) => {
      try { fs.unlinkSync(helper); } catch (_) {}
      if (err) return resolve({ ok: false, message: '提权被取消或失败：' + err.message });
      try {
        const now = fs.readFileSync(target, 'utf8');
        return resolve(now.includes(MARK)
          ? { ok: true, message: '已写入，Equalizer APO 会自动热重载' }
          : { ok: false, message: '写入未完成，请点「恢复原声」后重试' });
      } catch (e) { return resolve({ ok: false, message: '无法确认写入结果：' + e.message }); }
    });
  });
}

function restoreConfig() {
  return new Promise(resolve => {
    const target = configPath(), bak = target + '.deltasound.bak';
    const restore = () => {
      try {
        if (fs.existsSync(bak)) fs.copyFileSync(bak, target);
        else fs.writeFileSync(target, '# 原声\nPreamp: 0 dB\n', 'utf8');
        return resolve({ ok: true, message: '已恢复原声' });
      } catch (_) {}
      const helper = path.join(os.tmpdir(), 'deltasound-restore-' + Date.now() + '.ps1');
      const script = [
        "$ErrorActionPreference='Stop'",
        `$target=${q(target)}`, `$bak=${q(bak)}`,
        "if(Test-Path -LiteralPath $bak){Copy-Item -LiteralPath $bak -Destination $target -Force}",
        "else{Set-Content -LiteralPath $target -Value '# 原声' -Force}"
      ].join('\r\n');
      try { fs.writeFileSync(helper, script, 'utf8'); }
      catch (e) { return resolve({ ok: false, message: '提权脚本写入失败：' + e.message }); }
      const inner = `-NoProfile -ExecutionPolicy Bypass -File "${helper}"`;
      execFile('powershell.exe', ['-NoProfile', '-Command',
        `Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -ArgumentList '${inner.replace(/'/g, "''")}'`],
        { timeout: 90000 }, (err) => {
          try { fs.unlinkSync(helper); } catch (_) {}
          resolve(err ? { ok: false, message: '提权被取消：' + err.message } : { ok: true, message: '已恢复原声' });
        });
    };
    restore();
  });
}

function getState() {
  const root = apoRoot(), target = configPath();
  let applied = false, hasBackup = false;
  try { applied = fs.readFileSync(target, 'utf8').includes(MARK); } catch (_) {}
  try { hasBackup = fs.existsSync(target + '.deltasound.bak'); } catch (_) {}
  return {
    apoInstalled: !!root, apoRoot: root, configPath: target, applied, hasBackup,
    autostart: app.getLoginItemSettings().openAtLogin,
    version: app.getVersion(), platform: process.platform
  };
}

function createWindow() {
  win = new BrowserWindow({
    width: 1240, height: 860, minWidth: 900, minHeight: 640,
    title: 'DeltaSound · 三角洲听声增强',
    backgroundColor: '#0d1117',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: false
    }
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('close', e => { if (!quitting) { e.preventDefault(); win.hide(); } });
}

function createTray() {
  const icon = path.join(__dirname, 'build', 'icon.ico');
  try { tray = new Tray(icon); } catch (_) { return; }
  const menu = Menu.buildFromTemplate([
    { label: '打开控制面板', click: () => { if (win) { win.show(); win.focus(); } } },
    { label: '音效 开 / 关', click: () => { if (win) win.webContents.send('ds:toggleBypass'); } },
    { type: 'separator' },
    { label: '应用到本机音效', click: async () => { if (win) win.webContents.send('ds:requestApply'); } },
    { label: '恢复原声', click: async () => { const r = await restoreConfig(); if (win) win.webContents.send('ds:result', r); } },
    { type: 'separator' },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]);
  tray.setToolTip('DeltaSound · 三角洲听声增强');
  tray.setContextMenu(menu);
  tray.on('double-click', () => { if (win) { win.show(); win.focus(); } });
}

// ---------------- IPC ----------------
ipcMain.handle('ds:state', () => getState());
ipcMain.handle('ds:apply', (_e, text) => writeConfig(text));
ipcMain.handle('ds:restore', () => restoreConfig());
ipcMain.handle('ds:setAutostart', (_e, on) => {
  app.setLoginItemSettings({ openAtLogin: !!on, args: ['--tray'] });
  return getState().autostart;
});
ipcMain.handle('ds:openConfigurator', () => {
  const root = apoRoot();
  const exe = root ? path.join(root, 'Configurator.exe') : null;
  if (exe && fs.existsSync(exe)) { spawn(exe, [], { detached: true, stdio: 'ignore' }).unref(); return '已打开耳机设置'; }
  return '未找到 Configurator.exe，请先安装 Equalizer APO';
});
ipcMain.handle('ds:openConfigDir', () => {
  const p = configPath();
  if (fs.existsSync(p)) shell.showItemInFolder(p); else shell.openExternal(APO_HOME);
  return p;
});
ipcMain.handle('ds:downloadApo', () => { shell.openExternal(APO_HOME); return APO_HOME; });
ipcMain.handle('ds:notify', (_e, title, body) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
  return true;
});
ipcMain.handle('ds:pickAudio', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: '音频', extensions: ['wav','mp3','flac','ogg','m4a'] }] });
  if (r.canceled) return null;
  try { return { name: path.basename(r.filePaths[0]), data: fs.readFileSync(r.filePaths[0]).toString('base64') }; }
  catch (e) { return null; }
});

// ---------------- 生命周期 ----------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => { if (win) { win.show(); win.focus(); } });
  app.whenReady().then(() => {
    // file:// 页面默认拿不到媒体权限，放行试听用的麦克风
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
      cb(['media', 'audioCapture', 'clipboard-read', 'notifications'].includes(permission));
    });
    createWindow(); createTray();
    if (process.argv.includes('--tray') && win) win.hide();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
}
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { /* 托盘常驻 */ });
