"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createTemplate, updateTemplate, fetchTemplates } from "@/lib/api/brand-kit";
import { queryKeys } from "@/lib/query-keys";
import { TemplateCard } from "../template-card";
import { ZoneTable } from "../zone-table";
import type { BrandKitTemplate, TemplateZone } from "@/types/brand-kit";

interface TemplatesTabProps {
  isEditMode: boolean;
}

const DEFAULT_ZONES: TemplateZone[] = [
  { name: "creative", x: 0, y: 0, width: 594, height: 1080 },
  { name: "logo", x: 650, y: 54, width: 380, height: 120 },
  { name: "headline", x: 620, y: 240, width: 420, height: 320 },
  { name: "cta", x: 620, y: 600, width: 420, height: 120 },
  { name: "disclaimer", x: 0, y: 1006, width: 1080, height: 74 },
];

const textFieldSx = {
  "& .MuiOutlinedInput-root": {
    fontSize: "0.875rem",
    "& fieldset": { borderColor: "#E5E5E5" },
    "&:hover fieldset": { borderColor: "#ABABAB" },
    "&.Mui-focused fieldset": { borderColor: "#D0103A", borderWidth: 1 },
  },
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "custom_layout";
}

interface NewTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function NewTemplateDialog({ open, onClose, onCreated }: NewTemplateDialogProps) {
  const [name, setName] = useState("");
  const [zones, setZones] = useState<TemplateZone[]>(DEFAULT_ZONES.map((z) => ({ ...z })));
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      createTemplate({
        name: name.trim(),
        layout_key: slugify(name.trim()),
        zones,
      }),
    onSuccess: () => {
      onCreated();
      handleClose();
    },
    onError: (err: { detail?: string }) => {
      setError(err?.detail ?? "Failed to create template. Please try again.");
    },
  });

  function handleClose() {
    if (createMutation.isPending) return;
    setName("");
    setZones(DEFAULT_ZONES.map((z) => ({ ...z })));
    setError(null);
    onClose();
  }

  function updateZone(index: number, field: keyof TemplateZone, value: string | number) {
    setZones((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: field === "name" ? value : Number(value) };
      return next;
    });
  }

  function removeZone(index: number) {
    setZones((prev) => prev.filter((_, i) => i !== index));
  }

  function addZone() {
    setZones((prev) => [...prev, { name: "", x: 0, y: 0, width: 200, height: 200 }]);
  }

  const isValid = name.trim().length > 0 && zones.length > 0 && zones.every((z) => z.name.trim().length > 0);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: "16px" } } }}>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 600, color: "#1F1F1F", pb: 1 }}>
        New layout template
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography sx={{ fontSize: 12, color: "#5F6368", mb: 2 }}>
          Define the canvas zones for this layout. Coordinates are in pixels on a 1080 × 1080 canvas.
        </Typography>

        <TextField
          label="Template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
          disabled={createMutation.isPending}
          sx={{ ...textFieldSx, mb: 3 }}
          placeholder="e.g. Hero Subject Left"
        />

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#1F1F1F" }}>Zones</Typography>
          <Box
            component="button"
            onClick={addZone}
            disabled={createMutation.isPending}
            sx={{
              fontSize: 12,
              color: "#D0103A",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontWeight: 500,
              "&:hover": { textDecoration: "underline" },
              "&:disabled": { opacity: 0.5, cursor: "default" },
            }}
          >
            + Add zone
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {zones.map((zone, i) => (
            <Box
              key={i}
              sx={{
                border: "1px solid #E8EAED",
                borderRadius: "8px",
                p: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 1,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                <TextField
                  value={zone.name}
                  onChange={(e) => updateZone(i, "name", e.target.value)}
                  size="small"
                  placeholder="Zone name (e.g. headline, cta, badge)"
                  disabled={createMutation.isPending}
                  sx={{ ...textFieldSx, flex: 1, mr: 1 }}
                />
                <IconButton
                  size="small"
                  onClick={() => removeZone(i)}
                  disabled={createMutation.isPending || zones.length <= 1}
                  sx={{ color: "#9E9E9E", "&:hover": { color: "#D0103A" } }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </IconButton>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1 }}>
                {(["x", "y", "width", "height"] as const).map((field) => (
                  <TextField
                    key={field}
                    label={field}
                    type="number"
                    value={zone[field]}
                    onChange={(e) => updateZone(i, field, e.target.value)}
                    size="small"
                    disabled={createMutation.isPending}
                    slotProps={{ htmlInput: { min: 0 } }}
                    sx={textFieldSx}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {error && (
          <Typography sx={{ mt: 2, fontSize: 12, color: "#D0103A" }}>{error}</Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={handleClose}
          disabled={createMutation.isPending}
          sx={{
            textTransform: "none",
            borderRadius: 9999,
            color: "#5F6368",
            border: "1px solid #E8EAED",
            px: 2.5,
          }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!isValid || createMutation.isPending}
          onClick={() => createMutation.mutate()}
          startIcon={
            createMutation.isPending ? (
              <CircularProgress size={14} sx={{ color: "white" }} />
            ) : undefined
          }
          sx={{
            textTransform: "none",
            borderRadius: 9999,
            bgcolor: "#D0103A",
            color: "white",
            fontWeight: 600,
            px: 2.5,
            "&:hover": { bgcolor: "#A00D2E" },
            "&:disabled": { bgcolor: "#E5E5E5", color: "#ABABAB" },
          }}
          disableElevation
        >
          {createMutation.isPending ? "Creating…" : "Create template"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

interface EditTemplateDialogProps {
  template: BrandKitTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}

function EditTemplateDialog({ template, onClose, onSaved }: EditTemplateDialogProps) {
  const open = template !== null;
  // State is initialised from template on mount. The component is keyed by
  // template.id in the parent so it remounts fresh whenever a different
  // template is opened — no manual sync needed.
  const [name, setName] = useState(template?.name ?? "");
  const [zones, setZones] = useState<TemplateZone[]>(template?.zones.map((z) => ({ ...z })) ?? []);
  const [error, setError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateTemplate(template!.id, { name: name.trim(), zones }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
    onError: (err: { detail?: string }) => {
      setError(err?.detail ?? "Failed to save. Please try again.");
    },
  });

  function handleClose() {
    if (saveMutation.isPending) return;
    setError(null);
    onClose();
  }

  function updateZone(index: number, field: keyof TemplateZone, value: string | number) {
    setZones((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: field === "name" ? value : Number(value) };
      return next;
    });
  }

  function removeZone(index: number) {
    setZones((prev) => prev.filter((_, i) => i !== index));
  }

  function addZone() {
    setZones((prev) => [...prev, { name: "", x: 0, y: 0, width: 200, height: 200 }]);
  }

  const isValid = name.trim().length > 0 && zones.length > 0 && zones.every((z) => z.name.trim().length > 0);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: "16px" } } }}>
      <DialogTitle sx={{ fontSize: 16, fontWeight: 600, color: "#1F1F1F", pb: 1 }}>
        Edit layout — {template?.name}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Typography sx={{ fontSize: 12, color: "#5F6368", mb: 2 }}>
          Adjust zone coordinates on a 1080 × 1080 canvas.
        </Typography>

        <TextField
          label="Template name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          size="small"
          disabled={saveMutation.isPending}
          sx={{ ...textFieldSx, mb: 3 }}
        />

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#1F1F1F" }}>Zones</Typography>
          <Box
            component="button"
            onClick={addZone}
            disabled={saveMutation.isPending}
            sx={{
              fontSize: 12,
              color: "#D0103A",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontWeight: 500,
              "&:hover": { textDecoration: "underline" },
              "&:disabled": { opacity: 0.5, cursor: "default" },
            }}
          >
            + Add zone
          </Box>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {zones.map((zone, i) => (
            <Box
              key={i}
              sx={{ border: "1px solid #E8EAED", borderRadius: "8px", p: 1.5, display: "flex", flexDirection: "column", gap: 1 }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                <TextField
                  value={zone.name}
                  onChange={(e) => updateZone(i, "name", e.target.value)}
                  size="small"
                  placeholder="Zone name (e.g. headline, cta, badge)"
                  disabled={saveMutation.isPending}
                  sx={{ ...textFieldSx, flex: 1, mr: 1 }}
                />
                <IconButton
                  size="small"
                  onClick={() => removeZone(i)}
                  disabled={saveMutation.isPending || zones.length <= 1}
                  sx={{ color: "#9E9E9E", "&:hover": { color: "#D0103A" } }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </IconButton>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1 }}>
                {(["x", "y", "width", "height"] as const).map((field) => (
                  <TextField
                    key={field}
                    label={field}
                    type="number"
                    value={zone[field]}
                    onChange={(e) => updateZone(i, field, e.target.value)}
                    size="small"
                    disabled={saveMutation.isPending}
                    slotProps={{ htmlInput: { min: 0 } }}
                    sx={textFieldSx}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Box>

        {error && <Typography sx={{ mt: 2, fontSize: 12, color: "#D0103A" }}>{error}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button
          onClick={handleClose}
          disabled={saveMutation.isPending}
          sx={{ textTransform: "none", borderRadius: 9999, color: "#5F6368", border: "1px solid #E8EAED", px: 2.5 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!isValid || saveMutation.isPending}
          onClick={() => saveMutation.mutate()}
          startIcon={saveMutation.isPending ? <CircularProgress size={14} sx={{ color: "white" }} /> : undefined}
          sx={{
            textTransform: "none", borderRadius: 9999, bgcolor: "#D0103A", color: "white",
            fontWeight: 600, px: 2.5,
            "&:hover": { bgcolor: "#A00D2E" },
            "&:disabled": { bgcolor: "#E5E5E5", color: "#ABABAB" },
          }}
          disableElevation
        >
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function TemplatesTab({ isEditMode }: TemplatesTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<BrandKitTemplate | null>(null);
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: queryKeys.brandKitTemplates(),
    queryFn: fetchTemplates,
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    refetchInterval: (query) =>
      query.state.status === "error" && !query.state.data ? 8000 : false,
  });

  const templates = templatesQuery.data ?? [];
  const selected = templates.find((t) => t.id === selectedId) ?? (templates.length > 0 ? templates[0] : null);

  function openDialog() {
    if (isEditMode) setDialogOpen(true);
  }

  function handleCreated() {
    queryClient.invalidateQueries({ queryKey: queryKeys.brandKitTemplates() });
  }

  function handleSaved() {
    queryClient.invalidateQueries({ queryKey: queryKeys.brandKitTemplates() });
  }

  if (templatesQuery.isPending) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
        <CircularProgress size={28} sx={{ color: "#D0103A" }} />
      </Box>
    );
  }

  if (templatesQuery.isError && !templatesQuery.data) {
    return (
      <Box sx={{ py: 6, textAlign: "center" }}>
        <Typography sx={{ fontSize: 14, color: "#717171", mb: 1.5 }}>
          Could not load templates.
        </Typography>
        <Box
          component="button"
          onClick={() => templatesQuery.refetch()}
          sx={{
            fontSize: 13,
            color: "#1F1F1F",
            border: "1px solid #E8EAED",
            borderRadius: 9999,
            px: 2,
            py: 0.75,
            cursor: "pointer",
            background: "none",
            "&:hover": { borderColor: "#DADCE0" },
          }}
        >
          {templatesQuery.isFetching ? "Retrying…" : "Retry"}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3 }}>
        <Typography sx={{ fontSize: 16, fontWeight: 600, color: "#1F1F1F" }}>
          Poster layout templates
        </Typography>
        {isEditMode && (
          <Box
            component="button"
            onClick={openDialog}
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderRadius: 9999,
              border: "1px solid #E8EAED",
              backgroundColor: "transparent",
              color: "#5F6368",
              fontSize: 13,
              cursor: "pointer",
              "&:hover": { borderColor: "#DADCE0", color: "#1F1F1F" },
            }}
          >
            + New template
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr 1fr",
            sm: "1fr 1fr 1fr",
            md: "1fr 1fr 1fr 1fr",
            lg: "repeat(5, 1fr)",
          },
          gap: 2,
        }}
      >
        {templates.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            isSelected={(selected?.id ?? null) === t.id}
            onClick={() => setSelectedId(t.id)}
          />
        ))}

        <Box
          onClick={openDialog}
          sx={{
            border: "1px dashed #E8EAED",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            aspectRatio: "1 / 1",
            cursor: isEditMode ? "pointer" : "default",
            opacity: isEditMode ? 1 : 0.5,
            "&:hover": isEditMode ? { borderColor: "#D0103A", "& .new-layout-text": { color: "#D0103A" } } : {},
          }}
        >
          <Typography className="new-layout-text" sx={{ fontSize: 24, color: "#9E9E9E", mb: 0.5, transition: "color 0.15s" }}>+</Typography>
          <Typography className="new-layout-text" sx={{ fontSize: 11, color: "#9E9E9E", transition: "color 0.15s" }}>New layout</Typography>
        </Box>
      </Box>

      {selected && (
        <Box sx={{ mt: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>
              Zone coordinates — {selected.name}
            </Typography>
            {isEditMode && (
              <Box
                component="button"
                onClick={() => setEditingTemplate(selected)}
                sx={{
                  fontSize: 12,
                  color: "#5F6368",
                  border: "1px solid #E8EAED",
                  borderRadius: 9999,
                  px: 1.5,
                  py: 0.4,
                  cursor: "pointer",
                  background: "none",
                  "&:hover": { borderColor: "#DADCE0", color: "#1F1F1F" },
                }}
              >
                Edit zones
              </Box>
            )}
          </Box>
          <ZoneTable zones={selected.zones} />
        </Box>
      )}

      <NewTemplateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={handleCreated}
      />

      <EditTemplateDialog
        key={editingTemplate?.id ?? "none"}
        template={editingTemplate}
        onClose={() => setEditingTemplate(null)}
        onSaved={handleSaved}
      />
    </Box>
  );
}
