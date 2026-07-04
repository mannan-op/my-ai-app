import { searchChunks } from "../../retrieval.js";
import { FilingLensState, RetrievedChunk } from "../state.js";
import { runNode } from "./nodeUtils.js";

export async function retrieverNode(state: FilingLensState): Promise<FilingLensState> {
  return runNode(
    "retrieverNode",
    state,
    async () => {
      const numericDocumentId = parseDocumentId(state.documentId);
      const regionType = state.plan?.requiredEvidenceTypes.length === 1 ? state.plan.requiredEvidenceTypes[0] : undefined;
      const chunks = await searchChunks({
        documentId: numericDocumentId,
        query: buildRetrievalQuery(state),
        topK: 10,
        regionType
      });
      const retrievedChunks = deduplicateChunks(
        chunks.map((chunk) => ({
          chunkId: chunk.chunk_id,
          documentId: chunk.document_id,
          content: chunk.content,
          pageNumber: chunk.page_number,
          bbox: chunk.bbox,
          regionType: chunk.region_type,
          score: chunk.score
        }))
      );

      return {
        ...state,
        retrievedChunks
      };
    },
    { documentId: state.documentId }
  );
}

function buildRetrievalQuery(state: FilingLensState): string {
  const subquestions = state.plan?.subquestions ?? [];
  return [state.question, ...subquestions].join(" ");
}

function deduplicateChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  const byId = new Map<string, RetrievedChunk>();

  for (const chunk of chunks) {
    const existing = byId.get(chunk.chunkId);

    if (!existing || chunk.score > existing.score) {
      byId.set(chunk.chunkId, chunk);
    }
  }

  return Array.from(byId.values()).sort((a, b) => b.score - a.score);
}

function parseDocumentId(documentId: string): number {
  const match = /^(?:doc_)?(\d+)$/.exec(documentId.trim());

  if (!match) {
    throw new Error("documentId must be a numeric ID or doc_<id>");
  }

  return Number(match[1]);
}

