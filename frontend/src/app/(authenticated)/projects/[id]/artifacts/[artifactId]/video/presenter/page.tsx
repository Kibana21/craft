"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useVideoWizard } from "../layout";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Alert from "@mui/material/Alert";
import { fetchArtifactDetail } from "@/lib/api/artifacts";
import { fetchPresenters } from "@/lib/api/presenters";
import { assignPresenter, fetchVideoSession } from "@/lib/api/video-sessions";
import { PresenterForm } from "@/components/video/presenter-form";
import { PresenterLibraryPicker } from "@/components/video/presenter-library-picker";
import type { Presenter, CreatePresenterData, VideoSession } from "@/types/presenter";

export default function PresenterStepPage() {
  const { id: projectId, artifactId } = useParams<{ id: string; artifactId: string }>();
  const router = useRouter();
  const { refreshSession } = useVideoWizard();

  const [videoSession, setVideoSession] = useState<VideoSession | null>(null);
  const [presenters, setPresenters] = useState<Presenter[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(true);
  const [activeTab, setActiveTab] = useState<"library" | "create">("library");
  const [selectedPresenterId, setSelectedPresenterId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!artifactId) return;
    Promise.all([
      fetchArtifactDetail(artifactId),
      fetchPresenters(),
    ]).then(([art, presenterList]) => {
      setPresenters(presenterList);
      // If artifact has a video_session_id, load the session
      if (art.video_session_id) {
        fetchVideoSession(art.video_session_id).then(setVideoSession).catch(() => {});
      }
    }).catch(() => {
      router.push(`/projects/${projectId}`);
    }).finally(() => {
      setIsLoadingLibrary(false);
    });
  }, [artifactId, projectId, router]);

  const handleLibrarySelect = async () => {
    if (!selectedPresenterId || !videoSession) return;
    setIsSubmitting(true);
    setError("");
    try {
      await assignPresenter(videoSession.id, { presenter_id: selectedPresenterId });
      await refreshSession();
      router.push(`/projects/${projectId}/artifacts/${artifactId}/video/script`);
    } catch {
      setError("Failed to assign presenter. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleCreateAndAssign = async (data: CreatePresenterData, saveToLibrary: boolean) => {
    if (!videoSession) return;
    setIsSubmitting(true);
    setError("");
    try {
      await assignPresenter(videoSession.id, {
        name: data.name,
        age_range: data.age_range,
        appearance_keywords: data.appearance_keywords,
        full_appearance_description: data.full_appearance_description,
        speaking_style: data.speaking_style,
        save_to_library: saveToLibrary,
      });
      await refreshSession();
      router.push(`/projects/${projectId}/artifacts/${artifactId}/video/script`);
    } catch {
      setError("Failed to save presenter. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900 }}>
      {/* Heading */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
          Choose a presenter
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Pick from your library or create a new presenter for this video.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {/* Tab switch */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{
          mb: 3,
          borderBottom: "1px solid #E5E5E5",
          "& .MuiTab-root": { textTransform: "none", fontWeight: 600, fontSize: "0.875rem" },
          "& .Mui-selected": { color: "#D0103A" },
          "& .MuiTabs-indicator": { bgcolor: "#D0103A" },
        }}
      >
        <Tab value="library" label={`Library (${presenters.length})`} />
        <Tab value="create" label="Create new" />
      </Tabs>

      {activeTab === "library" ? (
        <PresenterLibraryPicker
          presenters={presenters}
          isLoading={isLoadingLibrary}
          selectedId={selectedPresenterId}
          onSelect={setSelectedPresenterId}
          onConfirm={handleLibrarySelect}
          isSubmitting={isSubmitting}
        />
      ) : (
        <PresenterForm
          onSubmit={handleCreateAndAssign}
          isSubmitting={isSubmitting}
        />
      )}
    </Box>
  );
}
