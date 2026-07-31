import { TerminalFrame } from "@/components/terminal-frame";
import { FileExplorer } from "@/components/file-explorer";

export default function Probe() {
  return (
    <TerminalFrame explorer={<FileExplorer currentPath="" />} currentPath="">
      <div className="p-4">
        {Array.from({ length: 80 }, (_, i) => (
          <p key={i}>line {i + 1}</p>
        ))}
      </div>
    </TerminalFrame>
  );
}
