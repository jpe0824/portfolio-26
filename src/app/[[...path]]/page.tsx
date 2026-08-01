import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PathLine } from "@/components/path-line";
import { TabStrip } from "@/components/tab-strip";
import { FileViewport } from "@/components/viewport/file-viewport";
import { manifest } from "@/content/manifest";
import { allPaths, resolveNode } from "@/content/resolve";

// "" is the empty state, which is not a content node, so allPaths no longer emits it.
export function generateStaticParams() {
  return ["", ...allPaths(manifest)].map((p) => ({ path: p === "" ? [] : p.split("/") }));
}

export const metadata: Metadata = {
  description:
    "Jason Edman, senior software engineer. A portfolio presented as a terminal IDE — " +
    "prose as markdown, structured data as JSON, history as a log.",
};

export default async function ContentPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const segments = path ?? [];

  if (segments.length === 0) return <EmptyState />;

  const node = resolveNode(manifest, segments);
  if (!node) notFound();

  return (
    <>
      <TabStrip node={node} />
      <PathLine path={node.path} />
      <div className="min-h-0 flex-1 overflow-auto">
        <FileViewport node={node} />
      </div>
    </>
  );
}
