import type { Metadata } from "next";

import { BenchmarkWorkbench } from "@/components/benchmark-workbench";

export const metadata: Metadata = {
  title: "Visual RAG benchmark | SceneSeeker",
  description: "Measure scene retrieval accuracy and timestamp correctness across 30 labeled questions.",
};

export default async function BenchmarkPage({
  searchParams,
}: {
  searchParams: Promise<{ video?: string }>;
}) {
  const { video } = await searchParams;
  return <BenchmarkWorkbench initialVideoId={video ?? ""} />;
}

