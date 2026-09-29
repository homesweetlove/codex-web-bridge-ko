const { Menu, dialog, shell } = require('electron');

function trayTemplate({ data, mainWindow, proxy, devin, applyRoute, restoreRoute, settings, saveSettings, refresh, quit }) {
  const chooseWorkDir = async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'], title: 'Devin 기본 작업 폴더 선택' });
    if (!result.canceled && result.filePaths[0]) {
      settings.workDir = result.filePaths[0];
      saveSettings();
      await proxy.restart();
      refresh();
    }
  };
  return Menu.buildFromTemplate([
    { label: 'Devin is Free 열기', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: data.cli.installed ? `Devin CLI: ${data.cli.version || '설치됨'}` : 'Devin CLI 설치', click: () => { if (!data.cli.installed) devin.installOfficialCli(); } },
    { label: 'Devin 로그인', click: () => devin.login() },
    { label: 'Devin CLI 업데이트', enabled: data.cli.installed, click: () => devin.update() },
    { type: 'separator' },
    { label: data.proxy.running ? '프록시 다시 시작' : '프록시 시작', click: async () => { data.proxy.running ? await proxy.restart() : await proxy.start(); refresh(); } },
    { label: '프록시 중지', enabled: data.proxy.running, click: async () => { await proxy.stop(); refresh(); } },
    { label: 'Codex에 적용', enabled: !data.route.applied, click: async () => { applyRoute(); await proxy.start(); refresh(); } },
    { label: 'Codex 원상복구', enabled: data.route.applied, click: async () => { restoreRoute(); refresh(); } },
    { type: 'separator' },
    { label: `작업 폴더: ${settings.workDir || '미지정'}`, click: chooseWorkDir },
    { label: '파일 수정·명령 실행 자동 허용', type: 'checkbox', checked: settings.allowTools, click: async item => { settings.allowTools = item.checked; saveSettings(); await proxy.restart(); refresh(); } },
    { label: 'Windows 로그인 시 자동 실행', type: 'checkbox', checked: data.loginAtStartup, click: item => { settings.autoStart = item.checked; saveSettings(); require('electron').app.setLoginItemSettings({ openAtLogin: item.checked, path: process.execPath }); refresh(); } },
    { type: 'separator' },
    { label: 'Codex 설정 위치 열기', click: () => shell.showItemInFolder(data.route.configPath) },
    { label: 'Devin CLI 문서', click: () => shell.openExternal('https://cli.devin.ai/reference/commands') },
    { type: 'separator' },
    { label: '종료', click: quit },
  ]);
}

module.exports = { trayTemplate };
