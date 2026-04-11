"use client";

import { useEffect, useState } from "react";
import { fetchComments, addComment, type Comment } from "@/lib/api/comments";

interface CommentThreadProps {
  artifactId: string;
  canComment: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function CommentThread({ artifactId, canComment }: CommentThreadProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchComments(artifactId)
      .then(setComments)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [artifactId]);

  async function handleSubmit() {
    if (!newText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const comment = await addComment(artifactId, newText.trim());
      setComments((prev) => [...prev, comment]);
      setNewText("");
    } catch {
      /* noop */
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-[#484848]">
        Leader comments
        {comments.length > 0 && (
          <span className="ml-1.5 text-xs font-normal text-[#717171]">({comments.length})</span>
        )}
      </h3>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-[#F7F7F7]" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-[#AAAAAA]">No comments yet</p>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => {
            const initials = c.user.name.split(" ").map((n) => n[0]).join("").slice(0, 2);
            const avatarUrl = c.user.avatar_url
              ? c.user.avatar_url.startsWith("http")
                ? c.user.avatar_url
                : `${API_BASE}${c.user.avatar_url}`
              : null;

            return (
              <div key={c.id} className="flex gap-3 rounded-xl bg-[#F7F7F7] p-4">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={c.user.name} className="h-7 w-7 flex-shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#222222] text-[10px] font-bold text-white">
                    {initials}
                  </div>
                )}
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-[#222222]">{c.user.name}</span>
                    <span className="text-[10px] text-[#AAAAAA]">
                      {new Date(c.created_at).toLocaleDateString("en-SG", {
                        day: "numeric", month: "short",
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-[#484848]">{c.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canComment && (
        <div className="flex flex-col gap-2">
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add a comment for the FSC…"
            rows={3}
            className="w-full resize-none rounded-xl border border-[#DDDDDD] px-4 py-3 text-sm text-[#222222] placeholder-[#B0B0B0] focus:border-[#222222] focus:outline-none focus:ring-0"
          />
          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!newText.trim() || isSubmitting}
              className="rounded-xl bg-[#222222] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#333333] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? "Posting…" : "Post comment"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
