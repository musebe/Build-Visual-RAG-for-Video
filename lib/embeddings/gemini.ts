import "server-only";

import { GoogleGenAI } from "@google/genai";

import { getServerEnv } from "@/lib/config/env";
import {
  prepareSearchDocument,
  prepareSearchQuery,
} from "@/lib/embeddings/retrieval-input";

export const EMBEDDING_DIMENSIONS = 1_536;
const EMBEDDING_CONCURRENCY = 5;

let client: GoogleGenAI | undefined;

function getGemini() {
  if (!client) {
    client = new GoogleGenAI({ apiKey: getServerEnv().GEMINI_API_KEY });
  }
  return client;
}

async function embedPreparedInput(input: string) {
  const response = await getGemini().models.embedContent({
    model: getServerEnv().GEMINI_EMBEDDING_MODEL,
    contents: input,
    config: { outputDimensionality: EMBEDDING_DIMENSIONS },
  });
  const values = response.embeddings?.[0]?.values;

  if (
    !values ||
    values.length !== EMBEDDING_DIMENSIONS ||
    values.some((value) => !Number.isFinite(value))
  ) {
    throw new Error("The embedding provider returned an unexpected vector shape.");
  }

  return values;
}

async function embedPreparedInputs(inputs: string[]) {
  const embeddings: number[][] = [];

  for (let offset = 0; offset < inputs.length; offset += EMBEDDING_CONCURRENCY) {
    const batch = inputs.slice(offset, offset + EMBEDDING_CONCURRENCY);
    embeddings.push(...(await Promise.all(batch.map(embedPreparedInput))));
  }

  return embeddings;
}

export function embedDocuments(texts: string[]) {
  return embedPreparedInputs(texts.map(prepareSearchDocument));
}

export function embedQueries(queries: string[]) {
  return embedPreparedInputs(queries.map(prepareSearchQuery));
}

export async function embedQuery(query: string) {
  const [embedding] = await embedQueries([query]);
  if (!embedding) throw new Error("The query could not be embedded.");
  return embedding;
}
