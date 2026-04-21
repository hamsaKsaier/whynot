> **Single source of truth**: Before proposing any change, read [`../../../../ARCHITECTURE.md`](../../../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

# PoC Viewer — Component Spec

## TypeScript Prop Types

```typescript
type PoCKind = "code" | "http" | "script";

interface ProofOfConcept {
  kind: PoCKind;
  language: string;
  content: string;
  request?: string;
  response?: string;
}

interface ReconPoCViewerProps {
  poc: ProofOfConcept;
  defaultExpanded?: boolean;
  onCopy?: () => void;
  className?: string;
}
```

## PoC Kind Rendering

### `code` — Shiki Code Block

```typescript
import { codeToHtml } from "shiki";

// Shiki is already a project dependency (used for Fumadocs blogs).
// Use the same Shiki instance/theme as the rest of whynot.
```

Renders `poc.content` as a syntax-highlighted code block using Shiki. The `poc.language` field drives Shiki's language detection (e.g., `"python"`, `"javascript"`, `"bash"`).

### `http` — Request/Response Pair

Renders `poc.request` and `poc.response` as two separate code blocks with labels:

```
┌─ Request ──────────────────────────────────────┐
│ GET /api/users/1 HTTP/1.1                      │
│ Host: target.example.com                       │
│ Authorization: Bearer eyJ...                    │
└────────────────────────────────────────────────┘

┌─ Response ─────────────────────────────────────┐
│ HTTP/1.1 200 OK                                │
│ Content-Type: application/json                 │
│                                                │
│ {"id": 1, "email": "admin@internal.com"}       │
└────────────────────────────────────────────────┘
```

### `script` — Terminal-Style Block

Renders `poc.content` in a monospace terminal-style block. No syntax highlighting — just a plain `<pre>` with `font-mono`.

## Implementation

```tsx
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { codeToHtml } from "shiki";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ReconPoCViewer({
  poc,
  defaultExpanded = false,
  onCopy,
  className,
}: ReconPoCViewerProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(poc.content);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  }, [poc.content, onCopy]);

  return (
    <div className={cn("relative rounded-md border bg-muted/50", className)}>
      {/* Header with copy button */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b">
        <span className="text-xs font-medium text-muted-foreground">
          {t("recon.findingCard.poc.title")}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2"
          aria-label={t("recon.findingCard.copy.poc")}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Code content */}
      <div className="overflow-auto max-h-80">
        {poc.kind === "code" && (
          <CodeBlock content={poc.content} language={poc.language} />
        )}
        {poc.kind === "http" && (
          <HttpBlock
            request={poc.request ?? ""}
            response={poc.response ?? ""}
          />
        )}
        {poc.kind === "script" && (
          <pre
            dir="ltr"
            className="p-3 text-sm font-mono whitespace-pre-wrap text-foreground"
          >
            {poc.content}
          </pre>
        )}
      </div>
    </div>
  );
}
```

### CodeBlock Sub-Component

```tsx
function CodeBlock({ content, language }: { content: string; language: string }) {
  const [html, setHtml] = useState<string>("");

  useEffect(() => {
    codeToHtml(content, {
      lang: language,
      theme: "github-dark-default",
    }).then(setHtml);
  }, [content, language]);

  return (
    <pre
      dir="ltr"
      className="p-3 text-sm overflow-x-auto"
    >
      {html ? (
        <code dangerouslySetInnerHTML={{ __html: html }} />
      ) : (
        <code className="font-mono">{content}</code>
      )}
    </pre>
  );
}
```

**Note on Shiki:** The Shiki output is rendered via `dangerouslySetInnerHTML` because Shiki produces pre-formatted HTML with `<span>` elements for syntax highlighting. The input `content` comes from the server's `proof_of_concept.content` field — it is the raw code string, not HTML. Only the Shiki-transformed output is set as innerHTML. The raw user payload (exploit code) is never inserted as `dangerouslySetInnerHTML` directly.

### HttpBlock Sub-Component

```tsx
function HttpBlock({
  request,
  response,
}: {
  request: string;
  response: string;
}) {
  return (
    <div className="divide-y" dir="ltr">
      {request && (
        <div>
          <div className="px-3 py-1 text-xs font-medium text-muted-foreground border-b">
            Request
          </div>
          <pre className="p-3 text-sm font-mono whitespace-pre-wrap">
            {request}
          </pre>
        </div>
      )}
      {response && (
        <div>
          <div className="px-3 py-1 text-xs font-medium text-muted-foreground border-b">
            Response
          </div>
          <pre className="p-3 text-sm font-mono whitespace-pre-wrap">
            {response}
          </pre>
        </div>
      )}
    </div>
  );
}
```

## Constraints

| Rule | Enforcement |
|------|-------------|
| Code direction always LTR | `dir="ltr"` on every `<pre>` element |
| No raw payload injection | User content (exploit code) rendered as text content, never `dangerouslySetInnerHTML` directly. Only Shiki's syntax-highlighted HTML output uses it. |
| Copy button position | Top-end corner (logical `end` for RTL) |
| White-space | `whitespace-pre-wrap` on all code blocks |
| No `min-h-[44px]` | No Switch in this component; no `min-h-[44px]` anywhere |
| Dark mode | Shiki theme `github-dark-default` adapts; container uses `bg-muted/50` |

## Vitest Test Outline

```typescript
// ReconPoCViewer.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReconPoCViewer } from "../ReconPoCViewer";

const CODE_POC: ProofOfConcept = {
  kind: "code",
  language: "python",
  content: "import requests\nrequests.get('https://target/api/users/1')",
};

const HTTP_POC: ProofOfConcept = {
  kind: "http",
  language: "http",
  content: "GET /api/users/1 HTTP/1.1\nHost: target.example.com",
  request: "GET /api/users/1 HTTP/1.1\nHost: target.example.com",
  response: "HTTP/1.1 200 OK\n\n{\"id\": 1}",
};

const SCRIPT_POC: ProofOfConcept = {
  kind: "script",
  language: "bash",
  content: "curl -X GET https://target/api/users/1",
};

describe("ReconPoCViewer", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders code PoC with language", () => {
    render(<ReconPoCViewer poc={CODE_POC} />);
    expect(screen.getByText(/import requests/)).toBeInTheDocument();
  });

  it("renders http PoC with request/response sections", () => {
    render(<ReconPoCViewer poc={HTTP_POC} />);
    expect(screen.getByText("Request")).toBeInTheDocument();
    expect(screen.getByText("Response")).toBeInTheDocument();
  });

  it("renders script PoC in monospace", () => {
    const { container } = render(<ReconPoCViewer poc={SCRIPT_POC} />);
    const pre = container.querySelector("pre");
    expect(pre).toHaveClass("font-mono");
  });

  it("forces dir=ltr on all pre elements", () => {
    const { container } = render(<ReconPoCViewer poc={CODE_POC} />);
    const pres = container.querySelectorAll("pre");
    pres.forEach((pre) => {
      expect(pre).toHaveAttribute("dir", "ltr");
    });
  });

  it("copies content to clipboard on copy button click", async () => {
    render(<ReconPoCViewer poc={CODE_POC} />);
    const copyButton = screen.getByLabelText(/recon\.findingCard\.copy\.poc/i);
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        CODE_POC.content,
      );
    });
  });

  it("fires onCopy analytics hook", async () => {
    const onCopy = vi.fn();
    render(<ReconPoCViewer poc={CODE_POC} onCopy={onCopy} />);
    const copyButton = screen.getByLabelText(/recon\.findingCard\.copy\.poc/i);
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(onCopy).toHaveBeenCalled();
    });
  });

  it("shows check icon after copy", async () => {
    render(<ReconPoCViewer poc={CODE_POC} />);
    const copyButton = screen.getByLabelText(/recon\.findingCard\.copy\.poc/i);
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(screen.getByRole("button").querySelector(".text-green-600")).toBeInTheDocument();
    });
  });

  it("has no banned CSS classes", () => {
    const { container } = render(<ReconPoCViewer poc={CODE_POC} />);
    const html = container.innerHTML;
    expect(html).not.toMatch(/animate-pulse/);
    expect(html).not.toMatch(/animate-bounce/);
    expect(html).not.toMatch(/hover:-translate-y/);
    expect(html).not.toMatch(/backdrop-blur/);
  });

  it("matches snapshot in en", () => {
    const { container } = render(<ReconPoCViewer poc={SCRIPT_POC} />);
    expect(container).toMatchSnapshot();
  });

  it("matches snapshot in ar (RTL)", () => {
    document.documentElement.dir = "rtl";
    const { container } = render(<ReconPoCViewer poc={SCRIPT_POC} />);
    expect(container).toMatchSnapshot();
    document.documentElement.dir = "ltr";
  });

  it("has zero axe-core critical violations", async () => {
    const { container } = render(<ReconPoCViewer poc={CODE_POC} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```
