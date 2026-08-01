import { FileExplorer } from "@/components/file-explorer";
import { manifest } from "@/content/manifest";
import { allPaths } from "@/content/resolve";

export function generateStaticParams() {
  return ["", ...allPaths(manifest)].map((p) => ({ path: p === "" ? [] : p.split("/") }));
}

export default async function ExplorerSlot({
  params,
}: {
  params: Promise<{ path?: string[] }>;
}) {
  const { path } = await params;
  return <FileExplorer currentPath={(path ?? []).join("/")} />;
}
