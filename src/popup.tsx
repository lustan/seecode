
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Fix: Declare chrome global for the browser to avoid TypeScript compilation errors
declare const chrome: any;

function openInNewTab() {
  chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
  window.close(); // 关闭 popup
}

function PopupRoot() {
  return (
    <div style={{ 
      width: '100%', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #2b2b2b 0%, #1e1e1e 100%)',
      fontFamily: '"JetBrains Mono", "Consolas", "Monaco", "Courier New", monospace',
      overflow: 'hidden',
      position: 'relative',
      color: '#a9b7c6'
    }}>
      {/* 主内容区域 - 占满全部空间 */}
      <div style={{ 
        flex: 1, 
        minHeight: 0, 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden', // 防止外部滚动条
        position: 'relative'
      }}>
        <App isPopup={true} />
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupRoot />
  </React.StrictMode>
);
