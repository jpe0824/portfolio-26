export type LogLine = {
  timestamp: string | null;
  level: string | null;
  message: string;
};

const STRUCTURED = /^\[([^\]]+)\]\s+(\S+)\s*(.*)$/;

export function parseLogLine(line: string): LogLine {
  const match = STRUCTURED.exec(line);
  if (!match) return { timestamp: null, level: null, message: line };
  return { timestamp: match[1], level: match[2], message: match[3] };
}
