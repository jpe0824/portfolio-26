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

// Every route this optional catch-all matches renders from this one module, so a static
// `metadata` export gives all 19 of them the same <title> and description — including /readme,
// whose separate indexability is the spec's stated mitigation for moving README.md off the root.
// generateMetadata is what makes the per-route difference real.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}): Promise<Metadata> {
  const { path } = await params;
  const segments = path ?? [];

  if (segments.length === 0) {
    return {
      title: "jason edman",
      description:
        "Jason Edman, senior software engineer. A portfolio presented as a terminal IDE — " +
        "prose as markdown, structured data as JSON, history as a log.",
    };
  }

  const node = resolveNode(manifest, segments);
  // The page below calls notFound() for the same input. Next then renders the not-found boundary
  // and resolves its metadata from the root layout, discarding whatever is returned here —
  // verified by curl: /nope serves the layout's title and description, not this function's. So
  // this branch exists to keep the function total, and inheriting the layout is also what it
  // would produce if Next ever did use it.
  if (!node) return {};

  const label = node.kind === "dir" ? `${node.name}/` : node.name;
  return {
    title: `${label} — jason edman`,
    description:
      `${label} — a ${node.kind === "dir" ? "directory" : "file"} in the portfolio of ` +
      "Jason Edman, senior software engineer, presented as a terminal IDE.",
  };
}

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
