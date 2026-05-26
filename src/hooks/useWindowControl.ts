import { useState, useEffect, useRef, useCallback } from 'react';
import { electronService } from '../services/electron';

/**
 * Hook to manage shared window controls like pinning, resizing, and closing.
 * 
 * Resize detection uses the native OS resize via Electron's will-resize/resized
 * events. The isResizing state is toggled via CSS class on the DOM root directly
 * to avoid React re-renders during the resize loop.
 */
export const useWindowControl = (initialPinned = false) => {
  const [isPinned, setIsPinned] = useState(initialPinned);
  const isResizingRef = useRef(false);

  // Sync pin state on mount
  useEffect(() => {
    electronService.isPinned().then(pinned => {
      setIsPinned(pinned);
    });
  }, []);

  /**
   * Toggles the window's "Always on Top" (pin) state.
   */
  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    electronService.updateChatPin(next);
  };

  /**
   * Closes the current window.
   */
  const handleMinimize = () => {
    electronService.closeWindow();
  };

  // Use IPC to detect when native resizing starts/stops.
  // Instead of React state (which triggers re-renders), toggle CSS class directly on DOM.
  useEffect(() => {
    const unsub = electronService.onWindowResizing((resizing) => {
      if (isResizingRef.current === resizing) return; // deduplicate
      isResizingRef.current = resizing;

      const root = document.querySelector('.app-container');
      if (root) {
        if (resizing) {
          root.classList.add('resizing');
        } else {
          root.classList.remove('resizing');
        }
      }
    });
    return unsub;
  }, []);

  return {
    isPinned,
    togglePin,
    handleMinimize,
  };
};
