"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ButtonBase from "@mui/material/ButtonBase";
import TextField from "@mui/material/TextField";
import { useAuth } from "@/components/providers/auth-provider";
import { LibraryItemCard } from "@/components/cards/library-item-card";
import { fetchLibraryItems, remixLibraryItem } from "@/lib/api/brand-library";
import type { BrandLibraryItem } from "@/types/brand-library";

const AIA_PRODUCTS = [
  "All products",
  "PAA",
  "HealthShield",
  "AIA Vitality",
  "PRUWealth",
  "AIA Family Protect",
  "SG60 Special",
];

export default function BrandLibraryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<BrandLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [product, setProduct] = useState("");
  const [isRemixing, setIsRemixing] = useState<string | null>(null);

  const isAdmin = user?.role === "brand_admin";

  useEffect(() => {
    setIsLoading(true);
    fetchLibraryItems({
      search: search || undefined,
      product: product || undefined,
    })
      .then((res) => setItems(res.items))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [search, product]);

  const handleRemix = async (itemId: string) => {
    setIsRemixing(itemId);
    try {
      const result = await remixLibraryItem(itemId);
      router.push(`/projects/${result.project_id}`);
    } catch {
      setIsRemixing(null);
    }
  };

  return (
    <Box sx={{ mx: "auto", maxWidth: 1200, px: 3, py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 5, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography sx={{ fontSize: "28px", fontWeight: 700, color: "#1F1F1F" }}>
            Brand Library
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: "16px", color: "#5F6368" }}>
            {isAdmin
              ? "Manage approved content for FSCs to remix"
              : "Official AIA content — compliant and brand-locked. Remix any item into your own project."}
          </Typography>
        </Box>
        {isAdmin && (
          <Button
            variant="contained"
            disableElevation
            sx={{
              borderRadius: 9999,
              textTransform: "none",
              bgcolor: "#D0103A",
              color: "#FFFFFF",
              fontSize: "16px",
              fontWeight: 600,
              px: 3,
              py: 1.5,
              "&:hover": { bgcolor: "#B80E33" },
            }}
          >
            + Publish new
          </Button>
        )}
      </Box>

      {/* Filters */}
      <Box sx={{ mb: 4, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2 }}>
        <Box sx={{ flex: 1 }}>
          <TextField
            type="text"
            size="small"
            variant="outlined"
            placeholder="Search library items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{
              width: "100%",
              maxWidth: 448,
              "& .MuiOutlinedInput-root": {
                borderRadius: "10px",
                fontSize: "16px",
                color: "#222222",
                "& fieldset": { borderColor: "#DDDDDD" },
                "&:hover fieldset": { borderColor: "#BBBBBB" },
                "&.Mui-focused fieldset": {
                  borderColor: "#D0103A",
                  boxShadow: "0 0 0 3px rgba(208,16,58,0.08)",
                },
              },
              "& input::placeholder": { color: "#B0B0B0", opacity: 1 },
            }}
          />
        </Box>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {AIA_PRODUCTS.map((p) => {
            const isActive = (p === "All products" && !product) || product === p;
            return (
              <ButtonBase
                key={p}
                onClick={() => setProduct(p === "All products" ? "" : p)}
                sx={{
                  borderRadius: 9999,
                  px: 2,
                  py: 1,
                  fontSize: "14px",
                  fontWeight: 500,
                  border: "1px solid",
                  transition: "all 0.15s",
                  ...(isActive
                    ? { bgcolor: "#222222", color: "#FFFFFF", borderColor: "#222222" }
                    : {
                        bgcolor: "#FFFFFF",
                        color: "#484848",
                        borderColor: "#DDDDDD",
                        "&:hover": { borderColor: "#222222" },
                      }),
                }}
              >
                {p}
              </ButtonBase>
            );
          })}
        </Box>
      </Box>

      {/* Items */}
      {isLoading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[1, 2, 3].map((i) => (
            <Box
              key={i}
              sx={{
                height: 80,
                borderRadius: "12px",
                bgcolor: "#F7F7F7",
                "@keyframes pulse": {
                  "0%, 100%": { opacity: 1 },
                  "50%": { opacity: 0.5 },
                },
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </Box>
      ) : items.length > 0 ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {items.map((item) => (
            <LibraryItemCard
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              onRemix={() => handleRemix(item.id)}
              onManage={() => router.push(`/brand-library/${item.id}`)}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ mt: 6, textAlign: "center" }}>
          <Box
            sx={{
              mx: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 64,
              height: 64,
              borderRadius: "50%",
              bgcolor: "#F7F7F7",
              fontSize: "30px",
            }}
          >
            📚
          </Box>
          <Typography sx={{ mt: 2, fontSize: "18px", fontWeight: 600, color: "#1F1F1F" }}>
            {search || product ? "No matching items" : "Brand Library is empty"}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: "14px", color: "#5F6368" }}>
            {isAdmin
              ? "Publish your first artifact for FSCs to remix"
              : "Your brand team will publish content here soon"}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
