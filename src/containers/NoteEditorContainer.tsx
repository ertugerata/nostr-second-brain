import React, { useState, useMemo } from "react";
import { Editor } from "./Editor";
import { NoteItem } from "../utils/exportUtils";
import { slugify } from "../utils/wikilink";

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
  const [previewMode, setPreviewMode] = useState<"edit" | "preview" | "split">("edit");
  const [showVersionModal, setShowVersionModal] = useState(false);

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

  return (
    <div>
      <Editor
        notes={notes}
        currentContent={content}
        currentSlug={slug}
        onContentChange={setContent}
        onSlugChange={setSlug}
        previewMode={previewMode}
        onPreviewModeChange={setPreviewMode}
        isPrivate={isPrivate}
        onIsPrivateChange={setIsPrivate}
        showVersionModal={showVersionModal}
        onShowVersionModalChange={setShowVersionModal}
        currentSlugVersions={currentSlugVersions}
        currentUserPubkey={currentUserPubkey}
        onSave={onSaveNote}
        onDeleteNote={onDeleteNote}
        onExportNote={onExportNote}
        onNavigatePreview={onNavigatePreview}
        canDelete={false}
      />
      {/* VersionHistoryModal: modal açma/kapama state'i burada yönetilir,
          modal kısmı halihazırda App.tsx'te render edilmektedir — progressive
          migration için container'a eklenebilir. */}
    </div>
  );
}
