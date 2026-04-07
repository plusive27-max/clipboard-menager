const {
  app,
  BrowserWindow,
  clipboard,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
  globalShortcut
} = require("electron");
const path = require("path");
const fs = require("fs");

// ─── Storage ──────────────────────────────────────────────────────────────────
const DATA_PATH = path.join(app.getPath("userData"), "clipboard-history.json");
const MAX_HISTORY = 200;

function loadHistory() {
  try {
    if (fs.existsSync(DATA_PATH)) {
      return JSON.parse(fs.readFileSync(DATA_PATH, "utf-8"));
    }
  } catch (e) { console.error("Failed to load history", e); }
  return [];
}

function saveHistory(history) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(history), "utf-8");
  } catch (e) { console.error("Failed to save history", e); }
}

// ─── State ────────────────────────────────────────────────────────────────────
let history = loadHistory();
let tray = null;
let win = null;
let lastClipboard = clipboard.readText();

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 600,
    minWidth: 360,
    minHeight: 400,
    frame: false,
    resizable: true,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile("index.html");

  win.on("blur", () => {
    win.hide();
  });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  let icon;
  const iconPath = path.join(__dirname, "assets", "tray-icon.png");
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } else {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip("Clipboard Manager");

  tray.on("click", () => {
    toggleWindow();
  });

  const contextMenu = Menu.buildFromTemplate([
    { label: "Open Clipboard Manager", click: () => showWindow() },
    { type: "separator" },
    {
      label: "Start with Windows",
      type: "checkbox",
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          openAsHidden: true
        });
      }
    },
    { type: "separator" },
    {
      label: "Clear History",
      click: () => {
        history = history.filter(item => item.pinned);
        saveHistory(history);
        win?.webContents.send("history-updated", history);
      }
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() }
  ]);

  tray.setContextMenu(contextMenu);
}

// ─── Window positioning ───────────────────────────────────────────────────────
function getWindowPosition() {
  const trayBounds = tray.getBounds();
  const windowBounds = win.getBounds();
  const display = screen.getDisplayNearestPoint({ x: trayBounds.x, y: trayBounds.y });

  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowBounds.width / 2);
  let y = trayBounds.y > display.workArea.height / 2
    ? trayBounds.y - windowBounds.height - 4
    : trayBounds.y + trayBounds.height + 4;

  x = Math.max(display.workArea.x, Math.min(x, display.workArea.x + display.workArea.width - windowBounds.width));
  y = Math.max(display.workArea.y, Math.min(y, display.workArea.y + display.workArea.height - windowBounds.height));

  return { x, y };
}

function showWindow() {
  const { x, y } = getWindowPosition();
  win.setPosition(x, y, false);
  win.show();
  win.focus();
  win.webContents.send("history-updated", history);
}

function toggleWindow() {
  if (!win || win.isDestroyed()) {
    createWindow();
    showWindow();
    return;
  }
  if (win.isVisible()) {
    win.hide();
  } else {
    showWindow();
  }
}

// ─── Clipboard polling ────────────────────────────────────────────────────────
function startPolling() {
  setInterval(() => {
    const current = clipboard.readText();
    if (current && current !== lastClipboard && current.trim()) {
      lastClipboard = current;

      history = history.filter(item => item.text !== current);
      history.unshift({
        id: Date.now(),
        text: current,
        timestamp: new Date().toISOString(),
        pinned: false
      });

      const pinned = history.filter(i => i.pinned);
      const unpinned = history.filter(i => !i.pinned).slice(0, MAX_HISTORY - pinned.length);
      history = [...pinned, ...unpinned];

      saveHistory(history);

      if (win?.isVisible()) {
        win.webContents.send("history-updated", history);
      }
    }
  }, 800);
}

// ─── IPC handlers ─────────────────────────────────────────────────────────────
ipcMain.on("copy-item", (event, id) => {
  const item = history.find(i => i.id === id);
  if (item) {
    lastClipboard = item.text;
    clipboard.writeText(item.text);
  }
});

ipcMain.on("pin-item", (event, id) => {
  const item = history.find(i => i.id === id);
  if (item) {
    item.pinned = !item.pinned;
    saveHistory(history);
    win?.webContents.send("history-updated", history);
  }
});

ipcMain.on("delete-item", (event, id) => {
  history = history.filter(i => i.id !== id);
  saveHistory(history);
  win?.webContents.send("history-updated", history);
});

ipcMain.on("clear-history", () => {
  history = history.filter(item => item.pinned);
  saveHistory(history);
  win?.webContents.send("history-updated", history);
});

ipcMain.on("request-history", (event) => {
  event.reply("history-updated", history);
});

ipcMain.on("hide-window", () => {
  win?.hide();
});

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  app.setAppUserModelId("Clipboard Manager");

  createWindow();
  createTray();
  startPolling();

  globalShortcut.register("CommandOrControl+Shift+V", () => {
    toggleWindow();
  });

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", e => {
  e.preventDefault();
});