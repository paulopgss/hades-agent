const { BrowserWindow, shell, app, Menu } = require('electron');
const configs = require('./windowConfigs');
const log = require('electron-log');

/**
 * WindowManager handles the lifecycle and management of all application windows.
 * It provides a centralized way to create, retrieve, and configure windows.
 */
class WindowManager {
  constructor() {
    /** @type {Object<string, BrowserWindow>} */
    this.windows = {};
  }

  /**
   * Retrieves an existing window instance by name.
   * @param {string} name 
   * @returns {BrowserWindow|null}
   */
  get(name) {
    return this.windows[name];
  }

  /**
   * Hides all visible windows.
   */
  hideAllWindows() {
    log.info('[WINDOW_MANAGER] Hiding all windows');
    Object.values(this.windows).forEach(win => {
      if (win && !win.isDestroyed() && win.isVisible()) {
        win.hide();
      }
    });
  }

  /**
   * Hides all modes/windows except the specified one(s).
   * @param {string[]} excludeNames - Windows that should remain untouched.
   */
  hideAllExcept(excludeNames = []) {
    log.info(`[WINDOW_MANAGER] Hiding all windows except: ${excludeNames.join(', ')}`);
    Object.entries(this.windows).forEach(([name, win]) => {
      if (win && !win.isDestroyed() && win.isVisible() && !excludeNames.includes(name)) {
        win.hide();
      }
    });
  }

  /**
   * Internal method to create a window based on configuration.
   * @param {string} name 
   * @returns {BrowserWindow}
   */
  createWindow(name) {
    log.info(`[WINDOW_MANAGER] createWindow called for: ${name}`);
    if (this.windows[name] && !this.windows[name].isDestroyed()) {
      log.info(`[WINDOW_MANAGER] Reusing existing window for: ${name}`);
      return this.windows[name];
    }

    log.info(`[WINDOW_MANAGER] Creating new window for: ${name}`);
    const config = configs[name];
    if (!config) throw new Error(`Window configuration for "${name}" not found.`);

    const win = new BrowserWindow(config);
    this.windows[name] = win;

    // Load URL or File
    log.info(`[WINDOW_MANAGER] Loading URL for ${name}:`, config.url);
    win.loadURL(config.url);

    // Run custom initialization
    if (config.onInit) {
      log.info(`[WINDOW_MANAGER] Running onInit for: ${name}`);
      config.onInit(win);
    }

    // Setup default handlers
    this.setupExternalLinks(win);

    // Setup DevTools and Shortcuts
    win.webContents.on('before-input-event', (event, input) => {
      if (input.control && input.shift && input.key.toLowerCase() === 'i') {
        log.info(`[WINDOW_MANAGER] Ctrl+Shift+I detected on window: ${name}`);
        if (win.webContents.isDevToolsOpened()) {
          log.info(`[WINDOW_MANAGER] Closing DevTools for: ${name}`);
          win.webContents.closeDevTools();
        } else {
          log.info(`[WINDOW_MANAGER] Opening DevTools for: ${name}`);
          win.webContents.openDevTools({ mode: 'detach' });
        }
        event.preventDefault();
      }
    });

    // Add specific event logs for debugging
    win.webContents.on('did-finish-load', () => {
      log.info(`[WINDOW_MANAGER] Window loaded: ${name}`);
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      log.error(`[WINDOW_MANAGER] Window failed to load: ${name}. Error: ${errorCode} - ${errorDescription}`);
    });

    win.webContents.on('devtools-opened', () => {
      log.info(`[WINDOW_MANAGER] DevTools opened for: ${name}`);
    });

    win.webContents.on('devtools-closed', () => {
      log.info(`[WINDOW_MANAGER] DevTools closed for: ${name}`);
    });

    let resizeTimeout = null;
    let isCurrentlyResizing = false;

    win.on('will-resize', () => {
      // Only send 'true' once per resize operation
      if (!isCurrentlyResizing) {
        isCurrentlyResizing = true;
        win.webContents.send('window-resizing', true);
      }
      // Reset the "done" timer on each move
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        isCurrentlyResizing = false;
        if (!win.isDestroyed()) win.webContents.send('window-resizing', false);
      }, 150);
    });

    win.on('resized', () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      isCurrentlyResizing = false;
      win.webContents.send('window-resizing', false);
    });

    win.on('minimize', (event) => {
      event.preventDefault();
      log.info(`[WINDOW_MANAGER] Prevented minimize for: ${name}`);
      if (win.isMinimized()) {
        win.restore();
      }
    });

    // Cleanup on close
    win.on('closed', () => {
      log.info(`[WINDOW_MANAGER] Window closed: ${name}`);
      this.windows[name] = null;
    });

    // Apply stealth mode to newly created windows BEFORE they are shown.
    // On Windows, setting this AFTER the window is shown on a transparent window fails to apply to the DWM surface.
    try {
      if (name !== 'splash') {
        const store = require('../store/jsonStore');
        const settings = store.getSettings();
        const isStealth = !!settings?.general?.stealthMode;
        console.log(`[WINDOW_MANAGER] Initializing stealth mode for ${name}. isStealth: ${isStealth}, alwaysOnTop: ${win.isAlwaysOnTop()}`);
        
        const success = win.setContentProtection(isStealth);
        try { win.setSkipTaskbar(isStealth); } catch (e) {}
        console.log(`[WINDOW_MANAGER] Initial stealth mode applied for ${name}: ${success}`);
      }
    } catch (e) {
      console.error(`[WINDOW_MANAGER] Failed to apply initial stealth mode for ${name}:`, e);
    }

    // Ensure content protection is enforced whenever the window is shown, restored, or focused (prevents OS resets)
    const enforceStealth = (eventSource) => {
      const runEnforce = (delay) => {
        setTimeout(() => {
          if (win.isDestroyed()) return;
          try {
            const store = require('../store/jsonStore');
            const settings = store.getSettings();
            const isStealth = !!settings?.general?.stealthMode;
            
            const success = win.setContentProtection(isStealth);
            try { win.setSkipTaskbar(isStealth); } catch (e) {}
            console.log(`[WINDOW_MANAGER] [Enforce:${eventSource}:${delay}ms] for ${name} (alwaysOnTop: ${win.isAlwaysOnTop()}, visible: ${win.isVisible()}) -> setContentProtection(${isStealth}): ${success}`);
          } catch (e) {
            console.error(`[WINDOW_MANAGER] [Enforce:${eventSource}:${delay}ms] Failed for ${name}:`, e);
          }
        }, delay);
      };

      // Run multiple times to ensure OS style changes/composition settle
      runEnforce(50);
      runEnforce(200);
      runEnforce(500);
      runEnforce(1500);
    };

    win.on('show', () => enforceStealth('show'));
    win.on('restore', () => enforceStealth('restore'));
    win.on('focus', () => enforceStealth('focus'));

    return win;
  }

  // --- Specific Window Wrappers ---

  createCommandWindow() {
    const win = this.createWindow('command');
    
    win.on('blur', () => {
      log.info('[WINDOW_MANAGER] >>> Command BLUR fired, enforcing alwaysOnTop');
      if (!win.isDestroyed() && win.isVisible()) {
        win.setAlwaysOnTop(true, 'pop-up-menu');
      }
    });

    win.on('close', (event) => {
      if (!require('../appState').isQuitting) {
        event.preventDefault();
        win.hide();
      }
    });
    return win;
  }

  createChatWindow(showActive = true) {
    const win = this.createWindow('chat');
    
    win.on('blur', () => {
      log.info('[WINDOW_MANAGER] >>> Chat BLUR fired, enforcing alwaysOnTop');
      if (!win.isDestroyed() && win.isVisible()) {
        win.setAlwaysOnTop(true, 'pop-up-menu');
      }
    });

    if (showActive) {
      win.setAlwaysOnTop(true, 'pop-up-menu');
      win.moveTop();
      win.show();
      win.focus();
    } else {
      // Due to Windows DWM bugs with Stealth Mode (setContentProtection) on transparent windows,
      // we CANNOT leave the window hidden after creation. We MUST show it immediately.
      // We use showInactive() to render the transparent surface without stealing focus.
      win.showInactive();
    }
    return win;
  }

  createVoiceWindow() {
    const win = this.createWindow('voice');
    win.on('close', (event) => {
      if (!require('../appState').isQuitting) {
        event.preventDefault();
        win.blur();
        win.hide();
      }
    });

    win.on('blur', () => {
      log.info('[WINDOW_MANAGER] Voice window blurred');
      if (win.webContents.isDevToolsOpened()) {
        log.info('[WINDOW_MANAGER] DevTools are open, keeping voice window visible.');
        return;
      }
      win.hide();
    });
    return win;
  }

  createSusurroSetupWindow() {
    const win = this.createWindow('susurroSetup');
    win.once('ready-to-show', () => win.show());
    return win;
  }

  createSusurroWindow() {
    const win = this.createWindow('susurro');
    
    win.on('blur', () => {
      log.info('[WINDOW_MANAGER] Susurro window blurred, enforcing alwaysOnTop');
      if (!win.isDestroyed() && win.isVisible()) {
        win.setAlwaysOnTop(true, 'pop-up-menu');
      }
    });

    win.on('minimize', (event) => {
      event.preventDefault();
      log.info('[WINDOW_MANAGER] Susurro window minimized, restoring to keep on top');
      if (win.isMinimized()) win.restore();
    });

    win.on('hide', () => {
      log.info('[WINDOW_MANAGER] Susurro window hidden, stopping session');
      win.webContents.send('stop-susurro');
    });

    win.on('close', (event) => {
      if (!require('../appState').isQuitting) {
        event.preventDefault();
        win.hide();
      }
    });
    
    return win;
  }

  createSuggestionsWindow() {
    return this.createWindow('suggestions');
  }

  createNotificationWindow() {
    return this.createWindow('notification');
  }

  createSettingsWindow() {
    const win = this.createWindow('settings');
    win.once('ready-to-show', () => win.show());
    // Settings window should not close on blur
    win.on('close', (event) => {
      if (!require('../appState').isQuitting) {
        event.preventDefault();
        win.hide();
      }
    });
    return win;
  }

  /**
   * Configures a window to open external links in the default system browser.
   * @param {BrowserWindow} window 
   */
  setupExternalLinks(window) {
    window.webContents.on('will-navigate', (event, url) => {
      // Allow internal navigation (localhost or file protocol)
      const isInternal = url.startsWith('http://localhost') || url.startsWith('file://');
      if (!isInternal) {
        event.preventDefault();
        shell.openExternal(url);
      }
    });

    window.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: 'deny' };
    });
  }
}

module.exports = new WindowManager();
