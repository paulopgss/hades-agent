import React from 'react';
import { ChevronRight, ChevronLeft, Sparkles, Trash2, Plus, Check } from 'lucide-react';
import { Persona, MenuView } from '../../types';
import { electronService } from '../../services/electron';
import { TRANSLATION_LANGUAGES } from '../../constants';

interface SusurroMenuProps {
  menuView: MenuView;
  setMenuView: (view: MenuView) => void;
  targetLanguage: string;
  targetLanguageLabel: string;
  setTargetLanguage: (lang: string) => void;
  setTargetLanguageLabel: (label: string) => void;
  isSuggestionsEnabled: boolean;
  setIsSuggestionsEnabled: (enabled: boolean) => void;
  selectedPersona: Persona | null;
  setSelectedPersona: (persona: Persona | null) => void;
  personas: Persona[];
  isCreatingPersona: boolean;
  setIsCreatingPersona: (creating: boolean) => void;
  newPersonaName: string;
  setNewPersonaName: (name: string) => void;
  newPersonaPrompt: string;
  setNewPersonaPrompt: (prompt: string) => void;
  handleSavePersona: () => void;
  handleDeletePersona: (id: string) => void;
}

export const SusurroMenu = ({
  menuView,
  setMenuView,
  targetLanguage,
  targetLanguageLabel,
  setTargetLanguage,
  setTargetLanguageLabel,
  isSuggestionsEnabled,
  setIsSuggestionsEnabled,
  selectedPersona,
  setSelectedPersona,
  personas,
  isCreatingPersona,
  setIsCreatingPersona,
  newPersonaName,
  setNewPersonaName,
  newPersonaPrompt,
  setNewPersonaPrompt,
  handleSavePersona,
  handleDeletePersona,
}: SusurroMenuProps) => {


  if (menuView === 'main') {
    return (
      <div className="settings-menu open">
        <div className="menu-header">Susurro Settings</div>
        <button className="menu-item" onClick={() => setMenuView('personas')}>
          <span>Personas</span>
          <ChevronRight size={14} />
        </button>
        <button className="menu-item" onClick={() => setMenuView('language')}>
          <span>Idioma de Tradução: {targetLanguageLabel}</span>
          <ChevronRight size={14} />
        </button>
        <div 
          className="menu-item suggestions-menu-toggle"
          onClick={() => setIsSuggestionsEnabled(!isSuggestionsEnabled)}
          style={{ cursor: 'pointer' }}
        >
          <div className="menu-item-left">
            <Sparkles size={14} className={isSuggestionsEnabled ? 'active-sparkle' : ''} />
            <span>Sugestões de IA</span>
          </div>
          <label className="switch-wrapper" style={{ pointerEvents: 'none' }}>
            <input type="checkbox" checked={isSuggestionsEnabled} readOnly
              aria-label="Ativar sugestões de IA"
            />
            <span className="switch-slider"></span>
          </label>
        </div>
        <div className="menu-divider" />
      </div>
    );
  }

  if (menuView === 'language') {
    return (
      <div className="settings-menu open">
        <button className="back-header" onClick={() => setMenuView('main')}>
          <ChevronLeft size={14} /> <span>Idioma</span>
        </button>
        <div className="language-list">
          {TRANSLATION_LANGUAGES.map(lang => (
            <button
              key={lang.code}
              className={`menu-item ${targetLanguage === lang.code ? 'active' : ''}`}
              onClick={() => {
                setTargetLanguage(lang.code);
                setTargetLanguageLabel(lang.label);
                setMenuView('main');
              }}
            >
              <span>{lang.label}</span>
              {targetLanguage === lang.code && <Check size={14} />}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (menuView === 'personas') {
    return (
      <div className="settings-menu personas-menu open">
        <button className="back-header" onClick={() => setMenuView('main')}>
          <ChevronLeft size={14} /> <span>Personas</span>
        </button>
        {isCreatingPersona ? (
          <div className="persona-form">
            <input placeholder="Name" value={newPersonaName} onChange={e => setNewPersonaName(e.target.value)} />
            <textarea placeholder="System Prompt" value={newPersonaPrompt} onChange={e => setNewPersonaPrompt(e.target.value)} />
            <div className="form-actions">
              <button onClick={() => setIsCreatingPersona(false)}>Cancel</button>
              <button className="primary" onClick={handleSavePersona}>Save</button>
            </div>
          </div>
        ) : (
          <>
            <div className="persona-list">
              {personas.map(p => (
                <div key={p.id} className={`persona-item ${selectedPersona?.id === p.id ? 'active' : ''}`}>
                  <button className="persona-select-btn" onClick={() => setSelectedPersona(p)}>{p.name}</button>
                  <button className="persona-delete-btn" onClick={() => handleDeletePersona(p.id)}><Trash2 size={12} /></button>
                </div>
              ))}
            </div>
            <button className="add-persona-btn" onClick={() => setIsCreatingPersona(true)}>
              <Plus size={14} /> New Persona
            </button>
          </>
        )}
      </div>
    );
  }

  return null;
};
