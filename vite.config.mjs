
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        // Fix: Use resolve without explicit process.cwd() as path.resolve defaults to current working directory
        main: resolve('index.html'),
        editor: resolve('editor.html'),
        popup: resolve('popup.html'),
        sticky: resolve('sticky.html'), // 新增便签页面
      }
    },
    outDir: 'dist',
    emptyOutDir: true,
  }
});
