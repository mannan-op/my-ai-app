import { Copy, ExternalLink } from "lucide-react";
import { Citation, RegionType } from "../lib/types";
import { Badge, Button } from "./ui";

type CitationProps = {
  citation: Citation;
  regionType?: RegionType;
  score?: number;
  onJump?: (pageNumber: number) => void;
};

export function CitationCard({ citation, regionType, score, onJump }: CitationProps) {
  const bboxText = citation.bbox.map((value) => Math.round(value)).join(", ");

  return (
    <article className="citation-card">
      <div className="citation-main">
        <Badge tone="blue">Page {citation.pageNumber}</Badge>
        {regionType ? <Badge>{regionType}</Badge> : null}
        {typeof score === "number" ? <span className="muted">Score {score.toFixed(2)}</span> : null}
      </div>
      <div className="citation-meta">BBox [{bboxText}]</div>
      <div className="citation-actions">
        <Button variant="ghost" onClick={() => onJump?.(citation.pageNumber)} aria-label="Jump to page">
          <ExternalLink size={14} />
          Jump
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigator.clipboard?.writeText(`Page ${citation.pageNumber}, bbox [${bboxText}]`)}
          aria-label="Copy citation"
        >
          <Copy size={14} />
          Copy
        </Button>
      </div>
    </article>
  );
}

