import React, { useState, useMemo } from "react";
import { Editor } from "../components/Editor";
import { NoteItem } from "../utils/exportUtils";
import { slugify } from "../utils/wikilink";
import { nostrService } from "../nostr";

/**
 * NoteEditorContainer: editor tarafının state'leri + render'ı.
 *
 * İşlem logic'leri (handleSaveNote, handleDeleteNote) App.tsx içinde kalır
 * ve buraya prop olarak geçer — container sadece state yönetimi + render.
 */
interface NoteEditorContainerProps {
  notes: Map<string, NoteItem>;
  noteHistory: Map<string, NoteItem[]>;
  currentUserPubkey: string;
  onSaveNote: (e: React.FormEvent) => Promise<void>;
  onDeleteNote: (slug: string) => Promise<void>;
  onExportNote: () => void;
  onNavigatePreview: (slug: string) => void;
  onShowVersionModalChange: (v: boolean) => void;
}

export function NoteEditorContainer({
  notes,
  noteHistory,
  currentUserPubkey,
  onSaveNote,
  onDeleteNote,
  onExportNote,
  onNavigatePreview,
  onShowVersionModalChange,
}: NoteEditorContainerProps) {
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [previewMode] = useState<"edit" | "preview" | "split">("edit");

  /**
   * currentSlugVersions: verilen slug için noteHistory + notes'tan versiyon listesi.
   * normalizedSlug (slugify) ile lookups.
   */
  const currentSlugVersions = useMemo(() => {
    const normalizedSlug = slugify(slug);
    return (
      noteHistory.get(normalizedSlug) ||
      (notes.get(normalizedSlug) ? [notes.get(normalizedSlug)!] : [])
    );
  }, [slug, notes, noteHistory]);

  const userSecretKey = nostrService.getSecretKey();
  const currentNote = notes.get(slugify(slug));
  const canDelete = !!(currentNote && currentNote.pubkey && currentNote.pubkey === currentUserPubkey);

  return (
    <div>
      <Editor
        notes={notes}
        currentContent={content}
        currentSlug={slug}
        onContentChange={setContent}
        onSlugChange={setSlug}
        previewMode={previewMode}
        isPrivate={isPrivate}
        onIsPrivateChange={setIsPrivate}
        onShowVersionModalChange={onShowVersionModalChange}
        currentSlugVersions={currentSlugVersions}
        userSecretKey={userSecretKey}
        onSave={onSaveNote}
        onDeleteNote={onDeleteNote}
        onExportNote={onExportNote}
        onNavigatePreview={onNavigatePreview}
        canDelete={canDelete}
      />
    </div>
  );
}
