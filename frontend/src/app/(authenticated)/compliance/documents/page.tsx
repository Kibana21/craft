"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDocuments,
  fetchDocumentDetail,
  uploadDocument,
  uploadDocumentFile,
  deleteDocument,
  type ComplianceDocument,
} from "@/lib/api/compliance";
import { queryKeys } from "@/lib/query-keys";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import ReactMarkdown from "react-markdown";

const DOC_TYPES = [
  { value: "mas_regulation", label: "MAS Regulation", color: "#1A73E8" },
  { value: "product_fact_sheet", label: "Product Fact Sheet", color: "#188038" },
  { value: "disclaimer", label: "Disclaimer", color: "#B45309" },
] as const;

function docTypeLabel(value: string) {
  return DOC_TYPES.find((d) => d.value === value)?.label ?? value.replace(/_/g, " ");
}

function docTypeColor(value: string) {
  return DOC_TYPES.find((d) => d.value === value)?.color ?? "#5F6368";
}

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px",
    fontSize: 14,
    "& fieldset": { borderColor: "#E8EAED" },
    "&:hover fieldset": { borderColor: "#DADCE0" },
    "&.Mui-focused fieldset": { borderColor: "#1F1F1F", borderWidth: 1 },
  },
};

const pillSx = (active: boolean) => ({
  px: 1.5,
  py: 0.4,
  borderRadius: 9999,
  fontSize: 12,
  fontWeight: active ? 600 : 500,
  cursor: "pointer",
  border: "1px solid",
  borderColor: active ? "#1F1F1F" : "#E8EAED",
  bgcolor: active ? "#1F1F1F" : "transparent",
  color: active ? "#fff" : "#5F6368",
  transition: "all 0.1s",
  "&:hover": { borderColor: "#1F1F1F", color: active ? "#fff" : "#1F1F1F" },
});

// ── View document dialog ────────────────────────────────────────────────────

function ViewDocumentDialog({ docId, onClose }: { docId: string; onClose: () => void }) {
  const detailQuery = useQuery({
    queryKey: queryKeys.complianceDocumentDetail(docId),
    queryFn: () => fetchDocumentDetail(docId),
  });

  const doc = detailQuery.data;

  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: 18, pb: 0.5 }}>
        {doc?.title ?? "Loading…"}
      </DialogTitle>
      {doc && (
        <Typography sx={{ px: 3, fontSize: 12, color: "#9E9E9E" }}>
          {docTypeLabel(doc.document_type)}
          {doc.original_filename && ` · ${doc.original_filename}`}
          {doc.file_size && ` (${(doc.file_size / 1024 / 1024).toFixed(1)} MB)`}
          {` · ${doc.content.length.toLocaleString()} characters`}
        </Typography>
      )}
      <DialogContent>
        {detailQuery.isPending ? (
          <Box sx={{ py: 4, display: "flex", justifyContent: "center" }}>
            <CircularProgress size={24} sx={{ color: "#9E9E9E" }} />
          </Box>
        ) : detailQuery.isError ? (
          <Typography sx={{ py: 4, textAlign: "center", fontSize: 14, color: "#D0103A" }}>
            Failed to load document.
          </Typography>
        ) : (
          <Box
            sx={{
              mt: 1,
              p: 2.5,
              borderRadius: "12px",
              bgcolor: "#F8F9FA",
              maxHeight: 500,
              overflow: "auto",
              fontSize: 13,
              lineHeight: 1.7,
              color: "#1F1F1F",
              "& h1": { fontSize: 18, fontWeight: 700, mt: 2, mb: 1, lineHeight: 1.3 },
              "& h2": { fontSize: 16, fontWeight: 600, mt: 2, mb: 0.75, lineHeight: 1.3 },
              "& h3": { fontSize: 14, fontWeight: 600, mt: 1.5, mb: 0.5, lineHeight: 1.3 },
              "& h4": { fontSize: 13, fontWeight: 600, mt: 1, mb: 0.5 },
              "& p": { mb: 1 },
              "& ul, & ol": { pl: 2.5, mb: 1 },
              "& li": { mb: 0.25 },
              "& table": { borderCollapse: "collapse", width: "100%", fontSize: 12, mb: 1 },
              "& th, & td": { border: "1px solid #E8EAED", px: 1, py: 0.5, textAlign: "left" },
              "& th": { bgcolor: "#F0F0F0", fontWeight: 600 },
              "& strong": { fontWeight: 600 },
              "& em": { fontStyle: "italic" },
              "& blockquote": { borderLeft: "3px solid #E8EAED", pl: 1.5, ml: 0, color: "#5F6368" },
            }}
          >
            <ReactMarkdown>{doc!.content}</ReactMarkdown>
          </Box>
        )}
        <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 2 }}>
          <Button
            onClick={onClose}
            variant="outlined"
            disableElevation
            sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#5F6368" }}
          >
            Close
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Delete confirmation dialog ──────────────────────────────────────────────

function DeleteConfirmDialog({
  doc,
  onClose,
  onConfirm,
  isPending,
}: {
  doc: ComplianceDocument;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog
      open
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: "16px" } } }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: 18, pb: 1 }}>Delete document</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: 14, color: "#5F6368", mb: 2.5 }}>
          Delete <strong>{doc.title}</strong>? This document will be removed from the compliance
          library and will no longer be used in compliance checks.
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
          <Button
            onClick={onClose}
            variant="outlined"
            disableElevation
            sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#5F6368" }}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isPending}
            disableElevation
            startIcon={isPending ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : undefined}
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              bgcolor: "#D0103A",
              color: "#fff",
              px: 3,
              fontWeight: 600,
              "&:hover": { bgcolor: "#B80E33" },
              "&.Mui-disabled": { opacity: 0.4, color: "#fff", bgcolor: "#D0103A" },
            }}
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function ComplianceDocumentsPage() {
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [uploadMode, setUploadMode] = useState<"file" | "paste">("file");
  const [newDoc, setNewDoc] = useState({ title: "", content: "", document_type: "mas_regulation" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [viewingDocId, setViewingDocId] = useState<string | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<ComplianceDocument | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setNewDoc({ title: "", content: "", document_type: "mas_regulation" });
    setSelectedFile(null);
    setShowUpload(false);
    setFormError(null);
  }, []);

  const docsQuery = useQuery({
    queryKey: queryKeys.complianceDocuments(),
    queryFn: () => fetchDocuments(),
  });

  const pasteMutation = useMutation({
    mutationFn: () => uploadDocument(newDoc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.complianceDocuments() });
      resetForm();
    },
    onError: (err: unknown) => {
      const detail = (err as { detail?: string })?.detail;
      setFormError(detail ?? "Upload failed. Please try again.");
    },
  });

  const fileMutation = useMutation({
    mutationFn: () => uploadDocumentFile(selectedFile!, newDoc.title, newDoc.document_type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.complianceDocuments() });
      resetForm();
    },
    onError: (err: unknown) => {
      const detail = (err as { detail?: string })?.detail;
      setFormError(detail ?? "Upload failed. Please try again.");
    },
  });

  const isUploading = pasteMutation.isPending || fileMutation.isPending;

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (!newDoc.title) {
      const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
      setNewDoc((d) => ({ ...d, title: nameWithoutExt }));
    }
    setFormError(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.complianceDocuments() });
      setDeletingDoc(null);
    },
  });

  const docs = docsQuery.data ?? [];

  // Stats
  const masCount = docs.filter((d) => d.document_type === "mas_regulation").length;
  const factSheetCount = docs.filter((d) => d.document_type === "product_fact_sheet").length;
  const disclaimerCount = docs.filter((d) => d.document_type === "disclaimer").length;

  // Filter + search
  const filtered = docs.filter((d) => {
    if (typeFilter !== "all" && d.document_type !== typeFilter) return false;
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 2, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#1F1F1F", fontSize: "28px" }}>
            Compliance Documents
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: "1rem", color: "#5F6368" }}>
            Regulatory library that powers AI compliance checking
          </Typography>
        </Box>
        <Button
          onClick={() => {
            setShowUpload(!showUpload);
            setFormError(null);
          }}
          disableElevation
          sx={{
            borderRadius: 9999,
            textTransform: "none",
            bgcolor: "#D0103A",
            color: "#fff",
            px: 3,
            py: 1.5,
            fontWeight: 600,
            fontSize: "1rem",
            "&:hover": { bgcolor: "#B80E33" },
          }}
        >
          + Upload document
        </Button>
      </Box>

      {/* Stats strip */}
      {docs.length > 0 && (
        <Typography sx={{ fontSize: 13, color: "#9E9E9E", mb: 3 }}>
          {docs.length} {docs.length === 1 ? "document" : "documents"}
          {masCount > 0 && ` · ${masCount} MAS Regulation${masCount > 1 ? "s" : ""}`}
          {factSheetCount > 0 && ` · ${factSheetCount} Fact Sheet${factSheetCount > 1 ? "s" : ""}`}
          {disclaimerCount > 0 && ` · ${disclaimerCount} Disclaimer${disclaimerCount > 1 ? "s" : ""}`}
        </Typography>
      )}

      {/* Upload form */}
      {showUpload && (
        <Box sx={{ mb: 4, borderRadius: "16px", border: "1px solid #F0F0F0", bgcolor: "#FFFFFF", p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Typography sx={{ fontWeight: 600, color: "#1F1F1F", mr: 1 }}>Upload document</Typography>
            <Box
              component="button"
              onClick={() => setUploadMode("file")}
              sx={pillSx(uploadMode === "file")}
            >
              Upload file
            </Box>
            <Box
              component="button"
              onClick={() => setUploadMode("paste")}
              sx={pillSx(uploadMode === "paste")}
            >
              Paste text
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {/* File drop zone (file mode) */}
            {uploadMode === "file" && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.txt"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    e.target.value = "";
                  }}
                />
                {!selectedFile ? (
                  <Box
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    sx={{
                      border: "2px dashed",
                      borderColor: isDragOver ? "#D0103A" : "#E8EAED",
                      borderRadius: "12px",
                      py: 4,
                      px: 3,
                      textAlign: "center",
                      cursor: "pointer",
                      bgcolor: isDragOver ? "#FFF1F4" : "#FAFAFA",
                      transition: "all 0.15s",
                      "&:hover": { borderColor: "#DADCE0", bgcolor: "#F7F7F7" },
                    }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px" }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <polyline points="9 15 12 12 15 15" />
                    </svg>
                    <Typography sx={{ fontSize: 14, fontWeight: 500, color: "#1F1F1F" }}>
                      Drop a PDF or Word document here
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "#9E9E9E", mt: 0.25 }}>
                      or click to browse
                    </Typography>
                    <Typography sx={{ fontSize: 11, color: "#BDBDBD", mt: 0.5 }}>
                      Supported: .pdf, .docx, .txt · Max 50 MB
                    </Typography>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      border: "1px solid #E8EAED",
                      borderRadius: "10px",
                      px: 2,
                      py: 1.5,
                      bgcolor: "#FAFAFA",
                    }}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 500, color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {selectedFile.name}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: "#9E9E9E" }}>
                        {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                      </Typography>
                    </Box>
                    <Box
                      component="button"
                      onClick={() => setSelectedFile(null)}
                      sx={{
                        flexShrink: 0,
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        border: "none",
                        bgcolor: "transparent",
                        color: "#9E9E9E",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        "&:hover": { bgcolor: "#F0F0F0", color: "#5F6368" },
                      }}
                    >
                      ×
                    </Box>
                  </Box>
                )}
              </>
            )}

            {/* Title + type (shared) */}
            <TextField
              value={newDoc.title}
              onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
              placeholder="Document title"
              fullWidth
              size="small"
              sx={textFieldSx}
            />
            <Select
              value={newDoc.document_type}
              onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })}
              size="small"
              sx={{
                borderRadius: "8px",
                fontSize: 14,
                maxWidth: 260,
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E8EAED" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#DADCE0" },
              }}
            >
              {DOC_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>

            {/* Paste textarea (paste mode) */}
            {uploadMode === "paste" && (
              <Box>
                <TextField
                  multiline
                  rows={6}
                  value={newDoc.content}
                  onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
                  placeholder="Paste the regulatory text here. The system will use this content for AI-powered compliance checking."
                  fullWidth
                  sx={{
                    ...textFieldSx,
                    "& textarea::placeholder": { fontSize: 13, color: "#BDBDBD", fontStyle: "italic" },
                  }}
                />
                <Typography sx={{ mt: 0.5, fontSize: 11, color: "#9E9E9E" }}>
                  {newDoc.content.length.toLocaleString()} characters
                </Typography>
              </Box>
            )}

            {/* Actions */}
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
              <Button
                onClick={resetForm}
                variant="outlined"
                disableElevation
                sx={{ borderRadius: 9999, textTransform: "none", borderColor: "#E8EAED", color: "#5F6368" }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (uploadMode === "file") fileMutation.mutate();
                  else pasteMutation.mutate();
                }}
                disabled={
                  isUploading ||
                  newDoc.title.length < 1 ||
                  (uploadMode === "file" ? !selectedFile : newDoc.content.length < 10)
                }
                disableElevation
                startIcon={isUploading ? <CircularProgress size={14} sx={{ color: "#fff" }} /> : undefined}
                sx={{
                  borderRadius: 9999,
                  textTransform: "none",
                  bgcolor: "#188038",
                  color: "#fff",
                  px: 3,
                  fontWeight: 600,
                  "&:hover": { bgcolor: "#146830" },
                  "&.Mui-disabled": { opacity: 0.4, color: "#fff", bgcolor: "#188038" },
                }}
              >
                {isUploading ? "Uploading…" : "Upload"}
              </Button>
            </Box>
            {formError && (
              <Typography sx={{ fontSize: 13, color: "#D0103A" }}>{formError}</Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Filter bar + search */}
      {docs.length > 0 && (
        <Box sx={{ mb: 3, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
          <Box
            component="button"
            onClick={() => setTypeFilter("all")}
            sx={pillSx(typeFilter === "all")}
          >
            All
          </Box>
          {DOC_TYPES.map((t) => (
            <Box
              key={t.value}
              component="button"
              onClick={() => setTypeFilter(typeFilter === t.value ? "all" : t.value)}
              sx={pillSx(typeFilter === t.value)}
            >
              {t.label}
            </Box>
          ))}
          <Box sx={{ flex: 1 }} />
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title…"
            size="small"
            sx={{
              maxWidth: 240,
              "& .MuiOutlinedInput-root": {
                borderRadius: "8px",
                fontSize: 13,
                "& fieldset": { borderColor: "#E8EAED" },
                "&:hover fieldset": { borderColor: "#DADCE0" },
                "&.Mui-focused fieldset": { borderColor: "#1F1F1F", borderWidth: 1 },
              },
            }}
          />
        </Box>
      )}

      {/* Documents list */}
      {docsQuery.isPending ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={100} sx={{ borderRadius: "16px" }} />
          ))}
        </Box>
      ) : docsQuery.isError && !docsQuery.data ? (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography sx={{ fontSize: 14, color: "#5F6368", mb: 1.5 }}>
            Could not load compliance documents.
          </Typography>
          <Button
            onClick={() => docsQuery.refetch()}
            variant="outlined"
            disableElevation
            sx={{ borderRadius: 9999, textTransform: "none", fontSize: 13, borderColor: "#E8EAED", color: "#1F1F1F" }}
          >
            {docsQuery.isFetching ? "Retrying…" : "Retry"}
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.length === 0 && (
            <Box sx={{ py: 6, textAlign: "center" }}>
              {docs.length === 0 ? (
                <>
                  <Box
                    sx={{
                      mx: "auto",
                      width: 56,
                      height: 56,
                      borderRadius: "50%",
                      bgcolor: "#F8F9FA",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      mb: 2,
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                  </Box>
                  <Typography sx={{ fontSize: 16, fontWeight: 600, color: "#1F1F1F" }}>
                    No documents in the compliance library
                  </Typography>
                  <Typography sx={{ mt: 0.5, fontSize: 14, color: "#5F6368", maxWidth: 440, mx: "auto" }}>
                    Upload MAS regulations, product fact sheets, and disclaimer templates.
                    The AI uses these documents to check whether marketing content complies
                    with regulatory requirements.
                  </Typography>
                  <Button
                    onClick={() => setShowUpload(true)}
                    disableElevation
                    sx={{
                      mt: 2.5,
                      borderRadius: 9999,
                      textTransform: "none",
                      bgcolor: "#D0103A",
                      color: "#fff",
                      px: 3,
                      fontWeight: 600,
                      "&:hover": { bgcolor: "#B80E33" },
                    }}
                  >
                    + Upload your first document
                  </Button>
                </>
              ) : (
                <Typography sx={{ fontSize: 14, color: "#9E9E9E" }}>
                  No documents match this filter.
                </Typography>
              )}
            </Box>
          )}

          {filtered.map((doc) => {
            const color = docTypeColor(doc.document_type);
            return (
              <Box
                key={doc.id}
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 2,
                  borderRadius: "16px",
                  border: "1px solid #F0F0F0",
                  bgcolor: "#FFFFFF",
                  p: 2.5,
                }}
              >
                {/* Doc type icon */}
                <Box
                  sx={{
                    mt: 0.25,
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: "10px",
                    bgcolor: `${color}14`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>
                    {doc.title}
                  </Typography>
                  <Box sx={{ mt: 0.5, display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
                    <Box
                      component="span"
                      sx={{
                        borderRadius: 9999,
                        px: 1.25,
                        py: 0.2,
                        fontSize: 11,
                        fontWeight: 500,
                        color,
                        bgcolor: `${color}14`,
                      }}
                    >
                      {docTypeLabel(doc.document_type)}
                    </Box>
                    {doc.original_filename && (
                      <Typography component="span" sx={{ fontSize: 11, color: "#9E9E9E" }}>
                        {doc.original_filename}
                        {doc.file_size && ` (${(doc.file_size / 1024 / 1024).toFixed(1)} MB)`}
                      </Typography>
                    )}
                    <Typography component="span" sx={{ fontSize: 11, color: "#9E9E9E" }}>
                      {new Date(doc.created_at).toLocaleDateString("en-SG", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Typography>
                  </Box>
                  {doc.content_preview && (
                    <Typography
                      sx={{
                        mt: 1,
                        fontSize: 12,
                        color: "#5F6368",
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {doc.content_preview}
                      {doc.content_preview.length >= 200 && "…"}
                    </Typography>
                  )}
                </Box>

                {/* Actions */}
                <Box sx={{ display: "flex", gap: 1, flexShrink: 0, mt: 0.25 }}>
                  <Button
                    onClick={() => setViewingDocId(doc.id)}
                    size="small"
                    disableElevation
                    sx={{
                      borderRadius: 9999,
                      textTransform: "none",
                      fontSize: 12,
                      fontWeight: 500,
                      px: 1.5,
                      py: 0.5,
                      border: "1px solid #E8EAED",
                      color: "#5F6368",
                      bgcolor: "transparent",
                      "&:hover": { borderColor: "#DADCE0", bgcolor: "#F7F7F7" },
                    }}
                  >
                    View
                  </Button>
                  {doc.file_url && (
                    <Button
                      onClick={async () => {
                        const { getAccessToken } = await import("@/lib/auth");
                        const token = getAccessToken();
                        const resp = await fetch(
                          `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/compliance/documents/${doc.id}/download`,
                          { headers: token ? { Authorization: `Bearer ${token}` } : {} },
                        );
                        if (!resp.ok) return;
                        const blob = await resp.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = doc.original_filename || "document";
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      size="small"
                      disableElevation
                      sx={{
                        borderRadius: 9999,
                        textTransform: "none",
                        fontSize: 12,
                        fontWeight: 500,
                        px: 1.5,
                        py: 0.5,
                        border: "1px solid #E8EAED",
                        color: "#5F6368",
                        bgcolor: "transparent",
                        "&:hover": { borderColor: "#DADCE0", bgcolor: "#F7F7F7" },
                      }}
                    >
                      Download
                    </Button>
                  )}
                  <Button
                    onClick={() => setDeletingDoc(doc)}
                    size="small"
                    disableElevation
                    sx={{
                      borderRadius: 9999,
                      textTransform: "none",
                      fontSize: 12,
                      fontWeight: 500,
                      px: 1.5,
                      py: 0.5,
                      bgcolor: "#FCE8E6",
                      color: "#C5221F",
                      "&:hover": { bgcolor: "#FADAD8" },
                    }}
                  >
                    Delete
                  </Button>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* View dialog */}
      {viewingDocId && (
        <ViewDocumentDialog docId={viewingDocId} onClose={() => setViewingDocId(null)} />
      )}

      {/* Delete confirmation dialog */}
      {deletingDoc && (
        <DeleteConfirmDialog
          doc={deletingDoc}
          onClose={() => setDeletingDoc(null)}
          onConfirm={() => deleteMutation.mutate(deletingDoc.id)}
          isPending={deleteMutation.isPending}
        />
      )}
    </Box>
  );
}
