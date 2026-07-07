"use client";

import { FormEvent, useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { uploadDocument } from "../lib/api";
import { DocumentRecord } from "../lib/types";
import { Button } from "./ui";

export function UploadDialog({
  open,
  onClose,
  onUploaded
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: (document: DocumentRecord) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [filingType, setFilingType] = useState("10-K");
  const [ticker, setTicker] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!file) {
      setError("Select a PDF file to upload.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const document = await uploadDocument({
        file,
        filingType: filingType || undefined,
        ticker: ticker || undefined,
        companyName: companyName || undefined
      });
      onUploaded(document);
      setFile(null);
      setTicker("");
      setCompanyName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-labelledby="upload-dialog-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="upload-dialog-title">Upload filing</h2>
            <p>Add a PDF to the document corpus for extraction and agent analysis.</p>
          </div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="upload-form" onSubmit={handleSubmit}>
          <label className="field-label">
            PDF file
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>

          <label className="field-label">
            Filing type
            <input value={filingType} onChange={(event) => setFilingType(event.target.value)} placeholder="10-K" />
          </label>

          <label className="field-label">
            Ticker
            <input value={ticker} onChange={(event) => setTicker(event.target.value)} placeholder="AAPL" />
          </label>

          <label className="field-label">
            Company name
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="Apple Inc."
            />
          </label>

          {error ? <div className="error-state">{error}</div> : null}

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={uploading}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading || !file}>
              <FileUp size={16} />
              {uploading ? "Uploading..." : "Upload PDF"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
