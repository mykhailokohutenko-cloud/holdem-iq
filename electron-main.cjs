const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

function resolveAppIcon() {
  const winIcon = path.join(__dirname, 'build', 'icon.ico');
  const unixIcon = path.join(__dirname, 'build', 'icon.png');
  const rootIcon = path.join(__dirname, 'icon.png');

  if (process.platform === 'win32' && fs.existsSync(winIcon)) {
    return winIcon;
  }
  if (fs.existsSync(unixIcon)) {
    return unixIcon;
  }
  if (fs.existsSync(rootIcon)) {
    return rootIcon;
  }
  return undefined;
}

function createWindow() {
  const iconPath = resolveAppIcon();

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#060709',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});