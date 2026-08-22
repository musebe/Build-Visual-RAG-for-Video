import "server-only";

import OpenAI from "openai";

import { getServerEnv } from "@/lib/config/env";

export const EMBEDDING_DIMENSIONS = 1_536;
const EMBEDDING_BATCH_SIZE = 100;

let client: OpenAI | undefined;

function getOpenAI() {
  if (!client) {
    client = new OpenAI({ apiKey: getServerEnv().OPENAI_API_KEY });
  }
  return client;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const model = getServerEnv().OPENAI_EMBEDDING_MODEL;
  const embeddings: number[][] = [];

  for (let offset = 0; offset < texts.length; offset += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(offset, offset + EMBEDDING_BATCH_SIZE).map((text) => text.trim());
    if (batch.some((text) => text.length === 0 || text.length > 8_000)) {
      throw new Error("Embedding input must contain between 1 and 8,000 characters.");
    }

    const response = await getOpenAI().embeddings.create({
      model,
      input: batch,
      encoding_format: "float",
    });

    const ordered = [...response.data].sort((left, right) => left.index - right.index);
    if (
      ordered.length !== batch.length ||
      ordered.some((item) => item.embedding.length !== EMBEDDING_DIMENSIONS)
    ) {
      throw new Error("The embedding provider returned an unexpected vector shape.");
    }

    embeddings.push(...ordered.map((item) => item.embedding));
  }

  return embeddings;
}

export async function embedQuery(query: string) {
  const [embedding] = await embedTexts([query]);
  if (!embedding) throw new Error("The query could not be embedded.");
  return embedding;
}

