const PENDING_IMPORT_KEY = 'seecode_pending_import';

function registerContextMenus() {
  if (!chrome.contextMenus) return;
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'diffpad-send-selection',
      title: 'Send selection to DiffPad',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'diffpad-compare-selection',
      title: 'Compare selection in DiffPad',
      contexts: ['selection']
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenus();
});

chrome.contextMenus?.onClicked.addListener((info) => {
  const text = info.selectionText;
  if (!text) return;
  const compare = info.menuItemId === 'diffpad-compare-selection';
  chrome.storage.local.set({
    [PENDING_IMPORT_KEY]: {
      text,
      compare,
      createdAt: Date.now()
    }
  }, () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL(`editor.html${compare ? '?compare=1' : ''}`)
    });
  });
});

chrome.commands?.onCommand.addListener((command) => {
  if (command === 'open-full-editor') {
    chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') });
  }
});