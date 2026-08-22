"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, FileJson, LoaderCircle, PlayCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestJson } from "@/lib/client/cloudinary-upload";

type BenchmarkRun = {
  id: string;
  benchmark_version: string;
  embedding_model: string;
  question_count: number;
  top1_accuracy: number;
  top3_recall: number;
  timestamp_overlap_accuracy: number;
  mean_start_time_error: number | null;
  completed_at: string;
};

type BenchmarkResult = {
  id: number;
  question: string;
  expected_scene_index: number;
  retrieved_scene_index: number | null;
  expected_rank: number | null;
  top1_correct: boolean;
  top3_hit: boolean;
  timestamp_overlap: boolean;
  start_time_error: number | null;
};

type BenchmarkReport = {
  run: BenchmarkRun;
  results: BenchmarkResult[];
};

export function BenchmarkWorkbench({ initialVideoId = "" }: { initialVideoId?: string }) {
  const [videoId, setVideoId] = useState(initialVideoId);
  const [version, setVersion] = useState("v1");
  const [questionSet, setQuestionSet] = useState<unknown>(null);
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [status, setStatus] = useState("Load a labeled 30-question JSON file.");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "run" | "load" | null>(null);

  async function loadQuestionFile(file: File | undefined) {
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object" || !("questions" in parsed)) {
        throw new Error("The JSON file must contain a questions array.");
      }
      if ("version" in parsed && typeof parsed.version === "string") setVersion(parsed.version);
      setQuestionSet(parsed);
      setFileName(file.name);
      setError(null);
      setStatus("Question file loaded. Save it before running the benchmark.");
    } catch (caught) {
      setQuestionSet(null);
      setError(caught instanceof Error ? caught.message : "The question file is invalid.");
    }
  }

  async function saveQuestions() {
    if (!videoId || !questionSet) return;
    setBusy("save");
    setError(null);
    try {
      const source = questionSet as { questions?: unknown };
      const response = await requestJson<{ version: string; questionCount: number }>(
        `/api/videos/${videoId}/benchmark/questions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version, questions: source.questions }),
        },
      );
      setStatus(`${response.questionCount} labeled questions saved as ${response.version}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Questions could not be saved.");
    } finally {
      setBusy(null);
    }
  }

  async function loadLatest() {
    if (!videoId) return;
    setBusy("load");
    setError(null);
    try {
      const response = await requestJson<{ benchmark: BenchmarkReport | null }>(
        `/api/videos/${videoId}/benchmark`,
      );
      setReport(response.benchmark);
      setStatus(response.benchmark ? "Latest completed run loaded." : "No completed run found.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The report could not be loaded.");
    } finally {
      setBusy(null);
    }
  }

  async function runBenchmark() {
    if (!videoId) return;
    setBusy("run");
    setError(null);
    setStatus("Embedding and searching all 30 questions…");
    try {
      await requestJson(`/api/videos/${videoId}/benchmark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version }),
      });
      const response = await requestJson<{ benchmark: BenchmarkReport | null }>(
        `/api/videos/${videoId}/benchmark`,
      );
      setReport(response.benchmark);
      setStatus("Benchmark complete.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The benchmark failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to search
      </Link>

      <div className="mt-8 max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">30-question benchmark</h1>
        <p className="mt-3 leading-7 text-muted-foreground">
          Measure scene retrieval and timestamp correctness against a human-labeled question set.
        </p>
      </div>

      <section className="mt-8 rounded-2xl border bg-card p-5 shadow-xs" aria-labelledby="benchmark-setup">
        <h2 id="benchmark-setup" className="text-base font-semibold">Run setup</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <label className="text-sm font-medium">
            Video ID
            <Input className="mt-2 h-10" value={videoId} onChange={(event) => setVideoId(event.target.value)} />
          </label>
          <label className="text-sm font-medium">
            Version
            <Input className="mt-2 h-10" value={version} onChange={(event) => setVersion(event.target.value)} />
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium hover:bg-muted">
            <FileJson className="size-4" aria-hidden="true" />
            {fileName || "Choose question JSON"}
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => loadQuestionFile(event.target.files?.[0])}
            />
          </label>
          <a href="/benchmark-template.json" download className="text-sm text-primary underline-offset-4 hover:underline">
            Download template
          </a>
          {videoId && (
            <a
              href={`/api/videos/${encodeURIComponent(videoId)}/scenes`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              View scene catalog
            </a>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={loadLatest} disabled={!videoId || busy !== null}>
            {busy === "load" && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
            Load latest
          </Button>
          <Button variant="outline" onClick={saveQuestions} disabled={!videoId || !questionSet || busy !== null}>
            {busy === "save" && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
            Save 30 questions
          </Button>
          <Button onClick={runBenchmark} disabled={!videoId || busy !== null}>
            {busy === "run" ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <PlayCircle data-icon="inline-start" />
            )}
            Run
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">{status}</p>
        {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      </section>

      {report && (
        <section className="mt-6" aria-labelledby="benchmark-results">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 id="benchmark-results" className="text-xl font-semibold">Results</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {report.run.benchmark_version} · {report.run.embedding_model} · {report.run.question_count} questions
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Top-1 accuracy", report.run.top1_accuracy, "%"],
              ["Top-3 recall", report.run.top3_recall, "%"],
              ["Timestamp overlap", report.run.timestamp_overlap_accuracy, "%"],
              ["Mean start error", report.run.mean_start_time_error, "s"],
            ].map(([label, value, unit]) => (
              <article key={String(label)} className="rounded-xl border bg-card p-4">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">
                  {value === null ? "—" : unit === "%" ? `${Math.round(Number(value) * 100)}%` : `${Number(value).toFixed(2)}s`}
                </p>
              </article>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-3xl text-left text-sm">
              <thead className="border-b bg-muted/60 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Question</th>
                  <th className="px-4 py-3 font-medium">Expected</th>
                  <th className="px-4 py-3 font-medium">Retrieved</th>
                  <th className="px-4 py-3 font-medium">Rank</th>
                  <th className="px-4 py-3 font-medium">Time overlap</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.results.map((result) => (
                  <tr key={result.id}>
                    <td className="max-w-md px-4 py-3">{result.question}</td>
                    <td className="px-4 py-3 tabular-nums">Scene {result.expected_scene_index}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {result.retrieved_scene_index === null ? "—" : `Scene ${result.retrieved_scene_index}`}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{result.expected_rank ?? "—"}</td>
                    <td className="px-4 py-3">{result.timestamp_overlap ? "Pass" : "Miss"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
