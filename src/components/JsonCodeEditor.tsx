import React, { useRef, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';

export default function JsonCodeEditor({ value, onChange }) {
  const editorRef = useRef<any>(null);
  const [wrap, setWrap] = useState(true);

  // 支持 Ctrl+J 格式化
  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyJ, () => {
      editor.getAction('editor.action.formatDocument').run();
    });
  }

  // 复制内容
  const handleCopy = () => {
    if (editorRef.current) {
      const text = editorRef.current.getValue();
      navigator.clipboard.writeText(text);
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#2b2b2b' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'flex-end', 
        alignItems: 'center', 
        padding: '12px 16px', 
        gap: 8,
        background: '#3c3f41',
        borderBottom: '1px solid #515658'
      }}>
        <button
          onClick={handleCopy}
          style={{ 
            fontSize: 12, 
            padding: '6px 12px', 
            borderRadius: 4, 
            border: '1px solid #515658', 
            background: '#629755', 
            color: '#fff', 
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#73a866'}
          onMouseOut={e => e.currentTarget.style.background = '#629755'}
        >
          📋 复制
        </button>
        <button
          onClick={() => setWrap(w => !w)}
          style={{ 
            fontSize: 12, 
            padding: '6px 12px', 
            borderRadius: 4, 
            border: '1px solid #515658', 
            background: '#3c3f41', 
            color: '#a9b7c6', 
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={e => e.currentTarget.style.background = '#515658'}
          onMouseOut={e => e.currentTarget.style.background = '#3c3f41'}
        >
          {wrap ? '📄 换行' : '📃 不换行'}
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, background: '#2b2b2b' }}>
        <MonacoEditor
          height="100%"
          defaultLanguage="json"
          value={value}
          onChange={v => onChange(v ?? '')}
          theme="vs-dark"
          options={{
            fontSize: 13,
            fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
            lineHeight: 20,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: wrap ? 'on' : 'off',
            folding: true,
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            smoothScrolling: true,
            formatOnPaste: true,
            formatOnType: true,
            automaticLayout: true,
          }}
          onMount={handleEditorDidMount}
        />
      </div>
    </div>
  );
} 