import { PencilEdit01Icon } from "hugeicons-react";
import { useEffect, useState } from "react";
import { ArtifactAttachmentPanelActions } from "@/components/chat/artifact-attachment-panel-actions";
import { ArtifactAttachmentPanelBody } from "@/components/chat/artifact-attachment-panel-body";
import {
  artifactCanTogglePreviewSource,
  artifactPanelBodyClassName,
  artifactPanelDefaultWidth,
  artifactPanelHeaderMeta,
  downloadActionLabel,
} from "@/components/chat/artifact-attachment-panel-body.shared";
import { ArtifactMarkdownEditor } from "@/components/chat/artifact-markdown-editor";
import {
  type ArtifactPreviewMode,
  ArtifactPreviewModeToggle,
} from "@/components/chat/artifact-preview-mode-toggle";
import {
  ArtifactShareMenuItem,
  ArtifactSharePublishDialogFromState,
} from "@/components/chat/artifact-share-controls";
import { ArtifactSpreadsheetEditor } from "@/components/chat/artifact-spreadsheet-editor";
import { useArtifactPreviewContent } from "@/components/chat/use-artifact-preview-content";
import {
  type ArtifactShareControlsState,
  useArtifactShareControls,
} from "@/components/chat/use-artifact-share-controls";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/use-auth";
import { useChatAttachmentPanel } from "@/context/use-chat-attachment-panel";
import { useWriteArtifactMutation } from "@/hooks/use-resource-mutations";
import {
  artifactCodeLanguage,
  buildArtifactContentUrl,
  type ChatArtifactRef,
  isDelimitedSpreadsheetFile,
  isDocxFile,
  isHtmlArtifactMimeType,
  isImageArtifactMimeType,
  isLegacyDocFile,
  isMarkdownArtifactMimeType,
  isTextArtifactMimeType,
  isUnknownArtifactMimeType,
  isVideoArtifactMimeType,
  resolveArtifactMimeType,
} from "@/lib/chat-artifacts";
import { client, formatError } from "@/lib/client";

type PanelKind = "image" | "video" | "html" | "spreadsheet" | "text";

function ArtifactAttachmentPreviewPanelBody({
  kind,
  textFormat,
  language,
  loading,
  error,
  content,
  imagePreviewUrl,
  videoPreviewUrl,
  canPreview,
  artifact,
  previewMode,
}: {
  kind: PanelKind;
  textFormat: "markdown" | "plain";
  language: string | null;
  loading: boolean;
  error: string | null;
  content: string | null;
  imagePreviewUrl: string | null;
  videoPreviewUrl: string | null;
  canPreview: boolean;
  artifact: ChatArtifactRef;
  previewMode: ArtifactPreviewMode;
}) {
  if (kind === "image") {
    return (
      <ArtifactAttachmentPanelBody
        artifact={artifact}
        canPreview={canPreview}
        error={error}
        imagePreviewUrl={imagePreviewUrl}
        kind="image"
        loading={loading}
      />
    );
  }

  if (kind === "video") {
    return (
      <ArtifactAttachmentPanelBody
        artifact={artifact}
        canPreview={canPreview}
        error={error}
        kind="video"
        loading={loading}
        videoPreviewUrl={videoPreviewUrl}
      />
    );
  }

  if (kind === "html") {
    return (
      <ArtifactAttachmentPanelBody
        artifact={artifact}
        canPreview={canPreview}
        content={content}
        error={error}
        kind="html"
        loading={loading}
        previewMode={previewMode}
      />
    );
  }

  if (kind === "spreadsheet") {
    return (
      <ArtifactAttachmentPanelBody
        artifact={artifact}
        canPreview={canPreview}
        content={content}
        error={error}
        kind="spreadsheet"
        loading={loading}
        previewMode={previewMode}
      />
    );
  }

  return (
    <ArtifactAttachmentPanelBody
      artifact={artifact}
      canPreview={canPreview}
      content={content}
      error={error}
      format={textFormat}
      kind="text"
      language={language}
      loading={loading}
      previewMode={previewMode}
    />
  );
}

function ArtifactAttachmentPreviewHeaderActions({
  artifactPath,
  canEdit,
  content,
  copied,
  copyDisabled,
  downloadLabel,
  downloadUrl,
  filename,
  fullscreen,
  loading,
  onCopy,
  onEdit,
  onToggleFullscreen,
  share,
}: {
  artifactPath: string;
  canEdit: boolean;
  content: string | null;
  copied: boolean;
  copyDisabled: boolean;
  downloadLabel: string;
  downloadUrl: string;
  filename: string;
  fullscreen: boolean;
  loading: boolean;
  onCopy: () => void;
  onEdit: () => void;
  onToggleFullscreen: () => void;
  share: ArtifactShareControlsState;
}) {
  return (
    <>
      <ArtifactAttachmentPanelActions
        additionalMenuItems={
          <>
            {canEdit ? (
              <DropdownMenuItem
                className="cursor-pointer"
                disabled={loading || content === null}
                onClick={onEdit}
              >
                <PencilEdit01Icon aria-hidden />
                Edit artifact
              </DropdownMenuItem>
            ) : null}
            <ArtifactShareMenuItem share={share} />
          </>
        }
        content={content}
        copied={copied}
        copyDisabled={copyDisabled}
        downloadLabel={downloadLabel}
        downloadUrl={downloadUrl}
        filename={filename}
        fullscreen={fullscreen}
        loading={loading}
        onCopy={onCopy}
        onToggleFullscreen={onToggleFullscreen}
      />
      <ArtifactSharePublishDialogFromState
        artifactPath={artifactPath}
        share={share}
      />
    </>
  );
}

async function copyArtifactContent({
  isImage,
  isVideo,
  isWordDocument,
  content,
  profileId,
  artifactPath,
  setContent,
  setCopied,
}: {
  isImage: boolean;
  isVideo: boolean;
  isWordDocument: boolean;
  content: string | null;
  profileId: string;
  artifactPath: string;
  setContent: (value: string) => void;
  setCopied: (value: boolean) => void;
}) {
  if (isImage || isVideo) {
    return;
  }

  try {
    let text = content;
    if (!text) {
      const result = await client.readProfileArtifactContent(
        profileId,
        artifactPath,
        {
          inline: true,
          render: isWordDocument ? "markdown" : undefined,
        }
      );
      text = new TextDecoder().decode(result.data);
      setContent(text);
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
  } catch {
    // Clipboard may be unavailable outside secure contexts.
  }
}

export function useArtifactAttachmentPreviewPanel({
  profileId,
  id,
  artifact,
}: {
  profileId: string;
  id: string;
  artifact: ChatArtifactRef;
}) {
  const { show, update, activeId } = useChatAttachmentPanel();
  const share = useArtifactShareControls({
    artifactPath: artifact.path,
    profileId,
  });
  const open = activeId === id;
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] =
    useState<ArtifactPreviewMode>("preview");
  const [draft, setDraft] = useState<string | null>(null);
  const [editingSpreadsheet, setEditingSpreadsheet] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { activeOrg } = useAuth();
  const writeArtifact = useWriteArtifactMutation();
  const downloadUrl = `${client.baseUrl}${buildArtifactContentUrl(profileId, artifact.path)}`;
  const mimeType = resolveArtifactMimeType(
    artifact.mimeType,
    artifact.filename
  );
  const isHtml = isHtmlArtifactMimeType(mimeType);
  const isImage = isImageArtifactMimeType(mimeType);
  const isVideo = isVideoArtifactMimeType(mimeType);
  const isWordDocument =
    isDocxFile(artifact.filename, mimeType) ||
    isLegacyDocFile(artifact.filename, mimeType);
  const isMarkdown = isMarkdownArtifactMimeType(mimeType) || isWordDocument;
  const isSpreadsheet = isDelimitedSpreadsheetFile(artifact.filename, mimeType);
  const showPreviewToggle = artifactCanTogglePreviewSource({
    isHtml,
    isMarkdown,
    isSpreadsheet,
  });
  const header = artifactPanelHeaderMeta({
    filename: artifact.filename,
    mimeType,
    showPreviewToggle,
    sizeBytes: artifact.sizeBytes,
  });
  const language = artifactCodeLanguage(artifact.filename);
  const canPreview =
    isHtml ||
    isImage ||
    isVideo ||
    isWordDocument ||
    isTextArtifactMimeType(mimeType) ||
    isUnknownArtifactMimeType(mimeType);
  const downloadLabel = downloadActionLabel(mimeType);
  const canEdit =
    ((isMarkdown && !isWordDocument) || isSpreadsheet) &&
    activeOrg?.role !== "viewer";
  const {
    loading,
    error,
    content,
    imagePreviewUrl,
    videoPreviewUrl,
    setContent,
  } = useArtifactPreviewContent({
    artifact,
    canPreview,
    isHtml,
    isImage,
    isVideo,
    isWordDocument,
    open,
    profileId,
  });

  useEffect(() => {
    if (!copied) {
      return;
    }

    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function saveDraft(nextContent: string = draft ?? "") {
    if (draft === null && !editingSpreadsheet) {
      return;
    }

    setSaveError(null);

    try {
      await writeArtifact.mutateAsync({
        artifactPath: artifact.path,
        content: nextContent,
        profileId,
      });
      setContent(nextContent);
      setDraft(null);
      setEditingSpreadsheet(false);
    } catch (mutationError) {
      setSaveError(formatError(mutationError));
    }
  }

  function buildPanelBody(
    loadingOverride?: boolean,
    mode: ArtifactPreviewMode = previewMode
  ) {
    if (editingSpreadsheet && content !== null) {
      return (
        <ArtifactSpreadsheetEditor
          busy={writeArtifact.isPending}
          content={content}
          error={saveError}
          filename={artifact.filename}
          onCancel={() => {
            setEditingSpreadsheet(false);
            setSaveError(null);
          }}
          onSave={(nextContent) => void saveDraft(nextContent)}
        />
      );
    }

    if (draft !== null) {
      return (
        <ArtifactMarkdownEditor
          busy={writeArtifact.isPending}
          draft={draft}
          error={saveError}
          onCancel={() => {
            setDraft(null);
            setSaveError(null);
          }}
          onChange={setDraft}
          onSave={() => void saveDraft()}
        />
      );
    }

    const panelKind: PanelKind = isImage
      ? "image"
      : isVideo
        ? "video"
        : isHtml
          ? "html"
          : isSpreadsheet
            ? "spreadsheet"
            : "text";

    return (
      <ArtifactAttachmentPreviewPanelBody
        artifact={artifact}
        canPreview={canPreview}
        content={content}
        error={error}
        imagePreviewUrl={imagePreviewUrl}
        kind={panelKind}
        language={language}
        loading={loadingOverride ?? loading}
        previewMode={mode}
        textFormat={isMarkdown ? "markdown" : "plain"}
        videoPreviewUrl={videoPreviewUrl}
      />
    );
  }

  function buildPanelConfig(mode: ArtifactPreviewMode = previewMode) {
    return {
      bodyClassName:
        draft === null && !editingSpreadsheet
          ? artifactPanelBodyClassName({
              isHtml,
              isImage,
              isMarkdown,
              isSpreadsheet,
              isVideo,
              previewMode: mode,
            })
          : "flex flex-col overflow-hidden p-0",
      content: buildPanelBody(undefined, mode),
      fullscreen,
      headerActions: (
        <ArtifactAttachmentPreviewHeaderActions
          artifactPath={artifact.path}
          canEdit={canEdit}
          content={content}
          copied={copied}
          copyDisabled={isImage || isVideo}
          downloadLabel={downloadLabel}
          downloadUrl={downloadUrl}
          filename={artifact.filename}
          fullscreen={fullscreen}
          loading={loading}
          onCopy={() =>
            void copyArtifactContent({
              artifactPath: artifact.path,
              content,
              isImage,
              isVideo,
              isWordDocument,
              profileId,
              setContent,
              setCopied,
            })
          }
          onEdit={() => {
            setSaveError(null);
            if (isSpreadsheet) {
              setEditingSpreadsheet(true);
              setDraft(null);
              return;
            }
            setEditingSpreadsheet(false);
            setDraft(content ?? "");
          }}
          onToggleFullscreen={() => setFullscreen((current) => !current)}
          share={share}
        />
      ),
      leading:
        showPreviewToggle && draft === null && !editingSpreadsheet ? (
          <ArtifactPreviewModeToggle mode={mode} onChange={setPreviewMode} />
        ) : null,
      resizable: !fullscreen,
      subtitle: header.subtitle,
      title: header.title,
      typeLabel: header.typeLabel,
    };
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    update(id, buildPanelConfig());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    update,
    id,
    artifact,
    fullscreen,
    isHtml,
    isImage,
    isVideo,
    isMarkdown,
    isSpreadsheet,
    language,
    mimeType,
    loading,
    error,
    content,
    imagePreviewUrl,
    videoPreviewUrl,
    canPreview,
    copied,
    downloadLabel,
    downloadUrl,
    share.busy,
    share.publishDialogOpen,
    previewMode,
    canEdit,
    draft,
    editingSpreadsheet,
    saveError,
    writeArtifact.isPending,
    showPreviewToggle,
    header.subtitle,
    header.title,
    header.typeLabel,
  ]);

  function openPanel() {
    setFullscreen(false);
    setCopied(false);
    setPreviewMode("preview");
    setDraft(null);
    setEditingSpreadsheet(false);
    setSaveError(null);
    show({
      ...buildPanelConfig("preview"),
      content: buildPanelBody(
        canPreview &&
          (isImage || isVideo
            ? (isImage ? imagePreviewUrl : videoPreviewUrl) === null
            : content === null) &&
          error === null,
        "preview"
      ),
      defaultWidth: artifactPanelDefaultWidth(artifact.filename, mimeType),
      fullscreen: false,
      id,
      onClose: () => {
        setFullscreen(false);
        setCopied(false);
        setPreviewMode("preview");
        setDraft(null);
        setEditingSpreadsheet(false);
        setSaveError(null);
      },
      resizable: true,
    });
  }

  return {
    imagePreviewUrl,
    isImage,
    isVideo,
    openPanel,
  };
}
