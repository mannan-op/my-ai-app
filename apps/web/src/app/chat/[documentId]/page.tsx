"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Clipboard,
  Loader2,
  Pause,
  RefreshCcw,
  Send,
  ShieldAlert,
  ShieldCheck
} from "lucide-react";
import { CitationCard } from "../../../components/citation";
import { PagePreview } from "../../../components/page-preview";
import { AppShell, PageHeader } from "../../../components/shell";
import { Badge, Button, Card, EmptyState, ErrorState } from "../../../components/ui";
import { askAgentStream, fetchDocument, fetchDocumentChunks } from "../../../lib/api";
import { formatPercent } from "../../../lib/format";
import { AgentState, AgentStreamStage, DocumentChunk, DocumentRecord } from "../../../lib/types";

const PIPELINE_STAGES: Array<{ id: AgentStreamStage; label: string }> = [
  { id: "planner", label: "Plan" },
  { id: "retriever", label: "Retrieve" },
  { id: "numeric_analyst", label: "Analyze" },
  { id: "verifier", label: "Verify" },
  { id: "citation_generator", label: "Cite" },
  { id: "final_answer", label: "Answer" }
];

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  state?: AgentState;
  streaming?: boolean;
};

function createEmptyAgentState(question: string, documentId: string): AgentState {
  return {
    question,
    documentId,
    retrievedChunks: [],
    extractedFacts: [],
    calculations: [],
    citations: [],
    errors: []
  };
}

function mergeStreamState(current: AgentState | null, data: Partial<AgentState>): AgentState {
  return {
    ...(current ?? createEmptyAgentState("", "")),
    ...data
  };
}

export default function ChatPage({ params }: { params: Promise<{ documentId: string }> }) {
  const { documentId } = use(params);
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [prompt, setPrompt] = useState("What are the most important financial changes?");
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeState, setActiveState] = useState<AgentState | null>(null);
  const [completedStages, setCompletedStages] = useState<AgentStreamStage[]>([]);
  const [activeStage, setActiveStage] = useState<AgentStreamStage | null>(null);
  const [previewPage, setPreviewPage] = useState<number | null>(null);
  const [previewChunks, setPreviewChunks] = useState<DocumentChunk[]>([]);
  const [loadedPreviewKey, setLoadedPreviewKey] = useState<string | null>(null);
  const previewKey = previewPage ? `${documentId}:${previewPage}` : null;
  const activePreviewChunks = loadedPreviewKey === previewKey ? previewChunks : [];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchDocument(documentId).then(setDocument).catch(() => setDocument(null));
  }, [documentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!previewPage) {
      return;
    }

    let active = true;

    fetchDocumentChunks(documentId, previewPage)
      .then((chunks) => {
        if (!active) return;
        setPreviewChunks(chunks);
        setLoadedPreviewKey(`${documentId}:${previewPage}`);
      })
      .catch(() => {
        if (!active) return;
        setPreviewChunks([]);
        setLoadedPreviewKey(`${documentId}:${previewPage}`);
      });

    return () => {
      active = false;
    };
  }, [documentId, previewPage]);

  async function submitQuestion(question = prompt) {
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    const normalizedDocumentId = documentId.startsWith("doc_") ? documentId : `doc_${documentId}`;
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    setError(null);
    setLoading(true);
    setCompletedStages([]);
    setActiveStage("planner");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
      { id: "streaming", role: "assistant", content: "", streaming: true }
    ]);

    let streamedState: AgentState | null = createEmptyAgentState(trimmed, normalizedDocumentId);

    try {
      for await (const event of askAgentStream(
        normalizedDocumentId,
        trimmed,
        abortControllerRef.current.signal
      )) {
        if (event.type === "run_start") {
          setActiveStage("planner");
        }

        if (event.type === "stage_complete") {
          streamedState = mergeStreamState(streamedState, event.data);
          setActiveState(streamedState);
          setCompletedStages((current) =>
            current.includes(event.stage) ? current : [...current, event.stage]
          );
          setActiveStage(nextStage(event.stage));
        }

        if (event.type === "answer_token") {
          setMessages((current) =>
            current.map((message) =>
              message.id === "streaming"
                ? { ...message, content: message.content + event.token, streaming: true }
                : message
            )
          );
        }

        if (event.type === "done") {
          streamedState = event.state;
          setActiveState(event.state);
          setCompletedStages(PIPELINE_STAGES.map((stage) => stage.id));
          setActiveStage(null);
          setMessages((current) =>
            current.map((message) =>
              message.id === "streaming"
                ? {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: event.state.finalAnswer ?? "No final answer was produced.",
                    state: event.state,
                    streaming: false
                  }
                : message
            )
          );
        }

        if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setMessages((current) =>
          current.map((message) =>
            message.id === "streaming"
              ? {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  content: message.content || "Response stopped.",
                  state: streamedState ?? undefined,
                  streaming: false
                }
              : message
          )
        );
        return;
      }

      setError(err instanceof Error ? err.message : "Agent request failed");
      setMessages((current) => current.filter((message) => message.id !== "streaming"));
    } finally {
      setLoading(false);
      setActiveStage(null);
      abortControllerRef.current = null;
    }
  }

  function stopStreaming() {
    abortControllerRef.current?.abort();
    setLoading(false);
  }

  const verificationTone = activeState?.verification?.passed
    ? "green"
    : activeState?.verification
      ? "amber"
      : "neutral";
  const verificationLabel = activeState?.verification?.passed
    ? "Verified"
    : activeState?.verification
      ? "Needs review"
      : "Waiting";

  return (
    <AppShell>
      <PageHeader
        eyebrow="Research assistant"
        title={document?.originalFilename ?? `Document ${documentId}`}
        description="Ask filing-specific questions with retrieved sources, structured citations, deterministic calculations, and verification status."
        actions={
          <Badge tone={verificationTone}>
            {activeState?.verification?.passed ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            {verificationLabel}
          </Badge>
        }
      />

      {error ? <ErrorState message={error} /> : null}

      <section className="chat-layout">
        <Card className="chat-panel">
          <PipelineProgress completedStages={completedStages} activeStage={activeStage} />
          <div className="message-list" aria-live="polite">
            {messages.length === 0 ? (
              <EmptyState
                title="Ask a filing question"
                description="Try revenue changes, risk factors, cash flow, segment performance, or citation-specific checks."
              />
            ) : (
              messages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  <div className="message-label">{message.role === "user" ? "You" : "FilingLens"}</div>
                  <MarkdownLite text={message.content} />
                  {message.streaming ? (
                    <span className="stream-indicator">
                      <Loader2 size={14} />
                      streaming
                    </span>
                  ) : null}
                  {message.role === "assistant" && message.state ? (
                    <div className="answer-actions">
                      <Button variant="ghost" onClick={() => navigator.clipboard?.writeText(message.content)}>
                        <Clipboard size={14} />
                        Copy answer
                      </Button>
                      <Button variant="ghost" onClick={() => submitQuestion(messages.findLast((m) => m.role === "user")?.content ?? prompt)}>
                        <RefreshCcw size={14} />
                        Regenerate
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              submitQuestion();
            }}
          >
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  submitQuestion();
                }
              }}
              placeholder="Ask about revenue, risk factors, tables, or calculation-backed answers..."
              rows={3}
            />
            <div className="composer-actions">
              <span className="muted">Ctrl Enter to send</span>
              {loading ? (
                <Button type="button" variant="secondary" onClick={stopStreaming}>
                  <Pause size={16} />
                  Stop
                </Button>
              ) : null}
              <Button type="submit" disabled={loading}>
                <Send size={16} />
                Send
              </Button>
            </div>
          </form>
        </Card>

        <aside className="evidence-panel">
          {previewPage ? (
            <Card>
              <div className="section-title">
                <h2>Page preview</h2>
                <Badge tone="blue">Page {previewPage}</Badge>
              </div>
              <PagePreview documentId={documentId} pageNumber={previewPage} chunks={activePreviewChunks} />
            </Card>
          ) : null}
          <VerificationPanel state={activeState} />
          <SourcePanel state={activeState} />
          <CalculationPanel state={activeState} />
          <CitationPanel state={activeState} onJump={setPreviewPage} />
        </aside>
      </section>
    </AppShell>
  );
}

function VerificationPanel({ state }: { state: AgentState | null }) {
  const verification = state?.verification;
  const icon = verification?.passed ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />;

  return (
    <Card>
      <div className="section-title">
        <h2>Verification</h2>
        <Badge tone={verification?.passed ? "green" : verification ? "amber" : "neutral"}>{icon}{verification?.passed ? "Verified" : "Needs review"}</Badge>
      </div>
      {verification ? (
        <div className="stack">
          <div className="confidence-bar">
            <span style={{ width: `${verification.confidence * 100}%` }} />
          </div>
          <p className="muted">Confidence {formatPercent(verification.confidence)}</p>
          {[...verification.missingEvidence, ...verification.unsupportedClaims, ...verification.warnings].map((item) => (
            <div key={item} className="alert-line">{item}</div>
          ))}
        </div>
      ) : (
        <p className="muted">Verification status appears after the first answer.</p>
      )}
    </Card>
  );
}

function SourcePanel({ state }: { state: AgentState | null }) {
  return (
    <Card>
      <div className="section-title">
        <h2>Source chunks</h2>
        <Badge>{state?.retrievedChunks.length ?? 0}</Badge>
      </div>
      <div className="source-list">
        {state?.retrievedChunks.slice(0, 8).map((chunk) => (
          <details key={chunk.chunkId} className="source-details">
            <summary>
              <span>Page {chunk.pageNumber}</span>
              <Badge>{chunk.regionType}</Badge>
              <small>{chunk.score.toFixed(2)}</small>
            </summary>
            <p>{chunk.content}</p>
          </details>
        ))}
        {!state ? <p className="muted">Retrieved chunks will appear here.</p> : null}
      </div>
    </Card>
  );
}

function CalculationPanel({ state }: { state: AgentState | null }) {
  return (
    <Card>
      <div className="section-title">
        <h2>Calculations</h2>
        <Badge>{state?.calculations.length ?? 0}</Badge>
      </div>
      {state?.calculations.length ? (
        <div className="stack">
          {state.calculations.map((calculation) => (
            <details key={calculation.id} className="source-details" open>
              <summary>{calculation.description}</summary>
              <div className="calc-result">
                {calculation.result.toFixed(2)} {calculation.unit ?? ""}
              </div>
              <ul>
                {calculation.inputs.map((input) => (
                  <li key={input.factId}>{input.factId}: {input.value}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      ) : (
        <p className="muted">No deterministic calculation has been produced yet.</p>
      )}
    </Card>
  );
}

function CitationPanel({
  state,
  onJump
}: {
  state: AgentState | null;
  onJump: (pageNumber: number) => void;
}) {
  const chunkById = useMemo(() => new Map(state?.retrievedChunks.map((chunk) => [chunk.chunkId, chunk])), [state]);

  return (
    <Card>
      <div className="section-title">
        <h2>Citations</h2>
        <Badge>{state?.citations.length ?? 0}</Badge>
      </div>
      <div className="citation-stack">
        {state?.citations.map((citation) => {
          const chunk = chunkById.get(citation.chunkId);
          return (
            <CitationCard
              key={citation.id}
              citation={citation}
              regionType={chunk?.regionType}
              score={chunk?.score}
              onJump={onJump}
            />
          );
        })}
        {!state ? <p className="muted">Page citations will appear after an answer.</p> : null}
      </div>
    </Card>
  );
}

function PipelineProgress({
  completedStages,
  activeStage
}: {
  completedStages: AgentStreamStage[];
  activeStage: AgentStreamStage | null;
}) {
  if (completedStages.length === 0 && !activeStage) {
    return null;
  }

  return (
    <div className="pipeline-progress" aria-label="Agent pipeline progress">
      {PIPELINE_STAGES.map((stage) => {
        const completed = completedStages.includes(stage.id);
        const active = activeStage === stage.id;

        return (
          <span
            key={stage.id}
            className={completed ? "pipeline-step completed" : active ? "pipeline-step active" : "pipeline-step"}
          >
            {completed ? <CheckCircle2 size={14} /> : active ? <Loader2 size={14} className="spin" /> : null}
            {stage.label}
          </span>
        );
      })}
    </div>
  );
}

function nextStage(stage: AgentStreamStage): AgentStreamStage | null {
  const index = PIPELINE_STAGES.findIndex((item) => item.id === stage);
  return index >= 0 && index < PIPELINE_STAGES.length - 1 ? PIPELINE_STAGES[index + 1].id : null;
}

function MarkdownLite({ text }: { text: string }) {
  return (
    <div className="markdown-lite">
      {text.split("\n").map((line, index) => {
        if (line.startsWith("### ")) return <h3 key={index}>{line.replace("### ", "")}</h3>;
        if (line.startsWith("- ")) return <p key={index}>• {line.replace("- ", "")}</p>;
        if (line.trim() === "") return <br key={index} />;
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}
