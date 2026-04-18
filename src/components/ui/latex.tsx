"use client";

import React, { useEffect, useRef, memo } from 'react';
import katex from 'katex';
import { cn } from "@/lib/utils";

interface LatexRendererProps {
  children: string;
  /**
   * When true, render otherwise block-level elements (like <equation-center>) inline.
   * Useful for compact, single-line previews (e.g., history list rows).
   */
  compactInline?: boolean;
  onEquationClick?: (latex: string) => void;
}

interface KaTeXRendererProps {
  content: string;
  displayMode?: boolean;
}

const KaTeXRenderer: React.FC<KaTeXRendererProps> = memo(({ content, displayMode = false }) => {
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (spanRef.current) {
      try {
        const processedContent = content.replace(/(?<!\\)\$/g, '\\$');
        katex.render(processedContent, spanRef.current, {
          throwOnError: false,
          errorColor: '#cc0000',
          displayMode,
        });
      } catch (error) {
        console.error('KaTeX rendering error:', error, 'Content:', content);
        spanRef.current.textContent = content;
        spanRef.current.className = 'font-mono text-red-600';
      }
    }
  }, [content, displayMode]);

  return <span ref={spanRef} className="inline max-w-full overflow-x-auto align-baseline [vertical-align:-0.125em]" />;
});
KaTeXRenderer.displayName = 'KaTeXRenderer';

const Table: React.FC<{ html: string; onEquationClick?: (latex: string) => void }> = ({ html, onEquationClick }) => {
  if (typeof window === 'undefined') {
    return null;
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<table>${html}</table>`, 'text/html');

  const allRows = Array.from(doc.querySelectorAll('tr'));
  if (allRows.length === 0) return null;

  // Check if table is 2 rows x 1 column
  const numRows = allRows.length;
  const firstRowCells = Array.from(allRows[0]?.querySelectorAll('td, th') || []);
  const numCols = firstRowCells.length;
  const is2x1Table = numRows === 2 && numCols === 1;

  // Extract equations from table content
  const extractEquations = (content: string): string[] => {
    const equations: string[] = [];
    // Match <equation>...</equation> tags
    const equationRegex = /<equation>(.*?)<\/equation>/g;
    let match;
    while ((match = equationRegex.exec(content)) !== null) {
      equations.push(match[1]);
    }
    // Match <equation-center>...</equation-center> tags
    const equationCenterRegex = /<equation-center>(.*?)<\/equation-center>/g;
    while ((match = equationCenterRegex.exec(content)) !== null) {
      equations.push(match[1]);
    }
    return equations;
  };

  const equations = extractEquations(html);
  const hasEquations = equations.length > 0;
  const isClickable = onEquationClick && hasEquations;

  const handleTableClick = () => {
    if (!onEquationClick || equations.length === 0) return;
    // Pass the first equation to graph
    onEquationClick(equations[0]);
  };

  const rows = allRows.map((row, i) => {
    const isInThead = row.parentElement?.tagName.toLowerCase() === 'thead';
    const hasTh = Array.from(row.children).some(c => c.tagName.toLowerCase() === 'th');
    const isHeaderRow = isInThead || hasTh;

    return (
      <tr 
        key={i} 
        className={cn(
          !is2x1Table && "border-b-2 border-border",
          isHeaderRow ? "bg-muted" : "bg-card",
          !is2x1Table && i === allRows.length - 1 && "border-0"
        )}
      >
        {Array.from(row.querySelectorAll('td, th')).map((cell, j) => {
          const isHeaderCell = cell.tagName.toLowerCase() === 'th' || isHeaderRow;
          return React.createElement(
            isHeaderCell ? 'th' : 'td',
            { 
              key: j, 
              className: cn(
                "p-4 align-middle",
                isHeaderCell 
                  ? cn(
                      "font-medium text-muted-foreground uppercase tracking-wider",
                      is2x1Table ? "text-sm" : "text-xs"
                    )
                  : is2x1Table ? "text-lg text-foreground" : "text-sm text-foreground",
                "text-center"
              )
            },
            <LatexRenderer onEquationClick={onEquationClick}>{cell.innerHTML}</LatexRenderer>
          )
        })}
      </tr>
    );
  });

  return (
    <div 
      onClick={isClickable ? handleTableClick : undefined}
      className={cn(
        "my-6 mx-auto w-fit overflow-hidden rounded-lg bg-card",
        is2x1Table ? "" : "border-2 border-b-4 border-border",
        isClickable && "cursor-pointer hover:bg-accent/50 transition-colors"
      )}
    >
      <table className="w-auto caption-bottom text-sm">
        <tbody className="[&_tr:last-child]:border-0">
          {rows}
        </tbody>
      </table>
    </div>
  );
};

export function LatexRenderer({ children, compactInline = false, onEquationClick }: LatexRendererProps) {
  if (!children) return null;

  // Pre-process to remove <graph> tags entirely, as they are handled by a separate component.
  const cleanChildren = children.replace(/<graph>.*?<\/graph>/g, '');

  // Normalize entities and dash conventions (em/en dashes)
  const normalizeText = (input: string): string => {
    let out = input
      .replace(/&mdash;/g, '—')
      .replace(/&ndash;/g, '–')
      .replace(/&nbsp;/g, '\u00A0')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    // Convert triple hyphen to em dash
    out = out.replace(/---/g, '—');
    // Convert spaced double hyphen to em dash
    out = out.replace(/(\s)--(\s)/g, '$1—$2');
    return out;
  };

  const normalizedChildren = normalizeText(cleanChildren);
  // Strip any <image-alt>...</image-alt> blocks entirely before parsing so they never leak into display
  let strippedChildren = normalizedChildren.replace(/<image-alt\b[^>]*>[\s\S]*?<\/image-alt\s*>/gi, '');

  // Heuristic: Some legacy questions accidentally inlined image descriptions without <image-alt> tags.
  // Detect a likely chart/graph preamble and trim everything before the question prompt (e.g., "Which choice ...").
  const looksLikeAltPreamble = (text: string): boolean => {
    const hasBarsOrCategories = /\b(the\s+following\s+bars\s+are\s+shown|for\s+each\s+data\s+category|the\s+data\s+for\s+the\s+\d+\s+categor\w+\s+are\s+as\s+follows)\b/i.test(text);
    const hasColonListsOrPercents = /:\s*[^\n]+?(%|\d)[^\n]*?(?=\n|$)/i.test(text) || /%/.test(text);
    // Consider it an alt preamble only if these cues appear near the start
    const startSlice = text.slice(0, 800);
    return hasBarsOrCategories && hasColonListsOrPercents && /\b(Which|What|According|Based|In|If|Suppose|Select|Choose)\b/i.test(text);
  };

  if (looksLikeAltPreamble(strippedChildren)) {
    const anchorMatch = /\b(Which|What|According|Based|In|If|Suppose|Select|Choose)\b/i.exec(strippedChildren);
    if (anchorMatch && anchorMatch.index > 0) {
      strippedChildren = strippedChildren.slice(anchorMatch.index);
    }
  }

  const parseMarkup = (text: string): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    let i = 0;

    while (i < text.length) {
      // <image-alt> content is stripped in pre-processing above

      // Support <table> with attributes (e.g., <table class="...">)
      if (text.startsWith('<table', i)) {
        const startTagEnd = text.indexOf('>', i);
        const end = text.indexOf('</table>', startTagEnd !== -1 ? startTagEnd : i);
        if (startTagEnd !== -1 && end !== -1) {
          const content = text.slice(startTagEnd + 1, end);
          nodes.push(<Table key={`table-${i}`} html={content} onEquationClick={onEquationClick} />);
          i = end + 8; // length of "</table>"
          continue;
        }
      }

      if (text.startsWith('<equation>', i)) {
        const end = text.indexOf('</equation>', i);
        if (end !== -1) {
          const content = text.slice(i + 10, end);
          if (content.includes('<table>')) {
            // Use a block container to avoid nesting block elements inside inline wrappers
            nodes.push(<div key={`eq-${i}`}>{parseMarkup(content)}</div>);
          } else {
            const equation = <KaTeXRenderer key={`eq-${i}`} content={content} />;
            if (onEquationClick) {
              nodes.push(
                <span
                  key={`eq-${i}`}
                  onClick={() => onEquationClick(content)}
                  className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 rounded px-1 transition-colors inline-block"
                  title="Click to graph"
                >
                  {equation}
                </span>
              );
            } else {
              nodes.push(equation);
            }
          }
          i = end + 11;
          continue;
        }
      }

      // Centered equation block support: <equation-center> ... </equation-center>
      if (text.startsWith('<equation-center>', i)) {
        const end = text.indexOf('</equation-center>', i);
        if (end !== -1) {
          const content = text.slice(i + 17, end);
          if (compactInline) {
            // Render inline for compact single-line contexts
            const equation = <KaTeXRenderer key={`eqc-${i}`} content={content} displayMode={false} />;
            if (onEquationClick) {
              nodes.push(
                <span
                  key={`eqc-${i}`}
                  onClick={() => onEquationClick(content)}
                  className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 rounded px-1 transition-colors inline-block"
                  title="Click to graph"
                >
                  {equation}
                </span>
              );
            } else {
              nodes.push(equation);
            }
          } else {
            const equation = <KaTeXRenderer content={content} displayMode />;
            if (onEquationClick) {
              nodes.push(
                <div key={`eqc-${i}`} className="text-center my-4">
                  <div 
                    onClick={() => onEquationClick(content)}
                    className="cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 rounded p-2 transition-colors inline-block"
                    title="Click to graph"
                  >
                    {equation}
                  </div>
                </div>
              );
            } else {
              nodes.push(
                <div key={`eqc-${i}`} className="text-center my-4">
                  {equation}
                </div>
              );
            }
          }
          i = end + 18; // length of "</equation-center>"
          continue;
        }
      }

      if (text.startsWith('<i>', i)) {
        const end = text.indexOf('</i>', i);
        if (end !== -1) {
          const content = text.slice(i + 3, end);
          nodes.push(<i key={`i-${i}`}>{parseMarkup(content)}</i>);
          i = end + 4;
          continue;
        }
      }

      if (text.startsWith('<em>', i)) {
        const end = text.indexOf('</em>', i);
        if (end !== -1) {
          const content = text.slice(i + 4, end);
          nodes.push(<em key={`em-${i}`}>{parseMarkup(content)}</em>);
          i = end + 5;
          continue;
        }
      }

      if (text.startsWith('<b>', i)) {
        const end = text.indexOf('</b>', i);
        if (end !== -1) {
          const content = text.slice(i + 3, end);
          nodes.push(<b key={`b-${i}`}>{parseMarkup(content)}</b>);
          i = end + 4;
          continue;
        }
      }

      if (text.startsWith('<u>', i)) {
        const end = text.indexOf('</u>', i);
        if (end !== -1) {
          const content = text.slice(i + 3, end);
          nodes.push(<u key={`u-${i}`}>{parseMarkup(content)}</u>);
          i = end + 4;
          continue;
        }
      }

      // Find the next tag to preserve plain text segments
      const nextIdx = (() => {
        const idxs = [
          text.indexOf('<table>', i),
          text.indexOf('<equation-center>', i),
          text.indexOf('<equation>', i),
          text.indexOf('<i>', i),
          text.indexOf('<em>', i),
          text.indexOf('<b>', i),
          text.indexOf('<u>', i),
          // We don't need to look for <image-alt> because we'll strip it
        ].filter(n => n !== -1);
        return idxs.length ? Math.min(...idxs) : text.length;
      })();

      // Extract and process the text up to the next tag.
      // This is where we will emphasize certain patterns.
      // Note: <image-alt> blocks are skipped above, so none remain here.
      const plain = text.slice(i, nextIdx);
      if (plain) {
        // Emphasize occurrences of "Choice A" .. "Choice D" (case-insensitive)
        const emphasizeChoiceRegex = /\b(Choice\s+[A-D])\b/gi;
        let lastIdx = 0;
        let match: RegExpExecArray | null;
        const parts: React.ReactNode[] = [];
        // Iterate through matches and split into normal and bold segments
        while ((match = emphasizeChoiceRegex.exec(plain)) !== null) {
          const start = match.index;
          const end = start + match[0].length;
          if (start > lastIdx) {
            parts.push(<span key={`t-${i}-${lastIdx}`}>{plain.slice(lastIdx, start)}</span>);
          }
          parts.push(<b key={`b-${i}-${start}`}>{match[0]}</b>);
          lastIdx = end;
        }
        if (lastIdx < plain.length) {
          parts.push(<span key={`t-${i}-${lastIdx}`}>{plain.slice(lastIdx)}</span>);
        }
        nodes.push(<span key={`twrap-${i}`}>{parts}</span>);
      }
      i = nextIdx;
    }
    return nodes;
  };

  return <>{parseMarkup(strippedChildren)}</>;
}