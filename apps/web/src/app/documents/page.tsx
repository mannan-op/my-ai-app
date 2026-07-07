"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, FilePlus, Filter, Search } from "lucide-react";
import { AppShell, PageHeader } from "../../components/shell";
import { UploadDialog } from "../../components/upload-dialog";
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton } from "../../components/ui";
import { fetchDocuments } from "../../lib/api";
import { formatBytes } from "../../lib/format";
import { DocumentRecord } from "../../lib/types";

type SortKey = "createdAt" | "pageCount" | "originalFilename";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  useEffect(() => {
    fetchDocuments()
      .then(setDocuments)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return documents
      .filter((document) => {
        const haystack = [
          document.originalFilename,
          document.companyName,
          document.ticker,
          document.filingType,
          document.source
        ]
          .join(" ")
          .toLowerCase();
        const matchesQuery = haystack.includes(query.toLowerCase());
        const matchesType = typeFilter === "all" || document.filingType === typeFilter;
        return matchesQuery && matchesType;
      })
      .sort((a, b) => {
        if (sortKey === "createdAt") return Date.parse(b.createdAt) - Date.parse(a.createdAt);
        if (sortKey === "pageCount") return b.pageCount - a.pageCount;
        return a.originalFilename.localeCompare(b.originalFilename);
      });
  }, [documents, query, sortKey, typeFilter]);

  const filingTypes = Array.from(new Set(documents.map((document) => document.filingType).filter(Boolean)));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Document corpus"
        title="Filings and source material"
        description="Search, filter, and inspect the documents available to retrieval, citation, and agent workflows."
        actions={
          <Button onClick={() => setUploadOpen(true)}>
            <FilePlus size={16} />
            Upload
          </Button>
        }
      />

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onUploaded={(document) => setDocuments((current) => [document, ...current])}
      />

      {error ? <ErrorState message={`Could not load documents: ${error}`} /> : null}

      <Card className="toolbar-card">
        <label className="search-control">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search filename, ticker, company, filing type"
          />
        </label>
        <label className="select-control">
          <Filter size={16} />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">All filing types</option>
            {filingTypes.map((type) => (
              <option key={type} value={type ?? ""}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="select-control">
          <ArrowUpDown size={16} />
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
            <option value="createdAt">Newest first</option>
            <option value="pageCount">Most pages</option>
            <option value="originalFilename">Filename</option>
          </select>
        </label>
      </Card>

      <Card>
        {loading ? (
          <Skeleton lines={8} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No matching documents"
            description="Adjust your filters or upload a filing to begin analysis."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Metadata</th>
                  <th>Pages</th>
                  <th>Size</th>
                  <th>Processing</th>
                  <th>Indexed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((document) => (
                  <tr key={document.id}>
                    <td>
                      <Link href={`/documents/${document.id}`} className="strong-link">
                        {document.originalFilename}
                      </Link>
                      <div className="muted">ID doc_{document.id}</div>
                    </td>
                    <td>
                      <div>{document.companyName ?? "Unknown company"}</div>
                      <div className="muted">
                        {[document.ticker, document.filingType].filter(Boolean).join(" / ") || "No metadata"}
                      </div>
                    </td>
                    <td>{document.pageCount}</td>
                    <td>{formatBytes(document.fileSize)}</td>
                    <td>
                      <Badge tone="blue">Uploaded</Badge>
                    </td>
                    <td>
                      <Badge tone="green">Ready for extract</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
