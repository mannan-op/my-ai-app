import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { AppShell, PageHeader } from "../../components/shell";
import { Button, Card, EmptyState } from "../../components/ui";
import { fetchDocuments } from "../../lib/api";

export default async function ChatIndexPage() {
  let documents: Awaited<ReturnType<typeof fetchDocuments>> = [];

  try {
    documents = await fetchDocuments();
  } catch {
    documents = [];
  }

  if (documents.length > 0) {
    redirect(`/chat/${documents[0].id}`);
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Research chat"
        title="No documents available"
        description="Upload and extract a filing before starting a verified research conversation."
      />
      <Card>
        <EmptyState
          title="Corpus is empty"
          description="Add at least one PDF through the documents page, run extraction, then return here to ask questions."
          action={
            <Link href="/documents">
              <Button>
                <MessageSquare size={16} />
                Open documents
              </Button>
            </Link>
          }
        />
      </Card>
    </AppShell>
  );
}
