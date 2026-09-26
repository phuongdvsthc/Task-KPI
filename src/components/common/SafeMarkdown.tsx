/**
 * Safe Markdown renderer for AI Assistant
 * - Parses safe Markdown subsets: Headings (#, ##, ###), bold (**text**), italic (*text*),
 *   inline code (`code`), fenced code blocks (```lang ... ```), blockquotes (> text),
 *   unordered lists (- or *), ordered lists (1. 2.), horizontal rules (---), and tables.
 * - STRICT SAFETY:
 *   - NEVER renders raw HTML (all HTML tags are escaped or stripped).
 *   - Sanitizes all URLs: blocks `javascript:`, `data:`, `vbscript:`.
 *   - All external links enforce `rel="noopener noreferrer"` and `target="_blank"`.
 *   - Code blocks have horizontal scrolling without layout breaking.
 */

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface SafeMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Validates and sanitizes a URL.
 * Only allows safe protocols (http, https, mailto) and relative paths.
 */
function sanitizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  // Block dangerous pseudo-protocols
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return null;
  }

  // Allow relative URLs starting with / or #
  if (trimmed.startsWith('/') || trimmed.startsWith('#')) {
    return trimmed;
  }

  // Allow http, https, mailto
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return trimmed;
    }
  } catch {
    // If not a valid absolute URL and doesn't start with / or #, reject it
    return null;
  }

  return null;
}

/**
 * Renders inline Markdown (bold, italic, inline code, links).
 */
function renderInlineText(text: string): React.ReactNode[] {
  // Pattern to match bold, italic, code, link
  // 1: `code`
  // 2: **bold**
  // 3: *italic*
  // 4: [text](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (!part) return null;

    // Inline code `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const code = part.slice(1, -1);
      return (
        <code
          key={index}
          className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-indigo-700 border border-slate-200/80"
        >
          {code}
        </code>
      );
    }

    // Bold **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      const boldText = part.slice(2, -2);
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {renderInlineText(boldText)}
        </strong>
      );
    }

    // Italic *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      const italicText = part.slice(1, -1);
      return (
        <em key={index} className="italic text-slate-800">
          {renderInlineText(italicText)}
        </em>
      );
    }

    // Link [text](url)
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, linkText, linkUrl] = linkMatch;
      const safeLink = sanitizeUrl(linkUrl);
      if (!safeLink) {
        return <span key={index}>{linkText}</span>;
      }
      return (
        <a
          key={index}
          href={safeLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2 break-all font-medium transition-colors"
        >
          {linkText}
        </a>
      );
    }

    // Normal text
    return <span key={index}>{part}</span>;
  });
}

/**
 * Component for fenced code blocks with syntax label and copy button
 */
const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-2 text-xs font-mono text-slate-400">
        <span>{language || 'text'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Đã sao chép mã nguồn' : 'Sao chép mã nguồn'}
          className="flex items-center gap-1.5 rounded px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          <span>{copied ? 'Đã chép' : 'Sao chép'}</span>
        </button>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
        <pre className="m-0 whitespace-pre">{code}</pre>
      </div>
    </div>
  );
};

export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Split content into blocks: code blocks, tables, lists, paragraphs
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];

  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];
  let currentListItems: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const text = currentParagraphLines.join('\n');
      blocks.push(
        <p key={`p-${blocks.length}`} className="my-2 leading-relaxed text-slate-700 whitespace-pre-line">
          {renderInlineText(text)}
        </p>
      );
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentListItems && currentListItems.items.length > 0) {
      const { type, items } = currentListItems;
      const ListTag = type === 'ol' ? 'ol' : 'ul';
      blocks.push(
        <ListTag
          key={`list-${blocks.length}`}
          className={`my-2 space-y-1.5 pl-6 text-slate-700 leading-relaxed ${
            type === 'ol' ? 'list-decimal' : 'list-disc'
          }`}
        >
          {items.map((item, i) => (
            <li key={i}>{renderInlineText(item)}</li>
          ))}
        </ListTag>
      );
      currentListItems = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 1. Code blocks ```
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        blocks.push(
          <CodeBlock
            key={`code-${blocks.length}`}
            language={codeBlockLang}
            code={codeBlockLines.join('\n')}
          />
        );
        inCodeBlock = false;
        codeBlockLines = [];
        codeBlockLang = '';
      } else {
        // Start of code block
        flushParagraph();
        flushList();
        inCodeBlock = true;
        codeBlockLang = line.trim().slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // 2. Empty line resets paragraphs and lists
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    // 3. Headings
    if (line.startsWith('#')) {
      flushParagraph();
      flushList();
      const match = line.match(/^(#{1,6})\s+(.*)$/);
      if (match) {
        const level = match[1].length;
        const headingText = match[2];
        if (level === 1) {
          blocks.push(
            <h1 key={`h1-${blocks.length}`} className="mt-4 mb-2 text-xl font-bold tracking-tight text-slate-900 border-b border-slate-200/80 pb-1">
              {renderInlineText(headingText)}
            </h1>
          );
        } else if (level === 2) {
          blocks.push(
            <h2 key={`h2-${blocks.length}`} className="mt-3.5 mb-1.5 text-lg font-bold tracking-tight text-slate-900">
              {renderInlineText(headingText)}
            </h2>
          );
        } else if (level === 3) {
          blocks.push(
            <h3 key={`h3-${blocks.length}`} className="mt-3 mb-1 text-base font-semibold text-slate-800">
              {renderInlineText(headingText)}
            </h3>
          );
        } else {
          blocks.push(
            <h4 key={`h4-${blocks.length}`} className="mt-2.5 mb-1 text-sm font-semibold text-slate-800">
              {renderInlineText(headingText)}
            </h4>
          );
        }
        continue;
      }
    }

    // 4. Horizontal Rule
    if (/^(\*\*\*|---|___)$/.test(line.trim())) {
      flushParagraph();
      flushList();
      blocks.push(<hr key={`hr-${blocks.length}`} className="my-4 border-slate-200" />);
      continue;
    }

    // 5. Blockquote
    if (line.startsWith('>')) {
      flushParagraph();
      flushList();
      const quoteText = line.replace(/^>\s?/, '');
      blocks.push(
        <blockquote
          key={`quote-${blocks.length}`}
          className="my-2 border-l-4 border-indigo-400 bg-indigo-50/50 pl-4 py-2 italic text-slate-700 rounded-r-lg text-sm"
        >
          {renderInlineText(quoteText)}
        </blockquote>
      );
      continue;
    }

    // 6. Unordered Lists (- or *)
    const ulMatch = line.match(/^[-*]\s+(.*)$/);
    if (ulMatch) {
      flushParagraph();
      if (!currentListItems || currentListItems.type !== 'ul') {
        flushList();
        currentListItems = { type: 'ul', items: [] };
      }
      currentListItems.items.push(ulMatch[1]);
      continue;
    }

    // 7. Ordered Lists (1., 2., etc)
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      flushParagraph();
      if (!currentListItems || currentListItems.type !== 'ol') {
        flushList();
        currentListItems = { type: 'ol', items: [] };
      }
      currentListItems.items.push(olMatch[1]);
      continue;
    }

    // 8. Normal paragraph line
    flushList();
    currentParagraphLines.push(line);
  }

  // Handle lingering code block (if stream aborted while inside code fence)
  if (inCodeBlock && codeBlockLines.length > 0) {
    blocks.push(
      <CodeBlock
        key={`code-${blocks.length}`}
        language={codeBlockLang}
        code={codeBlockLines.join('\n')}
      />
    );
  }

  flushParagraph();
  flushList();

  return <div className={`safe-markdown-container text-sm ${className}`}>{blocks}</div>;
};
