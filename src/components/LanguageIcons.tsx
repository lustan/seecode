
import React from 'react';
import { SupportedLanguage, detectLanguage } from '../utils/languageDetector';

interface Props {
  language?: SupportedLanguage;
  content?: string;
  size?: number;
}

export const LanguageIcon: React.FC<Props> = ({ language, content, size = 16 }) => {
  const effectiveLanguage = language || (content ? detectLanguage(content) : 'plaintext');

  const getIcon = () => {
    switch (effectiveLanguage) {
      case 'json':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2"></path>
            <path d="M18 21a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2"></path>
          </svg>
        );
      case 'javascript':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#facc15" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m10 16-4-4 4-4"></path>
            <path d="m14 8 4 4-4 4"></path>
          </svg>
        );
      case 'python':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 10V2"></path>
            <path d="M5 8h14"></path>
            <path d="M12 14v8"></path>
            <path d="M19 16H5"></path>
          </svg>
        );
      case 'java':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
            <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
            <line x1="6" y1="1" x2="6" y2="4"></line>
            <line x1="10" y1="1" x2="10" y2="4"></line>
          </svg>
        );
      case 'sql':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
          </svg>
        );
      case 'markdown':
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 12h6"></path>
            <path d="M15 6h6"></path>
            <path d="M15 18h6"></path>
            <path d="M3 6h8v12H3z"></path>
          </svg>
        );
      default:
        return (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        );
    }
  };

  return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{getIcon()}</div>;
};
