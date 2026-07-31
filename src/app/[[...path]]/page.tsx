import { notFound } from "next/navigation";
import { TerminalFrame } from "@/components/terminal-frame";
import { FileExplorer } from "@/components/file-explorer";
import { FileViewport } from "@/components/viewport/file-viewport";
import { manifest } from "@/content/manifest";
import { allPaths, resolveNode } from "@/content/resolve";

export function generateStaticParams() {
  return allPaths(manifest).map((p) => ({ path: p === "" ? [] : p.split("/") }));
}

export default async function ContentPage({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  const segments = path ?? [];
  const node = resolveNode(manifest, segments);

  if (!node) notFound();

  return (
    <TerminalFrame explorer={<FileExplorer currentPath={node.path} />} currentPath={node.path}>
      <FileViewport node={node} />
    </TerminalFrame>
  );
}
