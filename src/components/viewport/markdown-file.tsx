import { marked } from "marked";

export async function MarkdownFile({ source }: { source: string }) {
  const html = await marked.parse(source, { gfm: true, breaks: false });

  return (
    // First-party markdown, read from this repo at build time — never user input.
    // If content ever becomes user-supplied or model-generated, sanitize before it reaches here.
    <article
      className="markdown-body max-w-[72ch] p-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
