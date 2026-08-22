const MAX_EMBEDDING_INPUT_CHARACTERS = 8_000;

function normalizeEmbeddingInput(text: string) {
  const normalized = text.trim();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_EMBEDDING_INPUT_CHARACTERS
  ) {
    throw new Error(
      "Embedding input must contain between 1 and 8,000 characters.",
    );
  }

  return normalized;
}

export function prepareSearchDocument(text: string) {
  return `title: video scene | text: ${normalizeEmbeddingInput(text)}`;
}

export function prepareSearchQuery(query: string) {
  return `task: search result | query: ${normalizeEmbeddingInput(query)}`;
}
