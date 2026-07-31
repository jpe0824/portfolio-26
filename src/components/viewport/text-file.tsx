import { LineRow } from "./line-gutter";

export function TextFile({ source }: { source: string }) {
  return (
    <pre className="p-4">
      <code>
        {source.split("\n").map((line, i) => (
          <LineRow key={i} n={i + 1}>
            {line}
          </LineRow>
        ))}
      </code>
    </pre>
  );
}
