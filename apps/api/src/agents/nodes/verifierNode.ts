import { FilingLensState, VerificationResult } from "../state.js";
import { runNode } from "./nodeUtils.js";

export async function verifierNode(state: FilingLensState): Promise<FilingLensState> {
  return runNode("verifierNode", state, async () => {
    const verification = verifyState(state);

    return {
      ...state,
      verification
    };
  });
}

function verifyState(state: FilingLensState): VerificationResult {
  const missingEvidence: string[] = [];
  const unsupportedClaims: string[] = [];
  const conflictingEvidence: string[] = [];
  const warnings: string[] = [];

  if (state.retrievedChunks.length === 0) {
    missingEvidence.push("No retrieved chunks were available.");
  }

  if (state.extractedFacts.length === 0) {
    missingEvidence.push("No facts were extracted from retrieved evidence.");
  }

  for (const fact of state.extractedFacts) {
    if (!state.retrievedChunks.some((chunk) => chunk.chunkId === fact.sourceChunkId)) {
      unsupportedClaims.push(`Fact ${fact.id} does not reference a retrieved chunk.`);
    }
  }

  if (state.plan?.needsCalculation && state.calculations.length === 0) {
    warnings.push("The plan required calculation, but not enough numeric facts were found.");
  }

  for (const calculation of state.calculations) {
    const missingInput = calculation.inputs.find(
      (input) => !state.extractedFacts.some((fact) => fact.id === input.factId && fact.value === input.value)
    );

    if (missingInput) {
      unsupportedClaims.push(`Calculation ${calculation.id} uses missing fact ${missingInput.factId}.`);
    }
  }

  const passed = missingEvidence.length === 0 && unsupportedClaims.length === 0 && conflictingEvidence.length === 0;
  const confidence = passed ? Math.min(0.95, Math.max(...state.retrievedChunks.map((chunk) => chunk.score), 0.7)) : 0.25;

  return {
    confidence,
    unsupportedClaims,
    missingEvidence,
    conflictingEvidence,
    passed,
    warnings
  };
}

