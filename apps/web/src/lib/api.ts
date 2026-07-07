import {
  AgentState,
  AgentStreamEvent,
  DocumentChunk,
  DocumentRecord,
  EvaluationResults,
  EvaluationRunStatus,
  ExtractSummary,
  HealthStatus
} from "./types";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type UploadDocumentInput = {
  file: File;
  filingType?: string;
  ticker?: string;
  companyName?: string;
  source?: string;
};

export function getDocumentPageUrl(documentId: string | number, pageNumber: number): string {
  return `${apiBaseUrl}/documents/${documentId}/pages/${pageNumber}`;
}

export async function fetchDocuments(): Promise<DocumentRecord[]> {
  return apiGet<DocumentRecord[]>("/documents");
}

export async function fetchDocument(id: string): Promise<DocumentRecord> {
  return apiGet<DocumentRecord>(`/documents/${id}`);
}

export async function fetchDocumentChunks(id: string, page?: number): Promise<DocumentChunk[]> {
  const query = page ? `?page=${page}` : "";
  return apiGet<DocumentChunk[]>(`/documents/${id}/chunks${query}`);
}

export async function fetchHealth(): Promise<HealthStatus> {
  return apiGet<HealthStatus>("/health");
}

export async function uploadDocument(input: UploadDocumentInput): Promise<DocumentRecord> {
  const formData = new FormData();
  formData.append("file", input.file);

  if (input.filingType) formData.append("filingType", input.filingType);
  if (input.ticker) formData.append("ticker", input.ticker);
  if (input.companyName) formData.append("companyName", input.companyName);
  if (input.source) formData.append("source", input.source);

  const response = await fetch(`${apiBaseUrl}/documents/upload`, {
    method: "POST",
    body: formData
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Upload failed with ${response.status}`);
  }

  return response.json() as Promise<DocumentRecord>;
}

export async function extractDocument(id: string): Promise<ExtractSummary> {
  const response = await fetch(`${apiBaseUrl}/documents/${id}/extract`, {
    method: "POST"
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Extraction failed with ${response.status}`);
  }

  return response.json() as Promise<ExtractSummary>;
}

export async function askAgent(documentId: string, question: string): Promise<AgentState> {
  const response = await fetch(`${apiBaseUrl}/agent/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      document_id: documentId,
      question
    })
  });

  if (!response.ok) {
    throw new Error(`Agent request failed with ${response.status}`);
  }

  return response.json() as Promise<AgentState>;
}

export async function* askAgentStream(
  documentId: string,
  question: string,
  signal?: AbortSignal
): AsyncGenerator<AgentStreamEvent> {
  const response = await fetch(`${apiBaseUrl}/agent/ask/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson"
    },
    body: JSON.stringify({
      document_id: documentId,
      question
    }),
    signal
  });

  if (!response.ok || !response.body) {
    throw new Error(`Agent stream failed with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line) {
        yield JSON.parse(line) as AgentStreamEvent;
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  const trailing = buffer.trim();
  if (trailing) {
    yield JSON.parse(trailing) as AgentStreamEvent;
  }
}

export async function fetchEvaluationResults(): Promise<EvaluationResults> {
  return apiGet<EvaluationResults>("/evaluations/results");
}

export async function fetchEvaluationStatus(): Promise<EvaluationRunStatus> {
  return apiGet<EvaluationRunStatus>("/evaluations/status");
}

export async function startEvaluationRun(evaluationId?: string): Promise<EvaluationRunStatus> {
  const response = await fetch(`${apiBaseUrl}/evaluations/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(evaluationId ? { evaluation_id: evaluationId } : {})
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Could not start evaluation (${response.status})`);
  }

  return response.json() as Promise<EvaluationRunStatus>;
}

async function apiGet<T>(path: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      cache: "no-store"
    });
  } catch (error) {
    throw new Error(formatNetworkError(error));
  }

  if (!response.ok) {
    throw new Error(`API request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function formatNetworkError(error: unknown): string {
  const message = error instanceof Error ? error.message : "Network request failed";

  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return `Cannot reach the API at ${apiBaseUrl}. Start the backend with "pnpm dev:api" (after Postgres with pgvector is running) or "docker compose up postgres api".`;
  }

  return message;
}
