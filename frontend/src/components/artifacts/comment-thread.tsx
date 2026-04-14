"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchComments, addComment } from "@/lib/api/comments";
import { ErrorBanner } from "@/components/common/error-banner";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";

interface CommentThreadProps {
  artifactId: string;
  canComment: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function CommentThread({ artifactId, canComment }: CommentThreadProps) {
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const commentsQuery = useQuery({
    queryKey: ["comments", artifactId] as const,
    queryFn: () => fetchComments(artifactId),
  });
  const comments = commentsQuery.data ?? [];
  const isLoading = commentsQuery.isPending;
  const isRefetchError = commentsQuery.isError && commentsQuery.data !== undefined;

  const submitMutation = useMutation({
    mutationFn: (text: string) => addComment(artifactId, text),
    onSuccess: () => {
      setNewText("");
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ["comments", artifactId] });
    },
    onError: (err: unknown) => {
      const e = err as { detail?: unknown };
      const detail =
        typeof e.detail === "string" ? e.detail : "Couldn't post your comment.";
      setSubmitError(detail);
    },
  });

  const isSubmitting = submitMutation.isPending;

  function handleSubmit() {
    if (!newText.trim() || isSubmitting) return;
    setSubmitError(null);
    submitMutation.mutate(newText.trim());
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, color: "#484848" }}>
        Leader comments
        {comments.length > 0 && (
          <Box component="span" sx={{ ml: 0.75, fontWeight: 400, fontSize: "0.75rem", color: "#717171" }}>
            ({comments.length})
          </Box>
        )}
      </Typography>

      {isRefetchError && (
        <ErrorBanner
          compact
          message="Couldn't refresh comments."
          isStale
          isRetrying={commentsQuery.isFetching}
          onRetry={() => commentsQuery.refetch()}
        />
      )}
      {submitError && (
        <ErrorBanner compact message={submitError} isStale={false} onRetry={handleSubmit} isRetrying={isSubmitting} />
      )}

      {isLoading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {[1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                height: 56,
                borderRadius: "12px",
                bgcolor: "#F7F7F7",
                animation: "pulse 1.5s ease-in-out infinite",
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.4 },
                },
              }}
            />
          ))}
        </Box>
      ) : comments.length === 0 ? (
        <Typography sx={{ fontSize: "0.75rem", color: "#AAAAAA" }}>
          No comments yet
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {comments.map((c) => {
            const initials = c.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
            const avatarUrl = c.user.avatar_url
              ? c.user.avatar_url.startsWith("http")
                ? c.user.avatar_url
                : `${API_BASE}${c.user.avatar_url}`
              : null;

            return (
              <Box
                key={c.id}
                sx={{
                  display: "flex",
                  gap: 1.5,
                  borderRadius: "12px",
                  bgcolor: "#F7F7F7",
                  p: 2,
                }}
              >
                {avatarUrl ? (
                  <Box
                    component="img"
                    src={avatarUrl}
                    alt={c.user.name}
                    sx={{
                      height: 28,
                      width: 28,
                      flexShrink: 0,
                      borderRadius: "50%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      height: 28,
                      width: 28,
                      flexShrink: 0,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "50%",
                      bgcolor: "#222222",
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "white",
                    }}
                  >
                    {initials}
                  </Box>
                )}
                <Box>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "#222222" }}>
                      {c.user.name}
                    </Typography>
                    <Typography sx={{ fontSize: "10px", color: "#AAAAAA" }}>
                      {new Date(c.created_at).toLocaleDateString("en-SG", {
                        day: "numeric", month: "short",
                      })}
                    </Typography>
                  </Box>
                  <Typography sx={{ mt: 0.25, fontSize: "0.875rem", color: "#484848" }}>
                    {c.text}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {canComment && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <TextField
            multiline
            rows={3}
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add a comment for the FSC…"
            fullWidth
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: "12px",
                fontSize: "0.875rem",
                color: "#222222",
                "& fieldset": { borderColor: "#DDDDDD" },
                "&:hover fieldset": { borderColor: "#AAAAAA" },
                "&.Mui-focused fieldset": { borderColor: "#222222", borderWidth: 1 },
              },
              "& .MuiOutlinedInput-input::placeholder": { color: "#B0B0B0", opacity: 1 },
              "& textarea": { resize: "none" },
            }}
          />
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!newText.trim() || isSubmitting}
              disableElevation
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                bgcolor: "#222222",
                color: "white",
                fontWeight: 600,
                fontSize: "0.875rem",
                px: 2.5,
                py: 1.25,
                "&:hover": { bgcolor: "#333333" },
                "&:disabled": { opacity: 0.4, cursor: "not-allowed" },
              }}
            >
              {isSubmitting ? "Posting…" : "Post comment"}
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
