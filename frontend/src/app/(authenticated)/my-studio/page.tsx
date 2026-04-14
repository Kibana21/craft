"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import InputBase from "@mui/material/InputBase";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import {
  deleteImage,
  listImages,
  staticStudioUrl,
  uploadImages,
} from "@/lib/api/studio";
import {
  STUDIO_IMAGE_TYPE_COLOR,
  STUDIO_IMAGE_TYPE_LABEL,
  type StudioImage,
  type StudioImageType,
} from "@/types/studio";

// ── Config ────────────────────────────────────────────────────────────────────

const PER_PAGE = 24;
const MAX_UPLOAD = 20;

type FilterTab = "ALL" | StudioImageType;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PHOTO", label: "Photos" },
  { key: "AI_GENERATED", label: "AI Generated" },
  { key: "ENHANCED", label: "Enhanced" },
  { key: "POSTER_EXPORT", label: "Poster exports" },
];

// ── Type pill ─────────────────────────────────────────────────────────────────

function TypePill({ type }: { type: StudioImageType }) {
  const c = STUDIO_IMAGE_TYPE_COLOR[type];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        px: 1,
        py: 0.25,
        borderRadius: 9999,
        bgcolor: c.bg,
        color: c.fg,
        fontSize: "10px",
        fontWeight: 700,
        letterSpacing: "0.02em",
      }}
    >
      {STUDIO_IMAGE_TYPE_LABEL[type]}
    </Box>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyStudioPage() {
  const router = useRouter();

  const [images, setImages] = useState<StudioImage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [imageToDelete, setImageToDelete] = useState<StudioImage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragOver, setIsDragOver] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const hasSelection = selected.size > 0;

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listImages({
        type: filter === "ALL" ? undefined : filter,
        q: searchQuery || undefined,
        page,
        per_page: PER_PAGE,
      });
      setImages(res.items);
      setTotal(res.total);
    } catch {
      setImages([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [filter, searchQuery, page]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Debounce the search input 300ms before it triggers a fetch.
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchDraft !== searchQuery) {
        setPage(1);
        setSearchQuery(searchDraft);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchDraft, searchQuery]);

  // ── Upload ──────────────────────────────────────────────────────────────────

  const runUpload = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files).slice(0, MAX_UPLOAD);
      if (arr.length === 0) return;
      setIsUploading(true);
      setUploadError(null);
      try {
        await uploadImages(arr);
        setToast(`Uploaded ${arr.length} image${arr.length > 1 ? "s" : ""}`);
        // Jump to page 1 so the new uploads are visible immediately.
        setPage(1);
        setFilter("ALL");
        refresh();
      } catch (err: unknown) {
        const e = err as { detail?: unknown; status?: number };
        const detail =
          typeof e.detail === "object" && e.detail !== null
            ? (e.detail as { detail?: string }).detail
            : typeof e.detail === "string"
              ? e.detail
              : null;
        setUploadError(detail ?? "Upload failed. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [refresh],
  );

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) runUpload(e.target.files);
    e.target.value = ""; // reset so re-picking the same file triggers onChange
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) runUpload(e.dataTransfer.files);
  };

  // ── Selection ───────────────────────────────────────────────────────────────

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!imageToDelete) return;
    setIsDeleting(true);
    try {
      await deleteImage(imageToDelete.id);
      setImages((prev) => prev.filter((i) => i.id !== imageToDelete.id));
      setTotal((t) => Math.max(0, t - 1));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(imageToDelete.id);
        return next;
      });
      setImageToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  const emptyStateCopy = useMemo(() => {
    if (searchQuery) return `No images match "${searchQuery}"`;
    if (filter !== "ALL") return `No ${STUDIO_IMAGE_TYPE_LABEL[filter].toLowerCase()} yet`;
    return "Your library is empty";
  }, [searchQuery, filter]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Box
      sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 3 }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (e.dataTransfer?.types?.includes("Files")) setIsDragOver(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        // Only clear when leaving the outer container (related target outside).
        if (!(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
          setIsDragOver(false);
        }
      }}
      onDrop={onDrop}
    >
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: "26px", fontWeight: 700, color: "#1F1F1F" }}>
          My Studio
        </Typography>
        <Typography sx={{ fontSize: "14px", color: "#5F6368", mt: 0.5 }}>
          Your personal image workspace. Store, enhance, and generate images.
        </Typography>
      </Box>

      {/* Toolbar */}
      {!hasSelection ? (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1,
            mb: 2,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic"
            multiple
            style={{ display: "none" }}
            onChange={onFileInputChange}
          />
          <Button
            variant="contained"
            disableElevation
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            startIcon={
              isUploading ? (
                <CircularProgress size={14} sx={{ color: "white" }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              )
            }
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              bgcolor: "#D0103A",
              "&:hover": { bgcolor: "#A00D2E" },
            }}
          >
            {isUploading ? "Uploading…" : "Upload images"}
          </Button>

          <Button
            variant="outlined"
            onClick={() => router.push(`/my-studio/workflow/new`)}
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              borderColor: "#E8EAED",
              color: "#1F1F1F",
              "&:hover": { borderColor: "#ABABAB" },
            }}
          >
            New image from prompt
          </Button>

          <Button
            variant="outlined"
            disabled={selected.size < 2}
            onClick={() => {
              const ids = Array.from(selected).slice(0, 20).join(",");
              router.push(`/my-studio/workflow/batch?sources=${ids}`);
            }}
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              borderColor: selected.size >= 2 ? "#D0103A" : "#E8EAED",
              color: selected.size >= 2 ? "#D0103A" : "#9E9E9E",
              "&:hover": selected.size >= 2
                ? { bgcolor: "#FFF1F4", borderColor: "#A00D2E" }
                : {},
            }}
          >
            Batch workflow
          </Button>

          <Box sx={{ flex: 1 }} />

          {/* Search */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              px: 1.5,
              py: 0.5,
              borderRadius: 9999,
              border: "1px solid #E8EAED",
              bgcolor: "#FFFFFF",
              minWidth: 220,
              "&:focus-within": { borderColor: "#D0103A" },
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <InputBase
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search images"
              sx={{ ml: 1, fontSize: "13px", flex: 1 }}
              inputProps={{ "aria-label": "Search images" }}
            />
          </Box>

          {/* Grid/List toggle */}
          <ToggleButtonGroup
            size="small"
            value={view}
            exclusive
            onChange={(_, v) => v && setView(v)}
            sx={{
              "& .MuiToggleButton-root": {
                borderColor: "#E8EAED",
                color: "#5F6368",
                textTransform: "none",
                fontSize: "12px",
                px: 1.25,
                py: 0.5,
                "&.Mui-selected": {
                  bgcolor: "#F7F7F7",
                  color: "#1F1F1F",
                  "&:hover": { bgcolor: "#EEEEEE" },
                },
              },
            }}
          >
            <ToggleButton value="grid" aria-label="Grid view">Grid</ToggleButton>
            <ToggleButton value="list" aria-label="List view">List</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      ) : (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            mb: 2,
            px: 2,
            py: 1.25,
            borderRadius: "12px",
            bgcolor: "#FFF5F7",
            border: "1px solid #F5C6D0",
          }}
        >
          <Typography sx={{ fontSize: "13px", color: "#1F1F1F", fontWeight: 600 }}>
            {selected.size} image{selected.size > 1 ? "s" : ""} selected
          </Typography>
          <Button
            size="small"
            onClick={clearSelection}
            sx={{ textTransform: "none", color: "#5F6368", fontSize: "12px" }}
          >
            Clear
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            variant="outlined"
            disabled={selected.size < 2}
            onClick={() => {
              const ids = Array.from(selected).slice(0, 20).join(",");
              router.push(`/my-studio/workflow/batch?sources=${ids}`);
            }}
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              borderColor: selected.size >= 2 ? "#D0103A" : "#E8EAED",
              color: selected.size >= 2 ? "#D0103A" : "#9E9E9E",
              fontSize: "12px",
              "&:hover": selected.size >= 2 ? { bgcolor: "#FFF1F4" } : {},
            }}
          >
            ⚡ Batch workflow
          </Button>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              const first = images.find((i) => selected.has(i.id));
              if (first) setImageToDelete(first);
            }}
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              borderColor: "#E8EAED",
              color: "#D0103A",
              fontSize: "12px",
              "&:hover": { borderColor: "#D0103A", bgcolor: "#FFF1F4" },
            }}
          >
            Delete
          </Button>
        </Box>
      )}

      {/* Filter bar */}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 2 }}>
        {FILTER_TABS.map((t) => {
          const active = filter === t.key;
          return (
            <Box
              key={t.key}
              component="button"
              onClick={() => {
                setFilter(t.key);
                setPage(1);
              }}
              sx={{
                px: 1.75,
                py: 0.5,
                borderRadius: 9999,
                border: "1px solid",
                borderColor: active ? "#D0103A" : "#E8EAED",
                bgcolor: active ? "#D0103A" : "#FFFFFF",
                color: active ? "#FFFFFF" : "#5F6368",
                fontSize: "12.5px",
                fontWeight: active ? 600 : 500,
                cursor: "pointer",
                "&:hover": {
                  borderColor: "#D0103A",
                  bgcolor: active ? "#A00D2E" : "#FFF1F4",
                  color: active ? "#FFFFFF" : "#D0103A",
                },
              }}
            >
              {t.label}
            </Box>
          );
        })}
      </Box>

      {/* Drag-over indicator */}
      {isDragOver && (
        <Box
          sx={{
            mb: 2,
            py: 6,
            borderRadius: "16px",
            border: "2px dashed #D0103A",
            bgcolor: "#FFF1F4",
            textAlign: "center",
            color: "#D0103A",
            fontSize: "15px",
            fontWeight: 600,
          }}
        >
          Drop to upload to My Studio
        </Box>
      )}

      {/* Content */}
      {isLoading ? (
        view === "grid" ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 2,
              "@media (min-width:600px)": { gridTemplateColumns: "repeat(3, 1fr)" },
              "@media (min-width:900px)": { gridTemplateColumns: "repeat(4, 1fr)" },
              "@media (min-width:1200px)": { gridTemplateColumns: "repeat(5, 1fr)" },
            }}
          >
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" sx={{ aspectRatio: "1", borderRadius: "14px" }} />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} variant="rectangular" sx={{ height: 64, borderRadius: "10px" }} />
            ))}
          </Box>
        )
      ) : images.length === 0 ? (
        <Box
          sx={{
            py: 10,
            borderRadius: "16px",
            border: "1.5px dashed #E8EAED",
            textAlign: "center",
            bgcolor: "#FAFAFA",
          }}
        >
          <Box sx={{ fontSize: "32px", mb: 1 }}>🖼️</Box>
          <Typography sx={{ fontSize: "15px", fontWeight: 600, color: "#1F1F1F" }}>
            {emptyStateCopy}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: "13px", color: "#9E9E9E" }}>
            Drag & drop images here, or use the Upload button.
          </Typography>
        </Box>
      ) : view === "grid" ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 2,
            "@media (min-width:600px)": { gridTemplateColumns: "repeat(3, 1fr)" },
            "@media (min-width:900px)": { gridTemplateColumns: "repeat(4, 1fr)" },
            "@media (min-width:1200px)": { gridTemplateColumns: "repeat(5, 1fr)" },
          }}
        >
          {images.map((img) => {
            const isChecked = selected.has(img.id);
            const thumb = staticStudioUrl(img.thumbnail_url ?? img.storage_url);
            return (
              <Box
                key={img.id}
                sx={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: "14px",
                  overflow: "hidden",
                  bgcolor: "#FFFFFF",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  transition: "all 0.18s ease",
                  cursor: "pointer",
                  "& .card-actions": { opacity: 0 },
                  "& .card-checkbox": { opacity: isChecked ? 1 : 0 },
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 6px 20px rgba(0,0,0,0.10)",
                    "& .card-actions": { opacity: 1 },
                    "& .card-checkbox": { opacity: 1 },
                  },
                  outline: isChecked ? "2px solid #D0103A" : "none",
                  outlineOffset: "-2px",
                }}
                onClick={() => router.push(`/my-studio/image/${img.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") router.push(`/my-studio/image/${img.id}`);
                }}
              >
                {/* Thumbnail */}
                <Box
                  sx={{
                    aspectRatio: "1",
                    bgcolor: "#F5F5F5",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    component="img"
                    src={thumb}
                    alt={`${img.name} — ${STUDIO_IMAGE_TYPE_LABEL[img.type]}`}
                    loading="lazy"
                    sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />

                  {/* Selection checkbox (always rendered; opacity driven by hover/state above) */}
                  <Box
                    className="card-checkbox"
                    component="button"
                    aria-label={isChecked ? "Deselect" : "Select"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(img.id);
                    }}
                    sx={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      width: 22,
                      height: 22,
                      borderRadius: "6px",
                      border: isChecked ? "none" : "1.5px solid #FFFFFF",
                      bgcolor: isChecked ? "#D0103A" : "rgba(0,0,0,0.35)",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      p: 0,
                      transition: "opacity 0.15s",
                    }}
                  >
                    {isChecked && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </Box>

                  {/* Hover action icons (top right) */}
                  <Box
                    className="card-actions"
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      display: "flex",
                      gap: 0.5,
                      transition: "opacity 0.15s",
                    }}
                  >
                    <Box
                      component="button"
                      aria-label="Enhance with AI"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/my-studio/workflow/new?source=${img.id}`);
                      }}
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        border: "none",
                        bgcolor: "rgba(255,255,255,0.92)",
                        color: "#5F6368",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        p: 0,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                        "&:hover": { color: "#D0103A", bgcolor: "#FFFFFF" },
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                    </Box>
                    <Box
                      component="button"
                      aria-label="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setImageToDelete(img);
                      }}
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        border: "none",
                        bgcolor: "rgba(255,255,255,0.92)",
                        color: "#5F6368",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        p: 0,
                        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                        "&:hover": { color: "#D0103A", bgcolor: "#FFFFFF" },
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6M14 11v6" />
                      </svg>
                    </Box>
                  </Box>

                  {/* Type pill */}
                  <Box sx={{ position: "absolute", bottom: 8, right: 8 }}>
                    <TypePill type={img.type} />
                  </Box>
                </Box>

                {/* Card footer */}
                <Box sx={{ px: 1.5, py: 1 }}>
                  <Typography
                    sx={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#1F1F1F",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {img.name}
                  </Typography>
                  <Typography sx={{ mt: 0.25, fontSize: "11px", color: "#9E9E9E" }}>
                    {new Date(img.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ borderRadius: "14px", border: "1px solid #F0F0F0", bgcolor: "#FFFFFF", overflow: "hidden" }}>
          {images.map((img, idx) => {
            const isChecked = selected.has(img.id);
            return (
              <Box
                key={img.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 2,
                  px: 2,
                  py: 1.25,
                  borderBottom: idx < images.length - 1 ? "1px solid #F5F5F5" : "none",
                  cursor: "pointer",
                  bgcolor: isChecked ? "#FFF5F7" : "transparent",
                  "&:hover": { bgcolor: isChecked ? "#FFE4EA" : "#FAFAFA" },
                }}
                onClick={() => router.push(`/my-studio/image/${img.id}`)}
              >
                <Box
                  component="button"
                  aria-label={isChecked ? "Deselect" : "Select"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(img.id);
                  }}
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: "4px",
                    border: "1.5px solid",
                    borderColor: isChecked ? "#D0103A" : "#BDBDBD",
                    bgcolor: isChecked ? "#D0103A" : "transparent",
                    color: "#FFFFFF",
                    flexShrink: 0,
                    p: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  {isChecked && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </Box>
                <Box
                  component="img"
                  src={staticStudioUrl(img.thumbnail_url ?? img.storage_url)}
                  alt={img.name}
                  sx={{
                    width: 44,
                    height: 44,
                    objectFit: "cover",
                    borderRadius: "8px",
                    bgcolor: "#F5F5F5",
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#1F1F1F",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {img.name}
                  </Typography>
                  <Typography sx={{ fontSize: "11px", color: "#9E9E9E" }}>
                    {new Date(img.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {Math.round(img.size_bytes / 1024)} KB
                  </Typography>
                </Box>
                <TypePill type={img.type} />
                <Box
                  component="button"
                  aria-label="Delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    setImageToDelete(img);
                  }}
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    border: "none",
                    bgcolor: "transparent",
                    color: "#9E9E9E",
                    p: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    "&:hover": { color: "#D0103A", bgcolor: "#FFF1F4" },
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <Box
          sx={{
            mt: 3,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Button
            size="small"
            variant="outlined"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED" }}
          >
            ← Prev
          </Button>
          <Typography sx={{ fontSize: "12px", color: "#5F6368", mx: 1 }}>
            Page {page} of {pageCount} · {total} images
          </Typography>
          <Button
            size="small"
            variant="outlined"
            disabled={page === pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED" }}
          >
            Next →
          </Button>
        </Box>
      )}

      {/* Delete confirmation dialog */}
      <Dialog
        open={imageToDelete !== null}
        onClose={() => !isDeleting && setImageToDelete(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ pb: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "12px",
                bgcolor: "#FFF0F3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D0103A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </Box>
            <Typography sx={{ fontSize: "17px", fontWeight: 700, color: "#1A1A1A" }}>
              Delete image?
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ pt: "0 !important" }}>
          <Typography sx={{ fontSize: "13px", color: "#5F6368", lineHeight: 1.6 }}>
            &ldquo;{imageToDelete?.name}&rdquo; will be removed from your library. This action
            can&rsquo;t be undone from the UI.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button
            fullWidth
            variant="outlined"
            onClick={() => setImageToDelete(null)}
            disabled={isDeleting}
            sx={{ borderColor: "#E8EAED", color: "#3C4043" }}
          >
            Cancel
          </Button>
          <Button
            fullWidth
            variant="contained"
            onClick={handleDelete}
            disabled={isDeleting}
            sx={{ bgcolor: "#D0103A", "&:hover": { bgcolor: "#A00D2E" } }}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast || !!uploadError}
        onClose={() => {
          setToast(null);
          setUploadError(null);
        }}
        autoHideDuration={4000}
        message={uploadError ?? toast ?? ""}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </Box>
  );
}
