import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getReconReport } from "@/services/recon-api";

interface ReportViewerProps {
  scanId: string;
  ready: boolean;
  className?: string;
}

interface TocEntry {
  id: string;
  level: number;
  text: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function extractToc(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const lines = markdown.split("\n");
  let inCode = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      entries.push({ id: slugify(text), level, text });
    }
  }
  return entries;
}

function renderMarkdown(markdown: string): string {
  const escape = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const inlineFormat = (s: string): string =>
    escape(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
      );

  const lines = markdown.split("\n");
  const out: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let listBuf: string[] = [];
  let paraBuf: string[] = [];

  const flushList = () => {
    if (listBuf.length) {
      out.push(`<ul>${listBuf.join("")}</ul>`);
      listBuf = [];
    }
  };
  const flushPara = () => {
    if (paraBuf.length) {
      out.push(`<p>${inlineFormat(paraBuf.join(" "))}</p>`);
      paraBuf = [];
    }
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushList();
      flushPara();
      if (!inCode) {
        inCode = true;
        codeLang = line.trim().slice(3).trim();
        codeBuf = [];
      } else {
        out.push(
          `<pre dir="ltr"><code${codeLang ? ` class="language-${codeLang}"` : ""}>${escape(codeBuf.join("\n"))}</code></pre>`,
        );
        inCode = false;
        codeLang = "";
        codeBuf = [];
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }
    const headingMatch = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      flushList();
      flushPara();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      out.push(
        `<h${level} id="${slugify(text)}">${inlineFormat(text)}</h${level}>`,
      );
      continue;
    }
    const liMatch = /^\s*[-*]\s+(.+?)\s*$/.exec(line);
    if (liMatch) {
      flushPara();
      listBuf.push(`<li>${inlineFormat(liMatch[1])}</li>`);
      continue;
    }
    if (line.trim() === "") {
      flushList();
      flushPara();
      continue;
    }
    listBuf.length && flushList();
    paraBuf.push(line.trim());
  }
  flushList();
  flushPara();
  if (inCode && codeBuf.length) {
    out.push(`<pre dir="ltr"><code>${escape(codeBuf.join("\n"))}</code></pre>`);
  }
  return out.join("\n");
}

export function ReportViewer({ scanId, ready, className }: ReportViewerProps) {
  const { t } = useTranslation("recon");
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) {
      setMarkdown(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getReconReport(scanId)
      .then((res) => {
        if (!cancelled) setMarkdown(res.markdown);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load report",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scanId, ready]);

  const toc = useMemo(
    () => (markdown ? extractToc(markdown) : []),
    [markdown],
  );

  if (!ready) {
    return (
      <div
        className={cn("rounded-lg border bg-card p-6", className)}
        data-testid="report-not-ready"
      >
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          {t("recon.detail.report.notReady")}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={cn("rounded-lg border bg-card p-6 space-y-3", className)}
        data-testid="report-loading"
      >
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn("rounded-lg border bg-card p-6", className)}
        role="alert"
      >
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!markdown) return null;

  return (
    <div
      className={cn("flex flex-col gap-6 lg:flex-row lg:items-start", className)}
      data-testid="report-viewer"
    >
      {toc.length > 0 && (
        <nav
          className="lg:sticky lg:top-20 lg:w-56 lg:flex-shrink-0"
          aria-label={t("recon.detail.report.toc")}
          data-testid="report-toc"
        >
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("recon.detail.report.toc")}
          </p>
          <ul className="space-y-1 text-sm">
            {toc.map((entry) => (
              <li
                key={entry.id}
                className={cn(
                  entry.level === 2 && "ps-3",
                  entry.level === 3 && "ps-6",
                )}
              >
                <a
                  href={`#${entry.id}`}
                  className="text-muted-foreground hover:text-foreground transition-colors duration-150"
                >
                  {entry.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <article
        className="flex-1 prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }}
      />
    </div>
  );
}
