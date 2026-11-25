
import React from 'react';
import MultiLanguageEditor from './MultiLanguageEditor';
import { SupportedLanguage } from '../utils/languageDetector';
import type { Note } from '../App';

interface Props {
  value: string;
  onChange: (value: string) => void;
  isPopup?: boolean;
  theme?: 'dark' | 'light';
  fontSize?: number;
  language?: SupportedLanguage;
  onLanguageChange?: (lang: SupportedLanguage | 'auto') => void;
  allNotes?: Note[];
  activeNoteId?: string | null;
  activeNoteTitle?: string;
  onSaveNote?: (noteId: string, content: string) => void;
  onCreateNote?: (title: string, content: string, language?: SupportedLanguage) => string;
  showAlert?: (options: {
    type?: 'info' | 'warning' | 'error' | 'success';
    message: string;
    presentation?: 'modal' | 'toast';
    onConfirm?: () => void;
    confirmText?: string;
  }) => void;
}

export default function Editor({
  value,
  onChange,
  isPopup = false,
  theme = 'dark',
  fontSize = 13,
  language,
  onLanguageChange,
  allNotes,
  activeNoteId,
  activeNoteTitle,
  onSaveNote,
  onCreateNote,
  showAlert
}: Props) {
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}>
      <MultiLanguageEditor
        value={value}
        onChange={onChange}
        isPopup={isPopup}
        theme={theme}
        fontSize={fontSize}
        language={language}
        onLanguageChange={onLanguageChange}
        autoDetectLanguage={!language}
        allNotes={allNotes}
        activeNoteId={activeNoteId}
        activeNoteTitle={activeNoteTitle}
        onSaveNote={onSaveNote}
        onCreateNote={onCreateNote}
        showAlert={showAlert}
      />
    </div>
  );
}
