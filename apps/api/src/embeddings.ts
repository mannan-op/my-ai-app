import crypto from "node:crypto";

export type EmbeddingProvider = {
  model: string;
  dimensions: number;
  embed(texts: string[]): Promise<number[][]>;
};

const configuredDimensions = Number(process.env.EMBEDDING_DIMENSIONS ?? 384);

export const embeddingDimensions =
  Number.isInteger(configuredDimensions) && configuredDimensions > 0 ? configuredDimensions : 384;

export function getEmbeddingModelName(): string {
  if (process.env.EMBEDDING_PROVIDER === "openai") {
    return process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  }

  return process.env.EMBEDDING_MODEL ?? "deterministic-hash-v1";
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([text]);
  return embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  return getEmbeddingProvider().embed(texts);
}

export function embeddingToSqlVector(embedding: number[]): string {
  return `[${embedding.map((value) => Number(value).toFixed(8)).join(",")}]`;
}

function getEmbeddingProvider(): EmbeddingProvider {
  if (process.env.EMBEDDING_PROVIDER === "openai") {
    return openAiEmbeddingProvider();
  }

  return deterministicEmbeddingProvider();
}

function deterministicEmbeddingProvider(): EmbeddingProvider {
  return {
    model: getEmbeddingModelName(),
    dimensions: embeddingDimensions,
    async embed(texts: string[]) {
      return texts.map((text) => deterministicEmbedding(text, embeddingDimensions));
    }
  };
}

function deterministicEmbedding(text: string, dimensions: number): number[] {
  const vector = Array.from({ length: dimensions }, () => 0);
  const tokens = text.toLowerCase().match(/[a-z0-9$&.-]+/g) ?? [];

  for (const token of tokens) {
    const digest = crypto.createHash("sha256").update(token).digest();
    const index = digest.readUInt32BE(0) % dimensions;
    const sign = digest[4] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));

  if (norm === 0) {
    return vector;
  }

  return vector.map((value) => value / norm);
}

function openAiEmbeddingProvider(): EmbeddingProvider {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when EMBEDDING_PROVIDER=openai");
  }

  const model = getEmbeddingModelName();

  return {
    model,
    dimensions: embeddingDimensions,
    async embed(texts: string[]) {
      const body: Record<string, unknown> = {
        model,
        input: texts
      };

      if (process.env.OPENAI_EMBEDDING_DIMENSIONS) {
        body.dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS);
      }

      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Embedding provider returned ${response.status}`);
      }

      const result = (await response.json()) as {
        data?: Array<{ embedding?: number[]; index?: number }>;
      };

      const embeddings = result.data
        ?.slice()
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map((item) => item.embedding);

      if (!embeddings || embeddings.length !== texts.length || embeddings.some((item) => !item)) {
        throw new Error("Embedding provider returned an invalid response");
      }

      return embeddings as number[][];
    }
  };
}
