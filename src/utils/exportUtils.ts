export interface NoteItem {
  id: string;
  slug: string;
  content: string;
  createdAt: number;
  pubkey: string;
}

/**
 * Single note export as .md file download
 */
export function exportNoteAsMarkdown(note: NoteItem) {
  const blob = new Blob([note.content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${note.slug || "note"}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export all notes as JSON file download
 */
export function exportAllNotesAsJson(notes: Map<string, NoteItem>) {
  const notesArray = Array.from(notes.values());
  const jsonString = JSON.stringify(notesArray, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nostr-brain-notes-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
