"use client";

import { useEffect, useState } from "react";
import { fetchDocuments, uploadDocument, deleteDocument, type ComplianceDocument } from "@/lib/api/compliance";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";

export default function ComplianceDocumentsPage() {
  const [docs, setDocs] = useState<ComplianceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [newDoc, setNewDoc] = useState({ title: "", content: "", document_type: "mas_regulation" });

  const loadDocs = () => {
    fetchDocuments().then(setDocs).finally(() => setIsLoading(false));
  };

  useEffect(() => { loadDocs(); }, []);

  const handleUpload = async () => {
    await uploadDocument(newDoc);
    setNewDoc({ title: "", content: "", document_type: "mas_regulation" });
    setShowUpload(false);
    loadDocs();
  };

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
    loadDocs();
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 5, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: "#1F1F1F", fontSize: "28px" }}>
            Compliance Documents
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: "1rem", color: "#5F6368" }}>
            MAS regulations and product fact sheets for RAG-based compliance checking
          </Typography>
        </Box>
        <Button
          onClick={() => setShowUpload(!showUpload)}
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

      {/* Upload form */}
      {showUpload && (
        <Box
          sx={{
            mb: 4,
            borderRadius: "16px",
            border: "1px solid #F0F0F0",
            bgcolor: "#FFFFFF",
            p: 3,
          }}
        >
          <Typography sx={{ mb: 2, fontWeight: 600, color: "#1F1F1F" }}>Upload document</Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              type="text"
              value={newDoc.title}
              onChange={(e) => setNewDoc({ ...newDoc, title: e.target.value })}
              placeholder="Document title"
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  "& fieldset": { borderColor: "#E8EAED" },
                  "&:hover fieldset": { borderColor: "#DADCE0" },
                  "&.Mui-focused fieldset": { borderColor: "#1F1F1F" },
                },
              }}
            />
            <Select
              value={newDoc.document_type}
              onChange={(e) => setNewDoc({ ...newDoc, document_type: e.target.value })}
              size="small"
              sx={{
                borderRadius: "8px",
                "& .MuiOutlinedInput-notchedOutline": { borderColor: "#E8EAED" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#DADCE0" },
              }}
            >
              <MenuItem value="mas_regulation">MAS Regulation</MenuItem>
              <MenuItem value="product_fact_sheet">Product Fact Sheet</MenuItem>
              <MenuItem value="disclaimer">Disclaimer Template</MenuItem>
            </Select>
            <TextField
              multiline
              rows={6}
              value={newDoc.content}
              onChange={(e) => setNewDoc({ ...newDoc, content: e.target.value })}
              placeholder="Paste document content here..."
              fullWidth
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "8px",
                  "& fieldset": { borderColor: "#E8EAED" },
                  "&:hover fieldset": { borderColor: "#DADCE0" },
                  "&.Mui-focused fieldset": { borderColor: "#1F1F1F" },
                },
              }}
            />
            <Button
              onClick={handleUpload}
              disabled={newDoc.title.length < 1 || newDoc.content.length < 10}
              disableElevation
              sx={{
                alignSelf: "flex-start",
                borderRadius: 9999,
                textTransform: "none",
                bgcolor: "#188038",
                color: "#fff",
                px: 3,
                py: 1.5,
                fontWeight: 600,
                fontSize: "1rem",
                "&:hover": { bgcolor: "#146830" },
                "&.Mui-disabled": { opacity: 0.4, color: "#fff", bgcolor: "#188038" },
              }}
            >
              Upload
            </Button>
          </Box>
        </Box>
      )}

      {/* Documents list */}
      {isLoading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={64} sx={{ borderRadius: "16px" }} />
          ))}
        </Box>
      ) : docs.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {docs.map((doc) => (
            <Box
              key={doc.id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                borderRadius: "16px",
                border: "1px solid #F0F0F0",
                bgcolor: "#FFFFFF",
                p: 2.5,
              }}
            >
              {/* Icon */}
              <Box
                sx={{
                  flexShrink: 0,
                  width: 40,
                  height: 40,
                  borderRadius: "10px",
                  bgcolor: "#1A73E8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.875rem",
                  color: "#fff",
                }}
              >
                📄
              </Box>

              {/* Content */}
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "#1F1F1F" }}>
                  {doc.title}
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "#5F6368" }}>
                  {doc.document_type.replace("_", " ")} · Chunk {doc.chunk_index}
                </Typography>
              </Box>

              {/* Delete button */}
              <Button
                onClick={() => handleDelete(doc.id)}
                disableElevation
                size="small"
                sx={{
                  borderRadius: 9999,
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  px: 1.5,
                  py: 0.75,
                  bgcolor: "#FCE8E6",
                  color: "#C5221F",
                  "&:hover": { bgcolor: "#FADAD8" },
                }}
              >
                Delete
              </Button>
            </Box>
          ))}
        </Box>
      ) : (
        <Box sx={{ mt: 6, textAlign: "center" }}>
          <Box
            sx={{
              mx: "auto",
              width: 64,
              height: 64,
              borderRadius: "50%",
              bgcolor: "#F8F9FA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.875rem",
            }}
          >
            📄
          </Box>
          <Typography sx={{ mt: 2, fontSize: "1.125rem", fontWeight: 600, color: "#1F1F1F" }}>
            No documents uploaded
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: "0.875rem", color: "#5F6368" }}>
            Upload MAS regulations for compliance checking
          </Typography>
        </Box>
      )}
    </Box>
  );
}
