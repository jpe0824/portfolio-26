import { TerminalFrame } from "@/components/terminal-frame";

export default function Probe() {
  return (
    <TerminalFrame explorer={<aside className="w-56 border-r border-edge bg-panel" />} currentPath="">
      <div className="p-4">
        {Array.from({ length: 80 }, (_, i) => (
          <p key={i}>line {i + 1}</p>
        ))}
      </div>
    </TerminalFrame>
  );
}
