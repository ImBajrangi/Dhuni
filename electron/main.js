const { app, BrowserWindow, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');

let backendProcess = null;
let mainWindow = null;

function startBackend() {
  try {
    const backendPath = path.join(__dirname, '../backend/index.js');
    console.log('Starting Node.js Backend Server via UtilityProcess at:', backendPath);
    
    // Fork the background backend process using Electron's utilityProcess.
    // This runs completely independently of the system's global node installation!
    backendProcess = utilityProcess.fork(backendPath, [], {
      env: { ...process.env, PORT: 3001 },
      stdio: 'pipe'
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`[Backend Log]: ${data.toString()}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`[Backend Error]: ${data.toString()}`);
    });

    backendProcess.on('exit', (code) => {
      console.log(`Backend server exited with code ${code}`);
    });
  } catch (err) {
    console.error('Failed to fork backend process:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Lofi Wave Studio',
    backgroundColor: '#0a0a16', // Dark background matching lofi theme
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built static assets
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  startBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (backendProcess) {
    console.log('Terminating backend server process...');
    try {
      backendProcess.kill();
    } catch (e) {
      console.error('Failed to kill backend:', e);
    }
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
