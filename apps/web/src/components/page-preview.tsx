"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { getDocumentPageUrl } from "../lib/api";
import { DocumentChunk } from "../lib/types";
import { Badge } from "./ui";

type PageDimensions = {
  pageWidth: number;
  pageHeight: number;
};

export function PagePreview({
  documentId,
  pageNumber,
  chunks
}: {
  documentId: string;
  pageNumber: number;
  chunks: DocumentChunk[];
}) {
  const requestKey = `${documentId}:${pageNumber}`;
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<PageDimensions | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pageChunks = useMemo(
    () => chunks.filter((chunk) => chunk.pageNumber === pageNumber),
    [chunks, pageNumber]
  );
  const loading = loadedKey !== requestKey && !error;
  const activeImage = loadedKey === requestKey ? imageUrl : null;
  const activeDimensions = loadedKey === requestKey ? dimensions : null;

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    fetch(getDocumentPageUrl(documentId, pageNumber))
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Could not load page preview (${response.status})`);
        }

        const pageWidth = Number(response.headers.get("X-Page-Width") ?? "0");
        const pageHeight = Number(response.headers.get("X-Page-Height") ?? "0");
        const blob = await response.blob();

        if (!active) return;

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
        setDimensions(pageWidth > 0 && pageHeight > 0 ? { pageWidth, pageHeight } : null);
        setError(null);
        setLoadedKey(requestKey);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
        setImageUrl(null);
        setLoadedKey(requestKey);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, pageNumber, requestKey]);

  if (loading) {
    return (
      <div className="page-preview">
        <Loader2 size={28} className="spin" />
        <span>Rendering page {pageNumber}...</span>
      </div>
    );
  }

  if (error || !activeImage) {
    return (
      <div className="page-preview">
        <span>{error ?? `Page ${pageNumber} preview unavailable`}</span>
      </div>
    );
  }

  return (
    <div className="page-preview-shell">
      <div className="page-preview-frame">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={activeImage} alt={`Page ${pageNumber}`} className="page-preview-image" />
        {activeDimensions
          ? pageChunks.map((chunk) => {
              const left = (chunk.bbox.x0 / activeDimensions.pageWidth) * 100;
              const top = (chunk.bbox.y0 / activeDimensions.pageHeight) * 100;
              const width = ((chunk.bbox.x1 - chunk.bbox.x0) / activeDimensions.pageWidth) * 100;
              const height = ((chunk.bbox.y1 - chunk.bbox.y0) / activeDimensions.pageHeight) * 100;

              return (
                <span
                  key={chunk.id}
                  className={`bbox-overlay bbox-${chunk.chunkType}`}
                  style={{ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}
                  title={chunk.chunkType}
                />
              );
            })
          : null}
      </div>
      <div className="page-preview-meta">
        <Badge tone="blue">Page {pageNumber}</Badge>
        <span className="muted">{pageChunks.length} extracted regions</span>
      </div>
    </div>
  );
}
