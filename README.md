
# Seecode 🚀

Seecode is a high-performance, feature-rich Chrome extension designed for developers who need a reliable, JetBrains IDEA-inspired environment for quick code snippets, JSON formatting, and multi-language note-taking.

![Logo](public/icon.svg)

## ✨ Key Features

### 🖥️ JetBrains IDEA Inspired UI
* **Visual Fidelity**: A professional dark environment that mimics the look and feel of your favorite IDE.
* **Smart Diagnostics**: Built-in JSON linter with IDEA-style wavy red underlines and gutter indicators.

### 📝 Intelligent Note Management
* **Multi-Language Support**: Seamlessly switch between JSON, JavaScript, Java, Python, SQL, and Markdown.
* **Auto-Detection**: Smart logic that identifies your code language as you type.
* **Drag & Drop Reordering**: Organize your snippets with an intuitive sidebar.

### 🛠️ Advanced Editor Tools
* **Specialized JSON Tools**: One-click Format (automatic repair of common syntax errors) and Compact/Compress modes.
* **Floating Sticky Notes**: Drag any note out into a standalone, always-on-top window for reference while you code.
* **Pro Search & Replace**: Full-featured search bar with regex and case-sensitivity support (Ctrl+F / Ctrl+R).

### ⚡ Performance & UX
* **Blazing Fast**: Optimized with CodeMirror 6 for large file handling.
* **Keyboard First**: Comprehensive shortcuts for formatting, line duplication, and navigation.
* **Themeable**: Switch between IDEA Dark and GitHub Light themes.

---

## 📸 Screenshots

> [!TIP]
> Add your extension screenshots here to showcase the UI.

### Main Editor View
<img width="902" height="911" alt="image" src="https://github.com/user-attachments/assets/9eceb410-c8f7-48eb-9c5c-3592014ba641" />

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl + J` | Format Code (JSON/JS) |
| `Ctrl + K` | Compress JSON |
| `Ctrl + F` | Toggle Search |
| `Ctrl + R` | Toggle Replace |
| `Ctrl + D` | Duplicate Current Line |
| `Ctrl + Y` | Delete Current Line |
| `Esc` | Close Search/Panels |

---

## 🚀 Installation

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the project directory.

---

## 🛠️ Development

This project is built with:
* **React 19**
* **TypeScript**
* **Vite**
* **CodeMirror 6**
* **Tailwind CSS**

To run in development mode:
```bash
npm install
npm run dev
```

To build for production:
```bash
npm run build
```

---

## 📄 License
This project is licensed under the MIT License.
