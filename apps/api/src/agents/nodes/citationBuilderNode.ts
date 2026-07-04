import { Citation, FilingLensState } from "../state.js";
import { runNode } from "./nodeUtils.js";

export async function citationBuilderNode(state: FilingLensState): Promise<FilingLensState> {
  return runNode("citationBuilderNode", state, async () => {
    const citations = buildCitations(state);

    return {
      ...state,
      citations
    };
  });
}

function buildCitations(state: FilingLensState): Citation[] {
  const citationsByChunk = new Map<string, Citation>();

  for (const fact of state.extractedFacts) {
    const chunk = state.retrievedChunks.find((candidate) => candidate.chunkId === fact.sourceChunkId);

    if (!chunk) {
      continue;
    }

    const existing = citationsByChunk.get(chunk.chunkId);

    if (existing) {
      existing.supports.push(fact.id);
      continue;
    }

    citationsByChunk.set(chunk.chunkId, {
      id: `C${citationsByChunk.size + 1}`,
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      pageNumber: chunk.pageNumber,
      bbox: chunk.bbox,
      supports: [fact.id]
    });
  }

  for (const calculation of state.calculations) {
    for (const input of calculation.inputs) {
      const fact = state.extractedFacts.find((candidate) => candidate.id === input.factId);

      if (!fact) {
        continue;
      }

      const citation = citationsByChunk.get(fact.sourceChunkId);
      citation?.supports.push(calculation.id);
    }
  }

  return Array.from(citationsByChunk.values());
}

