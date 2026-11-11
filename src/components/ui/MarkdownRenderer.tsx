"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { type Components } from "react-markdown";

const components: Components = {
  // Tight, readable prose in the chat bubble context
  p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
  h2: ({ children }) => <h2 className="font-semibold text-sm mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="font-medium text-sm mt-2 mb-1">{children}</h3>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2">{children}</ol>,
  li: ({ children }) => <li className="text-sm">{children}</li>,
  code: ({ children, className }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <pre className="bg-slate-100 rounded-lg p-3 overflow-x-auto text-xs my-2">
          <code>{children}</code>
        </pre>
      );
    }
    return (
      <code className="bg-slate-100 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
    );
  },
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-brand-300 pl-3 italic text-slate-600 my-2">
      {children}
    </blockquote>
  ),
};

interface Props {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: Props) {
  return (
    <div className={`text-sm text-slate-800 ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
