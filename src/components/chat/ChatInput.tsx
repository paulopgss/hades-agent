import React, { useState, useEffect, useRef } from 'react';
import { Camera, Plus, X, Paperclip, ChevronDown, Check, Mic, Send, Square } from 'lucide-react';
import { electronService } from '../../services/electron';
import { MODELS } from '../../constants/models';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { encodeWAV, floatTo16BitPCM, arrayBufferToBase64 } from '../../utils/audio';

const processPastedImage = (
  e: React.ClipboardEvent,
  setAttachedImage: (val: string | null) => void
) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.includes('image')) {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          setAttachedImage(base64);
        };
        reader.readAsDataURL(file);
        e.preventDefault();
        break;
      }
    }
  }
};

const processAudio = async (
  accumulatedAudio: Float32Array[],
  attachedImage: string | null,
  setIsTranscribing: (val: boolean) => void,
  setAttachedImage: (val: string | null) => void
) => {
  try {
    if (accumulatedAudio.length === 0) {
      throw new Error("No audio captured");
    }

    const totalSamples = accumulatedAudio.reduce((acc, b) => acc + b.length, 0);
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const b of accumulatedAudio) {
      merged.set(b, offset);
      offset += b.length;
    }

    const pcm16 = floatTo16BitPCM(merged);
    const wav = encodeWAV(pcm16, 16000);
    const base64 = arrayBufferToBase64(wav);

    const result = await electronService.transcribeAudio(base64);
    setIsTranscribing(false);

    if (result?.trim()) {
      electronService.sendMessage(result.trim(), attachedImage || undefined);
      setAttachedImage(null);
    }
  } catch (err) {
    console.error('[CHAT_INPUT] Transcription error:', err);
    setIsTranscribing(false);
  }
};

interface ChatInputProps {
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  isModelDropdownOpen: boolean;
  setIsModelDropdownOpen: (isOpen: boolean) => void;
  isThinking?: boolean;
  isBusy?: boolean;
  onCancel?: () => void;
  activeMode?: 'chat' | 'susurro';
}

export const ChatInput: React.FC<ChatInputProps> = ({
  currentModel,
  onSelectModel,
  isModelDropdownOpen,
  setIsModelDropdownOpen,
  isThinking = false,
  isBusy = false,
  onCancel,
  activeMode = 'chat'
}) => {
  const [query, setQuery] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const MAX_CHARS = 2000;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const accumulatedAudio = useRef<Float32Array[]>([]);
  const { startRecording, stopRecording } = useAudioRecorder();

  // Resize textarea automatically
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [query]);

  // Handle window focus and IPC focus events
  useEffect(() => {
    const handleFocus = () => {
      setTimeout(() => inputRef.current?.focus(), 50);
    };

    window.addEventListener('focus', handleFocus);
    
    const cleanupFocusIPC = electronService.onFocusInput(() => {
      handleFocus();
    });

    handleFocus(); // Initial focus

    return () => {
      window.removeEventListener('focus', handleFocus);
      cleanupFocusIPC();
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!query.trim() && !attachedImage) return;
    electronService.sendMessage(query.trim(), attachedImage || undefined);
    setQuery('');
    setAttachedImage(null);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    processPastedImage(e, setAttachedImage);
  };

  const handleFileOpen = async () => {
    const base64 = await electronService.openFileDialog();
    if (base64) {
      setAttachedImage(base64);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleCapture = async () => {
    electronService.closeWindow();
    setTimeout(async () => {
      const screens = await electronService.captureAllScreens();
      let finalBase64 = null;

      if (!screens || (Array.isArray(screens) && screens.length === 0)) {
        if (activeMode === 'susurro') electronService.showSusurro();
        else electronService.showChat();
        return;
      }

      if (typeof screens === 'string') {
        finalBase64 = screens;
      } else if (Array.isArray(screens)) {
        if (screens.length === 1) {
          finalBase64 = screens[0];
        } else {
          try {
            const images = await Promise.all(screens.map(src => {
              return new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = src;
              });
            }));
            
            const totalWidth = images.reduce((acc, img) => acc + img.width, 0);
            const maxHeight = Math.max(...images.map(img => img.height));
            
            const canvas = document.createElement('canvas');
            canvas.width = totalWidth;
            canvas.height = maxHeight;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
              let currentX = 0;
              images.forEach(img => {
                ctx.drawImage(img, currentX, 0);
                currentX += img.width;
              });
              finalBase64 = canvas.toDataURL('image/jpeg', 0.8);
            } else {
              finalBase64 = screens[0];
            }
          } catch (e) {
            console.error('Error stitching screens:', e);
            finalBase64 = screens[0];
          }
        }
      }

      if (finalBase64) {
        setAttachedImage(finalBase64);
      }
      
      if (activeMode === 'susurro') {
        electronService.showSusurro();
      } else {
        electronService.showChat();
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }, 100);
  };

  // Keyboard shortcut for Ctrl+E to capture screen
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleCapture();
      }
    };
    
    globalThis.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      globalThis.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  // Voice recording logic
  const handleToggleRecord = async () => {
    if (isRecording) {
      // Stop and transcribe
      setIsRecording(false);
      setIsTranscribing(true);
      stopRecording();
      await processAudio(accumulatedAudio.current, attachedImage, setIsTranscribing, setAttachedImage);
    } else {
      // Start recording
      setIsRecording(true);
      accumulatedAudio.current = [];
      await startRecording({
        sampleRate: 16000,
        onRawChunk: (samples) => {
          accumulatedAudio.current.push(new Float32Array(samples));
        },
        isSystemAudio: false
      });
    }
  };

  const activeModelData = MODELS.find(m => m.id === currentModel);

  let placeholderText = "O que você precisa?";
  if (isRecording) {
    placeholderText = "Gravando áudio...";
  } else if (isTranscribing) {
    placeholderText = "Transcrevendo...";
  }

  let micAnimation = 'none';
  if (isRecording) {
    micAnimation = 'pulse 1.5s infinite';
  } else if (isTranscribing) {
    micAnimation = 'glint 1.5s infinite';
  }

  return (
    <div className="chat-input-container" style={{
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 16px',
      background: activeMode === 'susurro' ? 'rgba(15, 10, 10, 0.95)' : '#0f0a0a',
      borderTop: '1px solid rgba(220, 38, 38, 0.1)',
      backdropFilter: activeMode === 'susurro' ? 'blur(10px)' : 'none',
      gap: '8px'
    }}>
      
      <div className="textarea-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <textarea
          ref={inputRef}
          placeholder={placeholderText}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          disabled={isRecording || isTranscribing}
          className="command-input"
          rows={1}
          style={{ 
            width: '100%', 
            paddingRight: attachedImage ? '180px' : '12px',
            transition: 'padding-right 0.2s ease',
            lineHeight: '20px',
            resize: 'none',
            maxHeight: '120px',
            minHeight: '36px',
            paddingTop: '8px',
            paddingBottom: '8px',
            backgroundColor: 'rgba(0,0,0,0.2)',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.05)',
            color: '#fff',
            outline: 'none',
            paddingLeft: '12px',
            boxSizing: 'border-box',
            overflow: 'hidden'
          }}
        />

        {attachedImage && (
          <div className="attachment-indicator" style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '3px 8px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '6px',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.8)',
            border: '1px solid rgba(255,255,255,0.15)',
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 30
          }}>
            <Paperclip size={12} />
            <span>imagem.png</span>
            <button 
              onClick={() => setAttachedImage(null)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px', borderRadius: '4px', marginLeft: '4px' }}
            >
              <X size={12} />
            </button>
          </div>
        )}
      </div>

      <div className="input-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="footer-left" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="action-btn" 
              onClick={handleFileOpen}
              title="Upload Imagem"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Plus size={18} color="#dc2626" />
            </button>

            <button 
              className="action-btn" 
              onClick={handleCapture}
              title="Capturar Tela (Ctrl+E)"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Camera size={18} color="#dc2626" />
            </button>
          </div>

          <div style={{ position: 'relative' }}>
            <button 
              className="footer-btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsModelDropdownOpen(!isModelDropdownOpen);
              }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'rgba(220, 38, 38, 0.04)',
              border: '1px solid rgba(220, 38, 38, 0.12)',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.8)'
            }}
            title="Selecionar Modelo"
          >
            <span style={{ fontSize: '11px' }}>
              {activeModelData?.name || currentModel}
            </span>
            <ChevronDown 
              size={12} 
              color="rgba(255, 255, 255, 0.4)" 
              style={{ transform: isModelDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} 
            />
          </button>

          {isModelDropdownOpen && (
            <div 
              style={{
                position: 'absolute',
                bottom: '100%',
                left: '0',
                marginBottom: '8px',
                width: '290px',
                background: 'rgba(8, 4, 4, 0.96)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(220, 38, 38, 0.25)',
                borderRadius: '8px',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.65), 0 0 15px rgba(220, 38, 38, 0.08)',
                zIndex: 100,
                padding: '6px 0',
              }}
            >
              {MODELS.map((m) => {
                const isSelected = m.id === currentModel;
                return (
                  <button
                    key={m.id}
                    onClick={() => { onSelectModel(m.id); setIsModelDropdownOpen(false); }}
                    style={{
                      width: '100%',
                      background: isSelected ? 'rgba(220, 38, 38, 0.15)' : 'transparent',
                      border: 'none',
                      borderLeft: isSelected ? '3px solid #dc2626' : '3px solid transparent',
                      color: isSelected ? '#fff' : 'rgba(255,255,255,0.75)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{m.name}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {m.tag && (
                        <span style={{
                          background: m.tag === 'Thinking' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(220, 38, 38, 0.15)',
                          border: m.tag === 'Thinking' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(220, 38, 38, 0.3)',
                          color: m.tag === 'Thinking' ? '#f59e0b' : '#ef4444',
                          fontSize: '9px',
                          fontWeight: 700,
                          padding: '1px 5px',
                          borderRadius: '4px',
                          textTransform: 'uppercase'
                        }}>
                          {m.tag}
                        </span>
                      )}
                      {isSelected && <Check size={12} color="#ef4444" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="footer-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '10px', color: query.length > (MAX_CHARS * 0.9) ? '#ff4d4d' : 'rgba(220, 38, 38, 0.4)', fontWeight: 600 }}>
          {query.length} / {MAX_CHARS}
        </div>

        {/* Stop button: shown when AI is generating */}
        {(isThinking || isBusy) ? (
          <button
            className="action-btn stop-btn"
            onClick={onCancel}
            title="Parar geração"
            style={{ backgroundColor: 'rgba(220, 38, 38, 0.15)', color: '#dc2626', borderRadius: '50%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (query.trim().length > 0 || attachedImage) && !isRecording && !isTranscribing ? (
          <button 
            className="action-btn send-btn" 
            onClick={handleSend}
            style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#dc2626', borderRadius: '50%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}
          >
            <Send size={16} />
          </button>
        ) : (
          <button 
            className={`action-btn mic-btn ${isRecording ? 'recording' : ''} ${isTranscribing ? 'transcribing' : ''}`} 
            onClick={handleToggleRecord}
            disabled={isTranscribing}
            title={isRecording ? "Parar e enviar" : "Gravar áudio"}
            style={{ 
              backgroundColor: isRecording ? '#dc2626' : 'rgba(255,255,255,0.05)', 
              color: isRecording ? '#fff' : '#dc2626', 
              borderRadius: '50%', 
              padding: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer',
              animation: micAnimation
            }}
          >
            {isRecording ? <Send size={16} /> : <Mic size={16} />}
          </button>
        )}
      </div>
    </div>
  </div>
);
};
