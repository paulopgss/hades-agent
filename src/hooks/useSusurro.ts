import { useState, useEffect, useRef, useCallback } from 'react';
import { SusurroMessage, MenuView } from '../types';
import { useWindowControl } from './useWindowControl';
import { useClipboard } from './useClipboard';
import { usePersonas } from './usePersonas';
import { useTranscription } from './useTranscription';
import { useTranslation } from './useTranslation';
import { electronService } from '../services/electron';

/**
 * Orchestrator hook for Susurro logic.
 * Manages state for messages, personas, translation, and UI controls.
 */
export const useSusurro = (isActive: boolean = true) => {
  // --- Core State ---
  const [messages, setMessages] = useState<SusurroMessage[]>([]);
  const [timer, setTimer] = useState(0);
  const [tokens, setTokens] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [menuView, setMenuView] = useState<MenuView>('main');
  const [isSuggestionsEnabled, setIsSuggestionsEnabled] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('pt');
  const [targetLanguageLabel, setTargetLanguageLabel] = useState('Português');
  const [inputVolume, setInputVolume] = useState(1);
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const [newPersonaName, setNewPersonaName] = useState('');
  const [newPersonaPrompt, setNewPersonaPrompt] = useState('');
  const [isGlobalTranslationEnabled, setIsGlobalTranslationEnabled] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [fontSize, setFontSize] = useState(14); // Default 14px
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => {
    return localStorage.getItem('current_susurro_session_id');
  });
  const [isLoaded, setIsLoaded] = useState(false);

  const [susurroPushToTalk, setSusurroPushToTalk] = useState(false);

  // --- Refs ---
  const chatEndRef = useRef<HTMLDivElement>(null);
  const isActiveRef = useRef(isActive);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // --- Sub-Hooks ---
  const { handleMinimize } = useWindowControl();
  const { copiedId, copyToClipboard } = useClipboard();
  const [isClosingSession, setIsClosingSession] = useState(false);
  
  const {
    personas,
    selectedPersona,
    setSelectedPersona,
    savePersona,
    deletePersona
  } = usePersonas();

  const { isTranscribing, isConnecting, startTranscriptionHades, stopTranscriptionHades, toggleTranscriptionHades, endTurnHades } = useTranscription(
    selectedPersona,
    isSuggestionsEnabled,
    isGlobalTranslationEnabled,
    setMessages,
    setTokens,
    inputVolume
  );

  useTranslation(messages, setMessages, targetLanguage, isTranscribing);

  const isPushToTalkRef = useRef(susurroPushToTalk);
  useEffect(() => {
    isPushToTalkRef.current = susurroPushToTalk;
  }, [susurroPushToTalk]);

  // --- Effects ---
  useEffect(() => {
    const loadTokens = async () => {
      const t = await electronService.getTotalTokens();
      if (typeof t === 'number') setTokens(t);
    };
    loadTokens();

    const initSession = async () => {
      try {
        const storedId = localStorage.getItem('current_susurro_session_id');
        if (storedId) {
          const activeHistory = await electronService.getSusurroHistory();
          if (activeHistory && activeHistory.length > 0) {
            setMessages(activeHistory);
          }
        }
      } catch (err) {
        console.error('Failed to load session:', err);
      } finally {
        setIsLoaded(true);
      }
    };
    initSession();

    electronService.getSettings().then(settings => {
      if (settings?.audio?.micVolume !== undefined) {
        setInputVolume(settings.audio.micVolume / 100);
      }
      if (settings?.general?.susurroPushToTalk !== undefined) {
        setSusurroPushToTalk(settings.general.susurroPushToTalk);
      }
    });

    const timerInterval = setInterval(() => setTimer(prev => prev + 1), 1000);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActiveRef.current) return;
      
      if (e.key === 'Escape') {
        electronService.closeWindow();
      }
      if (e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        (document.activeElement as HTMLElement)?.blur();
        if (isPushToTalkRef.current) {
          if (!isTranscribing && !isConnecting) {
             startTranscriptionHades();
          }
        } else {
          toggleTranscriptionHades(); // Toggle mode
        }
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      if (!isActiveRef.current) return;
      if (e.key === ' ') {
        if (!isPushToTalkRef.current) return; // Only do this in push to talk
        e.preventDefault();
        e.stopPropagation();
        // In push-to-talk mode, release stops the full session (not just the turn)
        stopTranscriptionHades();
      }
    };

    globalThis.addEventListener('keydown', handleKeyDown);
    globalThis.addEventListener('keyup', handleKeyUp);

    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown);
      globalThis.removeEventListener('keyup', handleKeyUp);
      clearInterval(timerInterval);
    };
  }, [isTranscribing, isConnecting, startTranscriptionHades, stopTranscriptionHades, toggleTranscriptionHades, endTurnHades]);

  // Listen for live settings updates from the main process
  useEffect(() => {
    const unsubscribe = electronService.onSettingsUpdated((settings) => {
      if (settings?.audio?.micVolume !== undefined) {
        setInputVolume(settings.audio.micVolume / 100);
      }
      if (settings?.general?.susurroPushToTalk !== undefined) {
        setSusurroPushToTalk(settings.general.susurroPushToTalk);
      }
    });
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (autoScroll) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    // Save messages whenever they change, so end-session has access to the current history
    // Only save if loaded to prevent overwriting with initial empty array
    if (isLoaded) {
      electronService.saveSusurroHistory(messages);
    }
  }, [messages, autoScroll, isLoaded]);

  useEffect(() => {
    document.documentElement.style.setProperty('--susurro-base-font-size', `${fontSize}px`);
  }, [fontSize]);

  // --- Handlers ---
  const handleToggleGlobalTranslation = useCallback(() => {
    const nextState = !isGlobalTranslationEnabled;
    setIsGlobalTranslationEnabled(nextState);
    setMessages(curr => curr.map(m => ({ ...m, isTranslated: nextState, isTranslating: false })));
  }, [isGlobalTranslationEnabled]);

  const handleToggleMessageTranslation = useCallback((msgId: string) => {
    setMessages(curr => curr.map(m =>
      m.id === msgId ? { ...m, isTranslated: !m.isTranslated, isTranslating: false } : m
    ));
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
  }, []);

  const onSavePersona = useCallback(async () => {
    if (!newPersonaName || !newPersonaPrompt) return;
    const persona = await savePersona(newPersonaName, newPersonaPrompt);
    if (persona) {
      setIsCreatingPersona(false);
      setNewPersonaName('');
      setNewPersonaPrompt('');
    }
  }, [newPersonaName, newPersonaPrompt, savePersona]);

  const handleCloseSession = useCallback(async () => {
    try {
      setIsClosingSession(true);
      await electronService.endSession('susurro');
    } catch {
      // Archiving failed, still clear local state
    } finally {
      setMessages([]);
      setTimer(0);
      setCurrentSessionId(null);
      localStorage.removeItem('current_susurro_session_id');
      setIsClosingSession(false);
    }
  }, []);

  return {
    // State
    messages,
    timer,
    tokens,
    isSettingsOpen, setIsSettingsOpen,
    menuView, setMenuView,
    isSuggestionsEnabled, setIsSuggestionsEnabled,
    personas,
    selectedPersona, setSelectedPersona,
    targetLanguage, setTargetLanguage,
    targetLanguageLabel, setTargetLanguageLabel,
    inputVolume, setInputVolume,
    isCreatingPersona, setIsCreatingPersona,
    newPersonaName, setNewPersonaName,
    newPersonaPrompt, setNewPersonaPrompt,
    isGlobalTranslationEnabled,
    autoScroll, setAutoScroll,

    // Window/UI
    handleMinimize,
    copiedId, copyToClipboard,
    chatEndRef,
    handleScroll,

    // Transcription
    isTranscribing, isConnecting, startTranscriptionHades, stopTranscriptionHades, toggleTranscriptionHades, endTurnHades,

    // Handlers
    handleToggleGlobalTranslation,
    handleToggleMessageTranslation,
    handleSavePersona: onSavePersona,
    handleDeletePersona: deletePersona,

    // Font Size
    fontSize,
    increaseFontSize: () => setFontSize(prev => Math.min(prev + 1, 24)),
    decreaseFontSize: () => setFontSize(prev => Math.max(prev - 1, 10)),
    onCloseSession: handleCloseSession,
    currentSessionId,
    setCurrentSessionId,
    isClosingSession,
    susurroPushToTalk
  };
};
