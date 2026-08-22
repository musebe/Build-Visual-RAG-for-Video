"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import type { CldVideoPlayerProps } from "next-cloudinary";
import {
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Play,
  Search,
  Upload,
  Video,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import {
  requestJson,
  requestUploadSignature,
  uploadVideoToCloudinary,
  validateVideoFile,
} from "@/lib/client/cloudinary-upload";

const CldVideoPlayer = dynamic(
  () => import("next-cloudinary").then((module) => module.CldVideoPlayer),
  { ssr: false },
);

type VideoStatus =
  | "uploaded"
  | "analyzing"
  | "transcript_ready"
  | "embedding"
  | "ready"
  | "failed";

type PublicVideo = {
  id: string;
  publicId: string;
  filename: string;
  duration: number;
  status: VideoStatus;
  errorCode: string | null;
};

type VideoResponse = {
  video: PublicVideo;
  indexedScenes?: number;
  sceneCount?: number;
};

type SearchResult = {
  rank: number;
  sceneId: number;
  sceneIndex: number;
  description: string;
  startTime: number;
  endTime: number;
  similarity: number;
  citation: string;
};

type SearchResponse = {
  query: string;
  video: { id: string; publicId: string };
  results: SearchResult[];
};

type PlayerInstance = NonNullable<CldVideoPlayerProps["playerRef"]>["current"];

const statusCopy: Record<VideoStatus, string> = {
  uploaded: "Video received",
  analyzing: "Cloudinary is describing each scene",
  transcript_ready: "Visual transcript ready",
  embedding: "Indexing scene descriptions",
  ready: "Ready to search",
  failed: "Processing failed",
};

const statusProgress: Record<VideoStatus, number> = {
  uploaded: 30,
  analyzing: 50,
  transcript_ready: 75,
  embedding: 88,
  ready: 100,
  failed: 100,
};

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export function VideoSearchDemo() {
  const playerRef = useRef<PlayerInstance>(null);
  const requestController = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [video, setVideo] = useState<PublicVideo | null>(null);
  const [phase, setPhase] = useState("Choose a video to begin");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => () => requestController.current?.abort(), []);

  async function pollUntilReady(initialVideo: PublicVideo, signal: AbortSignal) {
    let current = initialVideo;

    for (let attempt = 0; attempt < 120; attempt += 1) {
      if (current.status === "failed") {
        throw new Error("Video processing failed. Try another video.");
      }
      if (current.status === "ready") return current;

      if (current.status === "transcript_ready") {
        setPhase(statusCopy.embedding);
        setProgress(statusProgress.embedding);
        const indexed = await requestJson<VideoResponse>(`/api/videos/${current.id}/index`, {
          method: "POST",
          signal,
        });
        current = indexed.video;
        setVideo(current);
        continue;
      }

      await wait(2_500, signal);
      const polled = await requestJson<VideoResponse>(`/api/videos/${current.id}`, { signal });
      current = polled.video;
      setVideo(current);
      setPhase(statusCopy[current.status]);
      setProgress(statusProgress[current.status]);
    }

    throw new Error("Video analysis is taking longer than expected. Refresh and try again.");
  }

  async function handleUpload() {
    if (!file) return;
    requestController.current?.abort();
    const controller = new AbortController();
    requestController.current = controller;

    setError(null);
    setResults([]);
    setVideo(null);
    setIsProcessing(true);

    try {
      setPhase("Checking video");
      setProgress(5);
      await validateVideoFile(file);

      setPhase("Preparing secure upload");
      setProgress(10);
      const signature = await requestUploadSignature(file, controller.signal);

      setPhase("Uploading directly to Cloudinary");
      const uploaded = await uploadVideoToCloudinary(
        file,
        signature,
        controller.signal,
        (percent) => setProgress(10 + Math.round(percent * 0.2)),
      );

      setPhase("Starting visual analysis");
      setProgress(32);
      const registered = await requestJson<VideoResponse>("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetId: uploaded.asset_id,
          publicId: uploaded.public_id,
          originalFilename: file.name,
        }),
        signal: controller.signal,
      });
      setVideo(registered.video);
      setPhase(statusCopy[registered.video.status]);
      setProgress(statusProgress[registered.video.status]);

      const ready = await pollUntilReady(registered.video, controller.signal);
      setVideo(ready);
      setPhase(statusCopy.ready);
      setProgress(100);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(caught instanceof Error ? caught.message : "Video processing failed.");
      setPhase("Processing stopped");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!video || video.status !== "ready" || query.trim().length < 2) return;

    setError(null);
    setIsSearching(true);
    try {
      const response = await requestJson<SearchResponse>(`/api/videos/${video.id}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      setResults(response.results);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Search failed.");
    } finally {
      setIsSearching(false);
    }
  }

  function playCitation(result: SearchResult) {
    playerRef.current?.currentTime(result.startTime);
    playerRef.current?.play();
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-10 flex items-center justify-between gap-4">
        <span className="text-sm font-semibold tracking-tight">SceneSeeker</span>
        <Link
          href="/benchmark"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Benchmark
        </Link>
      </header>

      <section className="mb-8 max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-5xl">
          Search inside a silent video.
        </h1>
        <p className="mt-3 text-base leading-7 text-muted-foreground sm:text-lg">
          Upload a video, describe what you remember seeing, and jump to the matching moment.
        </p>
      </section>

      <section aria-labelledby="upload-heading" className="mb-6 rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label id="upload-heading" htmlFor="video-file" className="mb-2 block text-sm font-medium">
              Video
            </label>
            <Input
              id="video-file"
              type="file"
              accept="video/mp4,video/quicktime,video/webm"
              disabled={isProcessing}
              className="h-11 cursor-pointer py-2 file:mr-3"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setError(null);
              }}
            />
          </div>
          <Button
            type="button"
            size="lg"
            disabled={!file || isProcessing}
            className="h-11 sm:min-w-36"
            onClick={handleUpload}
          >
            {isProcessing ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Upload data-icon="inline-start" />
            )}
            {isProcessing ? "Processing" : "Upload & index"}
          </Button>
        </div>

        {(isProcessing || video) && (
          <Progress value={progress} className="mt-4" aria-label="Video processing progress">
            <ProgressLabel>{phase}</ProgressLabel>
            <span className="ml-auto text-sm text-muted-foreground tabular-nums">{progress}%</span>
          </Progress>
        )}
      </section>

      {error && (
        <p role="alert" className="mb-6 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,0.8fr)]">
        <section aria-label="Video player" className="overflow-hidden rounded-2xl border bg-black shadow-sm">
          {video ? (
            <CldVideoPlayer
              key={video.publicId}
              id="scene-seeker-player"
              width="1280"
              height="720"
              src={video.publicId}
              playerRef={playerRef}
              logo={false}
              colors={{ accent: "#2563eb", base: "#ffffff", text: "#ffffff" }}
            />
          ) : (
            <div className="flex aspect-video items-center justify-center bg-slate-950 text-slate-400">
              <div className="flex flex-col items-center gap-3 text-sm">
                <Video className="size-8" aria-hidden="true" />
                Your video will appear here
              </div>
            </div>
          )}
        </section>

        <section aria-labelledby="search-heading" className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            {video?.status === "ready" ? (
              <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
            ) : (
              <Clock3 className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
            <h2 id="search-heading" className="text-sm font-medium">
              {video?.status === "ready" ? "Search scenes" : "Search unlocks after indexing"}
            </h2>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <label htmlFor="scene-query" className="sr-only">
              Describe the scene to find
            </label>
            <Input
              id="scene-query"
              type="search"
              value={query}
              disabled={video?.status !== "ready" || isSearching}
              placeholder="e.g. person opens a red umbrella"
              className="h-10"
              onChange={(event) => setQuery(event.target.value)}
            />
            <Button
              type="submit"
              size="icon-lg"
              aria-label="Search video scenes"
              disabled={video?.status !== "ready" || query.trim().length < 2 || isSearching}
            >
              {isSearching ? <LoaderCircle className="animate-spin" /> : <Search />}
            </Button>
          </form>

          <div className="mt-5" aria-live="polite">
            {results.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {video?.status === "ready"
                  ? "Matches will appear here with exact scene timestamps."
                  : "Cloudinary will create the visual transcript before search begins."}
              </p>
            ) : (
              <ol className="space-y-3">
                {results.map((result) => (
                  <li key={result.sceneId}>
                    <button
                      type="button"
                      onClick={() => playCitation(result)}
                      className="group w-full rounded-xl border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <span className="mb-2 flex items-center justify-between gap-3 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                          <Play className="size-3" fill="currentColor" aria-hidden="true" />
                          {result.citation}
                        </span>
                        <span className="text-muted-foreground">
                          {Math.round(result.similarity * 100)}% match
                        </span>
                      </span>
                      <span className="line-clamp-3 text-sm leading-6 text-foreground">
                        {result.description}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
