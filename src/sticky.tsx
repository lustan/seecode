import React from 'react';
import { createRoot } from 'react-dom/client';
import StickyNote from './components/StickyNote';
import { I18nProvider } from './i18n';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<I18nProvider><StickyNote /></I18nProvider>);
}
