"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function NewPosterIndexPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/projects/${projectId}/artifacts/new-poster/brief`);
  }, [projectId, router]);

  return null;
}
