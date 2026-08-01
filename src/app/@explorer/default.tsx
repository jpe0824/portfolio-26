import { FileExplorer } from "@/components/file-explorer";

// Rendered on a hard navigation the router cannot match to a slot subpage — notably
// the 404. The explorer must still appear, so this renders it with nothing active
// rather than calling notFound().
export default function ExplorerDefault() {
  return <FileExplorer currentPath="" />;
}
