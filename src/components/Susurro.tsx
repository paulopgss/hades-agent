import React, { useCallback } from 'react';
import { Activity, Maximize2, GripHorizontal, Languages, Minus, Plus, Type, Pin, PinOff, Mic, Square, FilePlus } from 'lucide-react';
import { SusurroChatList } from './susurro/SusurroChatList';
import { SusurroHeader } from './susurro/SusurroHeader';
import { useSusurro } from '../hooks/useSusurro';
import { electronService } from '../services/electron';

interface SusurroProps {
  activeMode?: 'chat' | 'susurro';
  onSwitchMode?: (mode: 'chat' | 'susurro') => void;
}

/**
 * Susurro: Real-time transcription and translation component.
 * Orchestrates audio capture, AI-driven transcription deltas, and multi-language translation.
 * Refactored for modularity and maintainability.
 */
const Susurro: React.FC<SusurroProps> = ({ activeMode = 'susurro', onSwitchMode }) => {
  const s = useSusurro(activeMode === 'susurro');
  const [isCompactMode, setIsCompactMode] = React.useState(() => {
    const saved = localStorage.getItem('susurro-compact-mode');
    return saved === 'true';
  });

  const [compactOpacity, setCompactOpacity] = React.useState(() => {
    return Number.parseFloat(localStorage.getItem('susurro-compact-opacity') || '0.7');
  });

  /** Drag-to-resize handler — rAF throttled + fire-and-forget IPC. */
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.screenX;
    const startY = e.screenY;
    const startW = window.outerWidth;
    const startH = window.outerHeight;
    const MIN_W = 360;
    const MIN_H = 300;
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
    localStorage.setItem('susurro-compact-mode', String(isCompactMode));
  }, [isCompactMode]);

  React.useEffect(() => {
    localStorage.setItem('susurro-compact-opacity', String(compactOpacity));
  }, [compactOpacity]);

  React.useEffect(() => {
    if (activeMode !== 'susurro') {
      if (s.isTranscribing || s.isConnecting) {
        s.stopTranscriptionHades();
      }
    }
  }, [activeMode, s.isTranscribing, s.isConnecting, s.stopTranscriptionHades]);

  return (
    <div 
      className={`app-container chat-mode susurro-mode ${isCompactMode ? 'compact-mode' : 'glassmorphic-susurro'}`}
      style={isCompactMode ? { background: `rgba(10, 5, 5, ${compactOpacity})` } : {}}
    >
      {/* Status Bar / Header */}
      {!isCompactMode && (
        <SusurroHeader
          isCompactMode={isCompactMode}
          setIsCompactMode={setIsCompactMode}
          timer={s.timer}
          tokens={s.tokens}
          isTranscribing={s.isTranscribing}
          isConnecting={s.isConnecting}
          isGlobalTranslationEnabled={s.isGlobalTranslationEnabled}
          targetLanguage={s.targetLanguage}
          targetLanguageLabel={s.targetLanguageLabel}
          isSettingsOpen={s.isSettingsOpen}
          setIsSettingsOpen={s.setIsSettingsOpen}
          menuView={s.menuView}
          setMenuView={s.setMenuView}
          setTargetLanguage={s.setTargetLanguage}
          setTargetLanguageLabel={s.setTargetLanguageLabel}
          handleMinimize={s.handleMinimize}
          handleToggleGlobalTranslation={s.handleToggleGlobalTranslation}
          isSuggestionsEnabled={s.isSuggestionsEnabled}
          setIsSuggestionsEnabled={s.setIsSuggestionsEnabled}
          selectedPersona={s.selectedPersona}
          setSelectedPersona={s.setSelectedPersona}
          personas={s.personas}
          isCreatingPersona={s.isCreatingPersona}
          setIsCreatingPersona={s.setIsCreatingPersona}
          newPersonaName={s.newPersonaName}
          setNewPersonaName={s.setNewPersonaName}
          newPersonaPrompt={s.newPersonaPrompt}
          setNewPersonaPrompt={s.setNewPersonaPrompt}
          handleSavePersona={s.handleSavePersona}
          handleDeletePersona={s.handleDeletePersona}
          fontSize={s.fontSize}
          increaseFontSize={s.increaseFontSize}
          decreaseFontSize={s.decreaseFontSize}
          onCloseSession={s.onCloseSession}
          activeMode={activeMode}
          onSwitchMode={onSwitchMode}
          currentSessionId={s.currentSessionId}
          isClosingSession={s.isClosingSession}
        />
      )}

      {isCompactMode && (
        <div className="compact-controls">
          <button
            className="compact-action-btn"
            onClick={s.onCloseSession}
            title="Nova sessão"
          >
            <FilePlus size={14} />
          </button>

          <button
            className={`compact-action-btn ${s.isTranscribing || s.isConnecting ? 'active' : ''}`}
            onClick={!s.susurroPushToTalk ? s.toggleTranscriptionHades : undefined}
            onMouseDown={(e) => {
              if (s.susurroPushToTalk && !s.isTranscribing && !s.isConnecting) {
                s.startTranscriptionHades();
              }
            }}
            onMouseUp={s.susurroPushToTalk ? s.stopTranscriptionHades : undefined}
            onMouseLeave={s.susurroPushToTalk ? s.stopTranscriptionHades : undefined}
            disabled={s.isConnecting}
            title={s.susurroPushToTalk 
              ? (s.isTranscribing ? "Solte para enviar" : "Segure para falar")
              : (s.isTranscribing ? "Parar Gravação" : "Iniciar Gravação")
            }
            style={{ 
              borderColor: s.isTranscribing ? 'rgba(239, 68, 68, 0.5)' : undefined,
              backgroundColor: s.isTranscribing ? 'rgba(239, 68, 68, 0.2)' : undefined
            }}
          >
            {s.isTranscribing || s.isConnecting ? (
              <Square size={14} color="#ef4444" fill="#ef4444" />
            ) : (
              <Mic size={14} />
            )}
          </button>

          <button
            className={`compact-action-btn ${s.isGlobalTranslationEnabled ? 'active' : ''}`}
            onClick={s.handleToggleGlobalTranslation}
            title="Tradução Global"
          >
            <Languages size={14} color={s.isGlobalTranslationEnabled ? "var(--accent-light)" : "currentColor"} />
          </button>



          <div className="compact-font-controls" style={{ display: 'flex', alignItems: 'center', background: 'rgba(10, 10, 10, 0.6)', backdropFilter: 'blur(4px)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <button className="compact-action-btn" onClick={s.decreaseFontSize} title="Diminuir fonte" style={{ border: 'none', background: 'transparent' }}>
              <Minus size={12} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 4px', fontSize: '10px', color: 'rgba(255, 255, 255, 0.8)', cursor: 'default', userSelect: 'none' }}>
              <Type size={10} style={{ opacity: 0.5 }} />
              <span>{s.fontSize}</span>
            </div>
            <button className="compact-action-btn" onClick={s.increaseFontSize} title="Aumentar fonte" style={{ border: 'none', background: 'transparent' }}>
              <Plus size={12} />
            </button>
          </div>

          <div className="compact-opacity-controls" style={{ display: 'flex', alignItems: 'center', background: 'rgba(10, 10, 10, 0.6)', backdropFilter: 'blur(4px)', borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '0 8px', marginLeft: '4px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.8)', marginRight: '4px' }}>Opacidade</span>
            <input 
              type="range" 
              min="0.1" 
              max="1" 
              step="0.05" 
              value={compactOpacity} 
              onChange={(e) => setCompactOpacity(Number.parseFloat(e.target.value))}
              style={{ width: '60px', cursor: 'pointer' }}
            />
          </div>

          <div className="compact-drag-area">
            <GripHorizontal size={14} />
          </div>
          <button className="compact-action-btn" onClick={() => setIsCompactMode(false)} title="Restaurar Janela">
            <Maximize2 size={14} />
          </button>
        </div>
      )}

      {/* Main Chat Area */}
      <SusurroChatList
        messages={s.messages}
        targetLanguageLabel={s.targetLanguageLabel}
        handleToggleMessageTranslation={s.handleToggleMessageTranslation}
        copiedId={s.copiedId}
        copyToClipboard={s.copyToClipboard}
        chatEndRef={s.chatEndRef}
        handleScroll={s.handleScroll}
      />

      {/* Footer Controls */}
      {!isCompactMode && (
        <div className="susurro-footer">
          <button
            className={`mic-trigger ${s.isTranscribing || s.isConnecting ? 'active' : ''} ${s.isConnecting ? 'connecting' : ''}`}
            onClick={!s.susurroPushToTalk ? s.toggleTranscriptionHades : undefined}
            onMouseDown={(e) => {
              if (s.susurroPushToTalk && !s.isTranscribing && !s.isConnecting) {
                s.startTranscriptionHades();
              }
            }}
            onMouseUp={s.susurroPushToTalk ? s.stopTranscriptionHades : undefined}
            onMouseLeave={s.susurroPushToTalk ? s.stopTranscriptionHades : undefined}
            disabled={s.isConnecting}
            title={s.susurroPushToTalk 
              ? (s.isTranscribing ? "Solte para enviar" : "Segure para falar")
              : (s.isTranscribing ? "Parar Gravação" : "Iniciar Gravação")
            }
          >
            <div className="mic-ring" />
            <div className="mic-ring-outer" />
            <div className="mic-icon-box">
              <Activity size={24} className={s.isTranscribing || s.isConnecting ? 'visible' : 'hidden'} />
              <div className={`mic-dot ${s.isTranscribing || s.isConnecting ? 'hidden' : 'visible'}`} />
            </div>
          </button>
        </div>
      )}

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

export default Susurro;
