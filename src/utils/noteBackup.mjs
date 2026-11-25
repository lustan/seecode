/**
 * Pure utilities for note/folder backup export/import, sidebar search filtering,
 * and deterministic sample diff workspace creation.
 */

export function exportBackupPayload(notes, folders, version = '4.1.0') {
  return JSON.stringify(
    {
      app: 'DiffPad',
      version,
      exportedAt: new Date().toISOString(),
      folders: Array.isArray(folders) ? folders : [],
      notes: Array.isArray(notes) ? notes : []
    },
    null,
    2
  );
}

export function parseBackupPayload(rawText) {
  const parsed = JSON.parse(rawText);
  const rawNotes = Array.isArray(parsed) ? parsed : parsed?.notes;
  const rawFolders = Array.isArray(parsed) ? [] : (parsed?.folders ?? []);

  if (!Array.isArray(rawNotes) || !Array.isArray(rawFolders)) {
    throw new Error('Invalid backup structure');
  }

  const folders = rawFolders
    .filter(f => f && typeof f === 'object' && typeof f.id === 'string' && typeof f.name === 'string')
    .map(f => ({
      id: f.id,
      name: f.name,
      expanded: f.expanded !== false
    }));

  const folderIds = new Set(folders.map(f => f.id));

  const notes = rawNotes
    .filter(n => n && typeof n === 'object' && typeof n.title === 'string' && typeof n.content === 'string')
    .map((n, index) => ({
      id: typeof n.id === 'string' && n.id ? n.id : `imported-${Date.now()}-${index}`,
      title: n.title || 'Untitled',
      content: n.content,
      language: typeof n.language === 'string' ? n.language : undefined,
      folderId: typeof n.folderId === 'string' && folderIds.has(n.folderId) ? n.folderId : undefined
    }));

  return { notes, folders };
}

export function filterNotesAndFolders(notes, folders, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    return {
      notes,
      folders,
      matchedNoteIds: new Set(notes.map(n => n.id)),
      isFiltering: false
    };
  }

  const matchedNotes = notes.filter(
    n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
  );
  const matchedNoteIds = new Set(matchedNotes.map(n => n.id));
  const foldersWithMatches = new Set(matchedNotes.map(n => n.folderId).filter(Boolean));

  const filteredFolders = folders.filter(
    f => f.name.toLowerCase().includes(q) || foldersWithMatches.has(f.id)
  );

  return {
    notes: matchedNotes,
    folders: filteredFolders,
    matchedNoteIds,
    isFiltering: true
  };
}

export function getSampleWorkspace(baseTimestamp = Date.now()) {
  const before = {
    id: `${baseTimestamp}-sample-before`,
    title: 'API v1 Response.json',
    language: 'json',
    content: JSON.stringify(
      {
        service: 'billing-api',
        version: '1.4.0',
        status: 'ok',
        rateLimit: {
          requestsPerMinute: 120,
          burst: 20
        },
        features: ['invoices', 'webhooks'],
        maintainers: [
          { name: 'Alice', role: 'owner' },
          { name: 'Bob', role: 'reviewer' }
        ]
      },
      null,
      2
    )
  };

  const after = {
    id: `${baseTimestamp}-sample-after`,
    title: 'API v2 Response.json',
    language: 'json',
    content: JSON.stringify(
      {
        service: 'billing-api',
        version: '2.0.0',
        status: 'ok',
        rateLimit: {
          requestsPerMinute: 300,
          burst: 50,
          retryAfterSeconds: 15
        },
        features: ['invoices', 'webhooks', 'usage-alerts'],
        maintainers: [
          { name: 'Alice', role: 'owner' },
          { name: 'Charlie', role: 'maintainer' }
        ]
      },
      null,
      2
    )
  };

  return [before, after];
}
