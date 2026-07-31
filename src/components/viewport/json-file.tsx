import { tokenizeJsonLine, type JsonTokenKind } from "@/lib/tokenize-json";
import { LineRow } from "./line-gutter";

const TONE: Record<JsonTokenKind, string> = {
  key: "text-primary",
  string: "text-green",
  number: "text-amber",
  boolean: "text-violet",
  null: "text-violet",
  punct: "text-fg-muted",
  space: "",
  text: "text-fg",
};

export function JsonFile({ source }: { source: string }) {
  return (
    <pre className="p-4">
      <code>
        {source.split("\n").map((line, i) => (
          <LineRow key={i} n={i + 1}>
            {tokenizeJsonLine(line).map((token, j) => (
              <span key={j} className={TONE[token.kind]}>
                {token.text}
              </span>
            ))}
          </LineRow>
        ))}
      </code>
    </pre>
  );
}
