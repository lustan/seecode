
# Seecode 🚀

> **v4.0.0** — Code editor & file diff Chrome extension.

Seecode is a high-performance, feature-rich Chrome extension designed for developers who need a reliable, JSON formatting, multi-language note-taking, and **side-by-side file/note comparison**.

![Logo](public/icon.svg)

---

## 🆕 What's New in v4.0.0

### 🔍 IDEA-Style File Compare (Highlight Feature)
Seecode now ships with a full-featured **two-pane diff viewer** inspired by JetBrains IDEA's "Compare Files" tool — perfect for diffing JSON payloads, code snippets, or any two notes side-by-side without leaving the browser.

* **🪞 Dual editable panes** — both sides are live textareas. Type, paste, or pick any existing note from the file chip. Edits update the diff in real time.
* **🧬 LCS-based line diff** — accurate longest-common-subsequence algorithm groups changes into IDEA-style **hunks** (`add`, `remove`, `modify`).
* **🎨 Color-coded gutters & line bands**
  * 🟥 **Red** — lines removed from the left
  * 🟩 **Green** — lines added on the right
  * 🟨 **Yellow** — lines modified
* **📏 Anchored scroll sync** — scrolling either pane keeps the corresponding hunk aligned on the other side via piecewise-linear line mapping, with snap-to-edge behavior at the top/bottom.
* **🧭 Hunk navigation**
  * `F7` — jump to the **next** difference
  * `Shift + F7` — jump to the **previous** difference
  * Click any ribbon to jump directly to that hunk; the caret auto-positions on the right pane so you can start editing immediately.
* **📊 Live stats chips** in the header: `−removed`  `~modified`  `+added`.
* **🔄 Swap sides** with one click — flip left/right to reverse the diff direction.
* **📂 File picker** — search through all your notes by title or content and load either side from the spotlight-style picker (`Esc` to dismiss).
* **🧹 Per-side toolbar** — `Format JSON`, `Copy`, and `Clear` actions on each pane independently, with inline error feedback when JSON is invalid.
* **🌓 Theme-aware** — full dark & light palettes matching the rest of the editor.

> Open the diff viewer from the editor toolbar to compare the current note against any other note — or against a fresh blank scratch buffer.

---

## ✨ Key Features

### 🔍 File Compare *(new in 4.0)*
* **Two-pane diff viewer** with LCS line diff, SVG connector ribbon, and scroll sync.
* **Editable on both sides** — diff updates live as you type.
* **Hunk navigation** with `F7` / `Shift+F7` and click-to-jump on the ribbon.
* **Format / Copy / Clear** per side; **Swap sides** with one click.

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
* **Keyboard First**: Comprehensive shortcuts for formatting, line duplication, navigation, and diff hunks.
* **Themeable**: Switch between IDEA Dark and GitHub Light themes.

---

## 📸 Screenshots

> [!TIP]
> Add your extension screenshots here to showcase the UI.

### Main Editor View
<img width="753" height="750" alt="image" src="https://github.com/user-attachments/assets/7bac4be5-3ef1-4f7c-b8f2-9ed7264c51a5" />

<img width="1903" height="877" alt="image" src="https://github.com/user-attachments/assets/8f393a16-3a23-4310-bbba-6bbd92b67a72" />

<img width="1903" height="865" alt="image" src="https://github.com/user-attachments/assets/56eb023f-7b71-4cda-96cd-7ae78da53ad5" />


### File Compare View *(new in 4.0)*
> Add a screenshot of the diff viewer here — two panes, ribbon, and the `−/~/+` stats chips in the header.

---

## ⌨️ Keyboard Shortcuts

### Editor
| Shortcut | Action |
| --- | --- |
| `Ctrl + J` | Format Code (JSON/JS) |
| `Ctrl + K` | Compress JSON |
| `Ctrl + F` | Toggle Search |
| `Ctrl + R` | Toggle Replace |
| `Ctrl + D` | Duplicate Current Line |
| `Ctrl + Y` | Delete Current Line |
| `Esc` | Close Search/Panels |

### File Compare *(new in 4.0)*
| Shortcut | Action |
| --- | --- |
| `F7` | Next difference (hunk) |
| `Shift + F7` | Previous difference (hunk) |
| `Esc` | Close picker / close diff viewer |

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
