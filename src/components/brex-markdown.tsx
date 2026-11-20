import ReactMarkdown from "react-markdown";

export function BrexMarkdown({ content }: { content: string }) {
  return <div className="brex-markdown"><ReactMarkdown skipHtml>{content}</ReactMarkdown></div>;
}
