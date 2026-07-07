"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { BookOpen, Loader2, MessageSquare, Rows3, Sparkles } from "lucide-react";
import { CitationCard } from "../../../components/citation";
import { PagePreview } from "../../../components/page-preview";
import { AppShell, PageHeader } from "../../../components/shell";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "../../../components/ui";
import { extractDocument, fetchDocument, fetchDocumentChunks } from "../../../lib/api";
import { formatBytes, formatDate } from "../../../lib/format";
import { Citation, DocumentChunk, DocumentRecord } from "../../../lib/types";

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<number | null>(null);
  const loading = loadedId !== id;

  useEffect(() => {
    let active = true;

    Promise.all([fetchDocument(id), fetchDocumentChunks(id)])
      .then(([documentRecord, documentChunks]) => {
        if (!active) return;
        setDocument(documentRecord);
        setChunks(documentChunks);
        setActivePage(documentChunks[0]?.pageNumber ?? null);
        setError(null);
        setLoadedId(id);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
        setLoadedId(id);
      });

    return () => {
      active = false;
    };
  }, [id]);

  async function handleExtract() {
    setExtracting(true);
    setError(null);

    try {
      await extractDocument(id);
      const [documentRecord, documentChunks] = await Promise.all([
        fetchDocument(id),
        fetchDocumentChunks(id)
      ]);
      setDocument(documentRecord);
      setChunks(documentChunks);
      setActivePage(documentChunks[0]?.pageNumber ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setExtracting(false);
    }
  }

  const chunkCounts = useMemo(() => {
    return chunks.reduce<Record<string, number>>((counts, chunk) => {
      counts[chunk.chunkType] = (counts[chunk.chunkType] ?? 0) + 1;
      return counts;
    }, {});
  }, [chunks]);

  const citations: Citation[] = chunks.slice(0, 6).map((chunk, index) => ({
    id: `C${index + 1}`,
    chunkId: `chunk_${chunk.id}`,
    documentId: `doc_${chunk.documentId}`,
    pageNumber: chunk.pageNumber,
    bbox: [chunk.bbox.x0, chunk.bbox.y0, chunk.bbox.x1, chunk.bbox.y1],
    supports: [`chunk_${chunk.id}`]
  }));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Document detail"
        title={document?.originalFilename ?? `Document ${id}`}
        description="Inspect metadata, extraction output, chunk distribution, and citation-ready regions."
        actions={
          <>
            {chunks.length === 0 ? (
              <Button onClick={handleExtract} disabled={extracting}>
                {extracting ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                {extracting ? "Extracting..." : "Run extraction"}
              </Button>
            ) : null}
            <Link href={`/chat/${id}`}>
              <Button variant={chunks.length === 0 ? "secondary" : "primary"}>
                <MessageSquare size={16} />
                Ask about this filing
              </Button>
            </Link>
          </>
        }
      />

      {error ? <ErrorState message={`Could not load document: ${error}`} /> : null}

      {loading ? (
        <Card>
          <Skeleton lines={8} />
        </Card>
      ) : document ? (
        <>
          <section className="stat-grid">
            <Card className="metric-card">
              <span>Pages</span>
              <strong>{document.pageCount}</strong>
              <small>PDF page count</small>
            </Card>
            <Card className="metric-card">
              <span>Chunks</span>
              <strong>{chunks.length}</strong>
              <small>Extracted regions</small>
            </Card>
            <Card className="metric-card">
              <span>Index status</span>
              <strong>{chunks.length > 0 ? "Ready" : "Pending"}</strong>
              <small>{chunks.length > 0 ? "Embeddings and FTS" : "Run extraction to index"}</small>
            </Card>
            <Card className="metric-card">
              <span>File size</span>
              <strong>{formatBytes(document.fileSize)}</strong>
              <small>{formatDate(document.createdAt)}</small>
            </Card>
          </section>

          <section className="document-detail-grid">
            <Card>
              <div className="section-title">
                <h2>Metadata</h2>
              </div>
              <dl className="metadata-list">
                <div><dt>Company</dt><dd>{document.companyName ?? "Unknown"}</dd></div>
                <div><dt>Ticker</dt><dd>{document.ticker ?? "Unassigned"}</dd></div>
                <div><dt>Filing type</dt><dd>{document.filingType ?? "Unclassified"}</dd></div>
                <div><dt>Source</dt><dd>{document.source ?? "manual_upload"}</dd></div>
                <div><dt>MIME type</dt><dd>{document.mimeType}</dd></div>
              </dl>
            </Card>

            <Card>
              <div className="section-title">
                <h2>Document statistics</h2>
              </div>
              <div className="chip-grid">
                {Object.entries(chunkCounts).map(([type, count]) => (
                  <span className="chip" key={type}>
                    {type}
                    <strong>{count}</strong>
                  </span>
                ))}
              </div>
            </Card>

            <Card className="panel-large">
              <div className="section-title">
                <div>
                  <h2>Page preview</h2>
                  <p>Rendered PDF page with extracted region overlays from the current chunk selection.</p>
                </div>
                {activePage ? <Badge tone="blue">Page {activePage}</Badge> : null}
              </div>
              {activePage ? (
                <PagePreview documentId={id} pageNumber={activePage} chunks={chunks} />
              ) : (
                <div className="page-preview">
                  <BookOpen size={28} />
                  <span>No page selected</span>
                </div>
              )}
            </Card>

            <Card className="panel-large">
              <div className="section-title">
                <h2>Extracted chunks</h2>
                <Badge>{chunks.length} chunks</Badge>
              </div>
              {chunks.length === 0 ? (
                <EmptyState
                  title="No chunks found"
                  description="Run extraction to parse PDF regions, generate embeddings, and enable retrieval."
                  action={
                    <Button onClick={handleExtract} disabled={extracting}>
                      {extracting ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                      {extracting ? "Extracting..." : "Run extraction"}
                    </Button>
                  }
                />
              ) : (
                <div className="chunk-list">
                  {chunks.slice(0, 20).map((chunk) => (
                    <button className="chunk-row" key={chunk.id} onClick={() => setActivePage(chunk.pageNumber)}>
                      <Rows3 size={16} />
                      <div>
                        <div>
                          <Badge>{chunk.chunkType}</Badge>
                          <span className="muted">Page {chunk.pageNumber}</span>
                        </div>
                        <p>{chunk.content}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div className="section-title">
                <h2>Citation overview</h2>
              </div>
              <div className="citation-stack">
                {citations.map((citation) => {
                  const chunk = chunks.find((item) => `chunk_${item.id}` === citation.chunkId);
                  return (
                    <CitationCard
                      key={citation.id}
                      citation={citation}
                      regionType={chunk?.chunkType}
                      onJump={setActivePage}
                    />
                  );
                })}
              </div>
            </Card>
          </section>
        </>
      ) : (
        <EmptyState title="Document not found" description="The selected filing could not be loaded." />
      )}
    </AppShell>
  );
}
