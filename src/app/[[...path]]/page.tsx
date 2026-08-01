import { notFound } from "next/navigation";
import { PathLine } from "@/components/path-line";
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
  const node = resolveNode(manifest, path ?? []);

  if (!node) notFound();

  return (
    <>
      <PathLine path={node.path} />
      <div className="min-h-0 flex-1 overflow-auto">
        <FileViewport node={node} />
      </div>
    </>
  );
}
