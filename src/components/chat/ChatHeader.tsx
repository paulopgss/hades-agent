import React, { useState, useEffect } from 'react';

import { Menu, Plus, Minus, Settings2, Pin, MessageSquare, Type } from 'lucide-react';
import { electronService } from '../../services/electron';

interface ChatHeaderProps {
  tokens: number;
  currentModel: string;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  onNewChat: () => void;
  onMinimize: () => void;
  onLoadSession: (id: string) => void;
  activeMode?: 'chat' | 'susurro';
  onSwitchMode?: (mode: 'chat' | 'susurro') => void;
  fontSize?: number;
  increaseFontSize?: () => void;
  decreaseFontSize?: () => void;
  currentSessionId?: string | null;
}

/**
 * Header component for the MiniChat window.
 */
export const ChatHeader: React.FC<ChatHeaderProps> = ({
  tokens,
  currentModel,
  isSettingsOpen,
  setIsSettingsOpen,
  onNewChat,
  onMinimize,
  onLoadSession,
  activeMode,
  onSwitchMode,
  fontSize = 14,
  increaseFontSize,
  decreaseFontSize,
  currentSessionId
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);

  // Fetch history when menu opens
  useEffect(() => {
    if (isMenuOpen) {
      electronService.getHistoryData().then(data => {
        if (data && data.chatHistory) {
          // Sort by timestamp descending
          const sorted = data.chatHistory.sort((a: any, b: any) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          setSessions(sorted);
        }
      });
    }
  }, [isMenuOpen]);

  return (
    <div className="chat-header">
      <div className="chat-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ position: 'relative', WebkitAppRegion: 'no-drag' as React.CSSProperties }}>
          <button 
            className="action-btn" 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title="Menu"
            style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px' }}
          >
            <Menu size={16} />
          </button>
        </div>

        {onSwitchMode && (
          <div className="mode-switcher" style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '12px', padding: '2px', marginLeft: '12px', WebkitAppRegion: 'no-drag' as React.CSSProperties }}>
            <button 
              onClick={() => onSwitchMode('chat')} 
              style={{
                padding: '4px 12px',
                borderRadius: '10px',
                border: 'none',
                background: activeMode === 'chat' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeMode === 'chat' ? '#fff' : '#888',
                fontSize: '12px',
                fontWeight: activeMode === 'chat' ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Chat
            </button>
            <button 
              onClick={() => onSwitchMode('susurro')} 
              style={{
                padding: '4px 12px',
                borderRadius: '10px',
                border: 'none',
                background: activeMode === 'susurro' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: activeMode === 'susurro' ? '#fff' : '#888',
                fontSize: '12px',
                fontWeight: activeMode === 'susurro' ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Susurro
            </button>
          </div>
        )}
        
        {/* Render sidebar inside the chat header wrapper, but absolute positioned relative to .app-container */}
        <div 
          className={`settings-overlay ${isMenuOpen ? 'open' : ''}`}
          onClick={() => setIsMenuOpen(false)}
        />

        <div className={`sidebar-menu ${isMenuOpen ? 'open' : ''}`}>
              <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '10px 4px 0' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '1px' }}>Menu Principal</span>
                <button className="action-btn" onClick={() => setIsMenuOpen(false)} style={{ padding: '6px' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 4px' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={() => {
                      onNewChat();
                      setIsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      background: 'rgba(220, 38, 38, 0.1)',
                      color: '#dc2626',
                      border: '1px solid rgba(220, 38, 38, 0.2)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.2)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'rgba(220, 38, 38, 0.1)'}
                  >
                    <Plus size={16} /> Novo Chat
                  </button>
                </div>
                
                {sessions.length > 0 && (
                  <div style={{ marginTop: '12px' }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#888', paddingLeft: '4px', marginBottom: '8px', letterSpacing: '0.5px' }}>
                      Histórico de Sessões
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {sessions.map(session => (
                        <button
                          key={session.id}
                          onClick={() => {
                            onLoadSession(session.id);
                            setIsMenuOpen(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            background: session.id === currentSessionId ? 'rgba(255, 255, 255, 0.15)' : 'transparent',
                            color: session.id === currentSessionId ? '#fff' : '#ccc',
                            border: session.id === currentSessionId ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontSize: '13px',
                            width: '100%',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = session.id === currentSessionId ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = session.id === currentSessionId ? 'rgba(255, 255, 255, 0.15)' : 'transparent';
                            e.currentTarget.style.color = session.id === currentSessionId ? '#fff' : '#ccc';
                          }}
                        >
                          <MessageSquare size={14} style={{ opacity: 0.7, flexShrink: 0 }} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {session.title || 'Sessão sem nome'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>

      <div className="chat-actions">
        <div className="info-wrapper">
          <button className="action-btn info-btn" title="Uso do Modelo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </button>
          <div className="usage-popup">
            {currentModel.split('/')[1] || currentModel} • {tokens.toLocaleString()} tokens
          </div>
        </div>

        <button 
          className={`action-btn settings-btn ${isSettingsOpen ? 'active' : ''}`}
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          title="Configurações"
        >
          <Settings2 size={16} />
        </button>



        {increaseFontSize && decreaseFontSize && (
          <div className="font-controls" style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '6px', padding: '2px', WebkitAppRegion: 'no-drag' as React.CSSProperties }}>
            <button className="action-btn" onClick={decreaseFontSize} title="Diminuir fonte">
              <Minus size={14} />
            </button>
            <div className="font-size-indicator" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#888', fontWeight: 600, padding: '0 4px', minWidth: '32px', justifyContent: 'center' }}>
              <Type size={10} style={{ opacity: 0.5 }} />
              <span>{fontSize}</span>
            </div>
            <button className="action-btn" onClick={increaseFontSize} title="Aumentar fonte">
              <Plus size={14} />
            </button>
          </div>
        )}

        <button 
          className="action-btn close-btn" 
          onClick={onMinimize}
          title="Minimizar"
        >
          <Minus size={16} />
        </button>
      </div>
    </div>
  );
};

