"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import { useAuth } from "@/components/providers/auth-provider";
import { LibraryItemCard } from "@/components/cards/library-item-card";
import { fetchLibraryItems, remixLibraryItem } from "@/lib/api/brand-library";
import type { BrandLibraryItem } from "@/types/brand-library";

export function BrandLibraryTab() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<BrandLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = user?.role === "brand_admin";

  useEffect(() => {
    fetchLibraryItems()
      .then((res) => setItems(res.items))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              height: 72,
              borderRadius: "12px",
              border: "1px solid #E8EAED",
              bgcolor: "#F8F9FA",
              "@keyframes pulse": {
                "0%, 100%": { opacity: 1 },
                "50%": { opacity: 0.5 },
              },
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2.5, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography sx={{ fontSize: "16px", fontWeight: 600, color: "#1F1F1F" }}>
          Brand library
        </Typography>
        <Button
          variant="outlined"
          size="small"
          disableElevation
          onClick={() => router.push("/brand-library")}
          endIcon={
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4l4 4-4 4" />
            </svg>
          }
          sx={{
            borderRadius: 9999,
            textTransform: "none",
            fontSize: "14px",
            fontWeight: 500,
            color: "#3C4043",
            borderColor: "#DADCE0",
            "&:hover": { bgcolor: "#F1F3F4", borderColor: "#DADCE0" },
          }}
        >
          {isAdmin ? "Manage library" : "Browse all"}
        </Button>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {items.map((item) => (
          <LibraryItemCard
            key={item.id}
            item={item}
            isAdmin={isAdmin}
            onRemix={async () => {
              const result = await remixLibraryItem(item.id);
              router.push(`/projects/${result.project_id}`);
            }}
            onManage={() => router.push(`/brand-library/${item.id}`)}
          />
        ))}
      </Box>

      {items.length === 0 && (
        <Box sx={{ mt: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: "16px",
              bgcolor: "#F1F3F4",
              fontSize: "24px",
            }}
          >
            📚
          </Box>
          <Typography sx={{ fontSize: "15px", fontWeight: 500, color: "#1F1F1F" }}>
            {isAdmin ? "Brand Library is empty" : "Nothing here yet"}
          </Typography>
          <Typography sx={{ fontSize: "13px", color: "#80868B" }}>
            {isAdmin
              ? "Publish your first artifact for FSCs to remix"
              : "Your brand team will publish content here soon"}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
