import { parseLogLine } from "@/lib/parse-log";
import { LineRow } from "./line-gutter";

export function LogFile({ source }: { source: string }) {
  return (
    <pre className="p-4">
      <code>
        {source.split("\n").map((line, i) => {
          const { timestamp, level, message } = parseLogLine(line);
          return (
            <LineRow key={i} n={i + 1}>
              {timestamp && <span className="text-fg-subtle">[{timestamp}] </span>}
              {level && <span className="text-green">{level} </span>}
              <span className="text-fg">{message}</span>
            </LineRow>
          );
        })}
      </code>
    </pre>
  );
}
