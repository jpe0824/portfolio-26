import { marked } from "marked";

export async function MarkdownFile({ source }: { source: string }) {
  const html = await marked.parse(source, { gfm: true, breaks: false });

  return (
    <article
      className="markdown-body max-w-[72ch] p-4"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
