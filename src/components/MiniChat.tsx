import React, { useState, useCallback } from 'react';
import { ChatHeader } from './chat/ChatHeader';
import { SettingsMenu } from './chat/SettingsMenu';
import { ChatList } from './chat/ChatList';
import { ChatInput } from './chat/ChatInput';
import { useMiniChat } from '../hooks/useMiniChat';
import { electronService } from '../services/electron';

interface MiniChatProps {
  activeMode?: 'chat' | 'susurro';
  onSwitchMode?: (mode: 'chat' | 'susurro') => void;
}

/**
 * MiniChat component - Main entry point for the AI chat interface.
 * Orchestrates messages, AI inference, and window controls via useMiniChat hook.
 */
const MiniChat: React.FC<MiniChatProps> = ({ activeMode = 'chat', onSwitchMode }) => {
  const {
    messages,
    pendingMessages,
    isThinking,
    activeTool,
    isBusy,
    isPinned,
    tokens,
    isSettingsOpen,
    menuView,
    currentModel,
    copiedId,
    chatEndRef,
    setCurrentModel,
    setIsSettingsOpen,
    setMenuView,
    togglePin,
    handleMinimize,
    clearHistory,
    loadSession,
    isLoadingSession,
    copyToClipboard,
    currentSessionId,
    cancelGeneration
  } = useMiniChat();

  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [fontSize, setFontSize] = useState(14); // Default 14px

  React.useEffect(() => {
    document.documentElement.style.setProperty('--chat-base-font-size', `${fontSize}px`);
  }, [fontSize]);

  const increaseFontSize = () => setFontSize(prev => Math.min(prev + 1, 24));
  const decreaseFontSize = () => setFontSize(prev => Math.max(prev - 1, 10));

  // Close dropdown on clicking outside
  const handleContainerClick = () => {
    if (isModelDropdownOpen) setIsModelDropdownOpen(false);
  };

  /** Drag-to-resize handler using rAF throttling + fire-and-forget IPC for smooth resize. */
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.screenX;
    const startY = e.screenY;
    const startW = window.outerWidth;
    const startH = window.outerHeight;
    const MIN_W = 400;
    const MIN_H = 400;
    let rafId: number;

    const onMove = (ev: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const newW = Math.max(MIN_W, startW + (ev.screenX - startX));
        const newH = Math.max(MIN_H, startH + (ev.screenY - startY));
        electronService.resizeWindowFast(Math.round(newW), Math.round(newH));
      });
    };

    const onUp = () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  React.useEffect(() => {
    const handleLoadChatSession = (e: any) => {
      const { id, isNew } = e.detail;
      if (onSwitchMode) onSwitchMode('chat');
      if (isNew) {
        clearHistory(true);
      } else if (id) {
        loadSession(id);
      }
    };
    
    globalThis.addEventListener('load-chat-session', handleLoadChatSession as any);
    return () => globalThis.removeEventListener('load-chat-session', handleLoadChatSession as any);
  }, [onSwitchMode, clearHistory, loadSession]);

  return (
    <div 
      className={`app-container ${activeMode}-mode`}
      onClick={handleContainerClick}
      onKeyDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        
        if (e.key === 'Enter' || e.key === ' ') {
          handleContainerClick();
        }
      }}
      role="region"
      aria-label="Chat Interface"
    >
      <ChatHeader
        tokens={tokens}
        currentModel={currentModel}
        isPinned={isPinned}
        isSettingsOpen={isSettingsOpen}
        togglePin={togglePin}
        setIsSettingsOpen={setIsSettingsOpen}
        onMinimize={handleMinimize}
        onNewChat={() => clearHistory(true)}
        onLoadSession={loadSession}
        activeMode={activeMode}
        onSwitchMode={onSwitchMode}
        fontSize={fontSize}
        increaseFontSize={increaseFontSize}
        decreaseFontSize={decreaseFontSize}
        currentSessionId={currentSessionId}
      />

      <SettingsMenu
        isOpen={isSettingsOpen}
        view={menuView}
        currentModel={currentModel}
        onSetView={setMenuView}
        onSelectModel={setCurrentModel}
        onClose={() => setIsSettingsOpen(false)}
      />

      {isLoadingSession ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            position: 'relative',
            background: 'rgba(255,255,255,0.05)',
            width: '120px',
            height: '6px',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '50%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
              animation: 'glint 1s infinite ease-in-out'
            }} />
          </div>
          <span style={{ fontSize: '11px', color: '#888', letterSpacing: '0.5px' }}>Carregando sessão...</span>
          <style>
            {`
              @keyframes glint {
                0% { left: -100%; }
                100% { left: 200%; }
              }
            `}
          </style>
        </div>
      ) : (
        <ChatList
          messages={messages}
          pendingMessages={pendingMessages}
          isThinking={isThinking}
          activeTool={activeTool}
          copiedId={copiedId}
          onCopy={copyToClipboard}
          chatEndRef={chatEndRef}
        />
      )}

      <ChatInput 
        currentModel={currentModel}
        onSelectModel={setCurrentModel}
        isModelDropdownOpen={isModelDropdownOpen}
        setIsModelDropdownOpen={setIsModelDropdownOpen}
        isThinking={isThinking}
        isBusy={isBusy}
        onCancel={cancelGeneration}
        activeMode={activeMode}
      />

      <div
        className="resize-handle"
        role="separator"
        aria-label="Drag to resize window"
        tabIndex={0}
        onMouseDown={handleResizeMouseDown}
      >
        <div className="resize-square" />
      </div>
    </div>
  );
};

export default MiniChat;
