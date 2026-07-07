"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, Database, FileUp, MessageSquare, ShieldCheck } from "lucide-react";
import { AppShell, PageHeader } from "../../components/shell";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import { fetchDocuments } from "../../lib/api";
import { compactNumber, formatDate } from "../../lib/format";
import { DocumentRecord } from "../../lib/types";

export default function DashboardPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments()
      .then(setDocuments)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const totalPages = documents.reduce((sum, document) => sum + document.pageCount, 0);
    const chatHref = documents.length > 0 ? `/chat/${documents[0].id}` : "/chat";
    return {
      items: [
        { label: "Indexed documents", value: documents.length, detail: "Active corpus" },
        { label: "Total pages", value: compactNumber(totalPages), detail: "Extracted pages" },
        { label: "Verified answers", value: "Ready", detail: "LangGraph verifier" },
        { label: "Citation quality", value: "Structured", detail: "Page and bbox references" }
      ],
      chatHref
    };
  }, [documents]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Analyst command center"
        title="Research operations"
        description="Monitor filing ingestion, retrieval health, agent answers, and evaluation readiness from one workspace."
        actions={
          <>
            <Link href="/documents">
              <Button variant="secondary">
                <Database size={16} />
                Browse documents
              </Button>
            </Link>
            <Link href={stats.chatHref}>
              <Button>
                <MessageSquare size={16} />
                Ask agent
              </Button>
            </Link>
          </>
        }
      />

      {error ? <ErrorState message={`API unavailable: ${error}`} /> : null}

      <section className="stat-grid">
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <Card key={index}>
                <Skeleton lines={3} />
              </Card>
            ))
          : stats.items.map((stat) => (
              <Card key={stat.label} className="metric-card">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <small>{stat.detail}</small>
              </Card>
            ))}
      </section>

      <section className="dashboard-grid">
        <Card className="panel-large">
          <div className="section-title">
            <div>
              <h2>Indexed documents</h2>
              <p>Most recent filings available to the retrieval and agent graph.</p>
            </div>
            <Badge tone="green">Live</Badge>
          </div>
          {documents.length === 0 && !loading ? (
            <EmptyState
              title="No documents indexed"
              description="Upload a filing through the API to populate this workspace."
              action={
                <Link href="/documents">
                  <Button variant="secondary">Open documents</Button>
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Company</th>
                    <th>Pages</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.slice(0, 6).map((document) => (
                    <tr key={document.id}>
                      <td>
                        <Link href={`/documents/${document.id}`}>{document.originalFilename}</Link>
                      </td>
                      <td>{document.companyName ?? document.ticker ?? "Unassigned"}</td>
                      <td>{document.pageCount}</td>
                      <td>
                        <Badge tone="green">Indexed</Badge>
                      </td>
                      <td>{formatDate(document.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <div className="section-title">
            <h2>Quick actions</h2>
          </div>
          <div className="action-list">
            <Link href="/documents" className="action-row">
              <FileUp size={18} />
              Upload or inspect filings
              <ArrowRight size={16} />
            </Link>
            <Link href={stats.chatHref} className="action-row">
              <MessageSquare size={18} />
              Ask a verified question
              <ArrowRight size={16} />
            </Link>
            <Link href="/evals" className="action-row">
              <ShieldCheck size={18} />
              Review evaluation quality
              <ArrowRight size={16} />
            </Link>
          </div>
        </Card>

        <Card>
          <div className="section-title">
            <h2>Recent activity</h2>
          </div>
          <div className="timeline">
            {documents.slice(0, 4).map((document) => (
              <div className="timeline-item" key={document.id}>
                <Activity size={16} />
                <div>
                  <strong>{document.originalFilename}</strong>
                  <span>{formatDate(document.createdAt)} - {document.pageCount} pages indexed</span>
                </div>
              </div>
            ))}
            {documents.length === 0 ? <p className="muted">Activity will appear after ingestion.</p> : null}
          </div>
        </Card>
      </section>
    </AppShell>
  );
}

