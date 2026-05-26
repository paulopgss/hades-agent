import { useState, useEffect, useRef, useCallback } from 'react';
import { electronService } from '../services/electron';

/**
 * Hook to manage shared window controls like pinning, resizing, and closing.
 * 
 * Resize detection uses the native OS resize via Electron's will-resize/resized
 * events. The isResizing state is toggled via CSS class on the DOM root directly
 * to avoid React re-renders during the resize loop.
 */
export const useWindowControl = () => {
  const isResizingRef = useRef(false);

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
    handleMinimize,
  };
};
