> **Single source of truth**: Before proposing any change, read [`../../../../ARCHITECTURE.md`](../../../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

# Finding Card — Component Spec

## TypeScript Prop Types

```typescript
type ReconSeverity = "low" | "medium" | "high" | "critical";
type VulnClass = "injection" | "xss" | "ssrf" | "auth" | "authz";

interface ProofOfConcept {
  kind: "code" | "http" | "script";
  language: string;
  content: string;
  request?: string;
  response?: string;
}

interface ReconFinding {
  id: string;
  severity: ReconSeverity;
  vulnClass: VulnClass;
  normalizedEndpoint: string;
  description: string;
  proofOfConcept: ProofOfConcept | null;
  remediationSummary: string;
  confirmedAt: string | null;
}

interface ReconFindingCardProps {
  finding: ReconFinding;
  defaultExpanded?: boolean;
  onCopyPoC?: () => void;
  onViewReport?: (findingId: string) => void;
  className?: string;
}
```

## Layout

```
┌─────────────────────────────────────────────────────────────┐
│ [SeverityBadge] [VulnClass]  GET /api/users/:id  [Copy]    │  ← Header row
│                                                             │
│ Short description of the vulnerability finding...           │  ← Body (1-2 lines)
│                                                             │
│ ▸ Proof of Concept                                          │  ← Collapsible trigger
│ ┌───────────────────────────────────────────────────┐       │
│ │ curl -X GET https://target/api/users/1     [Copy] │       │  ← ReconPoCViewer
│ └───────────────────────────────────────────────────┘       │
│                                                             │
│ Remediation: Apply parameterized queries...    [Details]    │  ← Footer
└─────────────────────────────────────────────────────────────┘
```

## Implementation

```tsx
import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ChevronDown, ExternalLink } from "lucide-react";
import { ReconSeverityBadge } from "./ReconSeverityBadge";
import { ReconPoCViewer } from "./ReconPoCViewer";

const VULN_CLASS_LABEL_KEYS: Record<VulnClass, string> = {
  injection: "recon.vulnClass.injection",
  xss: "recon.vulnClass.xss",
  ssrf: "recon.vulnClass.ssrf",
  auth: "recon.vulnClass.auth",
  authz: "recon.vulnClass.authz",
};

export function ReconFindingCard({
  finding,
  defaultExpanded = false,
  onCopyPoC,
  onViewReport,
  className,
}: ReconFindingCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [showFullDescription, setShowFullDescription] = useState(false);

  const handleCopyEndpoint = useCallback(async () => {
    await navigator.clipboard.writeText(finding.normalizedEndpoint);
  }, [finding.normalizedEndpoint]);

  return (
    <Card
      className={cn(
        "rounded-lg border bg-card shadow-sm",
        className,
      )}
    >
      {/* Header row */}
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3 flex-wrap">
          <ReconSeverityBadge severity={finding.severity} />

          <Badge variant="outline" className="text-xs">
            {t(VULN_CLASS_LABEL_KEYS[finding.vulnClass])}
          </Badge>

          <code
            className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded truncate max-w-[200px]"
            title={finding.normalizedEndpoint}
          >
            {finding.normalizedEndpoint}
          </code>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyEndpoint}
            className="h-7 px-2"
            aria-label={t("recon.findingCard.copy.endpoint")}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* Body */}
      <CardContent className="space-y-3">
        <p
          className={cn(
            "text-sm text-foreground",
            !showFullDescription && "line-clamp-2",
          )}
        >
          {finding.description}
        </p>
        {finding.description.length > 120 && (
          <button
            onClick={() => setShowFullDescription(!showFullDescription)}
            className="text-xs text-primary hover:underline"
          >
            {showFullDescription
              ? t("recon.findingCard.showLess")
              : t("recon.findingCard.showMore")}
          </button>
        )}

        {/* Collapsible PoC */}
        {finding.proofOfConcept && (
          <div>
            <button
              onClick={() => setExpanded(!expanded)}
              className={cn(
                "flex items-center gap-1.5 text-sm font-medium text-muted-foreground",
                "hover:text-foreground transition-colors duration-150",
              )}
              aria-expanded={expanded}
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-150",
                  expanded && "rotate-180",
                )}
              />
              {t("recon.findingCard.poc.title")}
            </button>
            {expanded && (
              <div className="mt-2">
                <ReconPoCViewer
                  poc={finding.proofOfConcept}
                  onCopy={onCopyPoC}
                />
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Footer */}
      {finding.remediationSummary && (
        <CardFooter className="pt-0 pb-4">
          <div className="flex items-start gap-2 w-full text-sm">
            <span className="text-muted-foreground">
              {t("recon.findingCard.remediation")}:
            </span>
            <span className="flex-1 text-foreground line-clamp-1">
              {finding.remediationSummary}
            </span>
            {onViewReport && (
              <Button
                variant="link"
                size="sm"
                onClick={() => onViewReport(finding.id)}
                className="h-auto p-0 text-xs"
              >
                {t("recon.findingCard.viewDetails")}
                <ExternalLink className="h-3 w-3 ms-1 rtl:scale-x-[-1]" />
              </Button>
            )}
          </div>
        </CardFooter>
      )}
    </Card>
  );
}
```

## Constraints

| Rule | Enforcement |
|------|-------------|
| Container | `rounded-lg border bg-card shadow-sm` — flat, no hover lift, no shadow escalation |
| No `hover:-translate-y-*` | Banned entirely |
| No `hover:shadow-md` | Shadow stays at `shadow-sm` |
| No `transition-all` | Only `transition-colors` or `transition-opacity`, max `duration-150` |
| No `animate-pulse` on card | Only allowed on `<Skeleton>` placeholders |
| No `rounded-2xl/3xl/full` on card | Max `rounded-lg` |
| No `bg-gradient-to-*` | Solid fills only |
| No `backdrop-blur` | No glassmorphism |
| No `scale-*` on hover | No zoom effects |
| RTL | All spacing uses logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) |
| External link icon | Mirrored with `rtl:scale-x-[-1]` |
| Semantic HTML | Card is wrapped in `<section aria-labelledby>` |

### Accessibility

```tsx
// The component should be wrapped in a section for semantic meaning:
<section aria-labelledby={`finding-${finding.id}`}>
  <h2 id={`finding-${finding.id}`} className="sr-only">
    {`${finding.severity} ${finding.vulnClass} - ${finding.normalizedEndpoint}`}
  </h2>
  <Card>...</Card>
</section>
```

The collapsible PoC section uses `aria-expanded` on the toggle button.

### Switch Styling Rule

This component does not contain a `<Switch>`, but test assertions should verify the absence of `min-h-[44px]` on any Switch within the component to catch future regressions.

## Vitest Test Outline

```typescript
// ReconFindingCard.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReconFindingCard } from "../ReconFindingCard";

const MOCK_FINDING: ReconFinding = {
  id: "f-001",
  severity: "high",
  vulnClass: "injection",
  normalizedEndpoint: "GET /api/users/:id",
  description:
    "SQL injection vulnerability in the user lookup endpoint allows attackers to extract sensitive data from the database via crafted query parameters.",
  proofOfConcept: {
    kind: "script",
    language: "bash",
    content: "curl -X GET 'https://target/api/users/1%20OR%201=1'",
  },
  remediationSummary: "Apply parameterized queries to all database operations.",
  confirmedAt: "2026-01-15T10:30:00Z",
};

describe("ReconFindingCard", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders severity badge with correct color", () => {
    render(<ReconFindingCard finding={MOCK_FINDING} />);
    const badge = screen.getByText(/recon\.severity\.high/i);
    expect(badge).toBeInTheDocument();
  });

  it("renders vuln class chip", () => {
    render(<ReconFindingCard finding={MOCK_FINDING} />);
    expect(screen.getByText(/recon\.vulnClass\.injection/i)).toBeInTheDocument();
  });

  it("renders normalized endpoint truncated", () => {
    render(<ReconFindingCard finding={MOCK_FINDING} />);
    const codeEl = screen.getByTitle("GET /api/users/:id");
    expect(codeEl).toBeInTheDocument();
    expect(codeEl).toHaveClass("truncate");
  });

  it("copies endpoint to clipboard", async () => {
    render(<ReconFindingCard finding={MOCK_FINDING} />);
    const copyButton = screen.getByLabelText(/recon\.findingCard\.copy\.endpoint/i);
    fireEvent.click(copyButton);
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "GET /api/users/:id",
      );
    });
  });

  it("shows PoC on expand click", () => {
    render(<ReconFindingCard finding={MOCK_FINDING} />);
    const toggle = screen.getByRole("button", { expanded: false });
    fireEvent.click(toggle);
    expect(screen.getByText(/curl/)).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("respects defaultExpanded prop", () => {
    render(
      <ReconFindingCard finding={MOCK_FINDING} defaultExpanded={true} />,
    );
    expect(screen.getByText(/curl/)).toBeInTheDocument();
  });

  it("renders without PoC when proofOfConcept is null", () => {
    const finding = { ...MOCK_FINDING, proofOfConcept: null };
    render(<ReconFindingCard finding={finding} />);
    expect(screen.queryByText(/recon\.findingCard\.poc\.title/i)).not.toBeInTheDocument();
  });

  it("shows 'View details' link when onViewReport provided", () => {
    const onViewReport = vi.fn();
    render(
      <ReconFindingCard
        finding={MOCK_FINDING}
        onViewReport={onViewReport}
      />,
    );
    const link = screen.getByText(/recon\.findingCard\.viewDetails/i);
    fireEvent.click(link);
    expect(onViewReport).toHaveBeenCalledWith("f-001");
  });

  it("shows/hides full description on toggle", () => {
    const longDescription = "A ".repeat(200);
    const finding = { ...MOCK_FINDING, description: longDescription };
    render(<ReconFindingCard finding={finding} />);
    const toggle = screen.getByText(/recon\.findingCard\.showMore/i);
    fireEvent.click(toggle);
    expect(screen.getByText(/recon\.findingCard\.showLess/i)).toBeInTheDocument();
  });

  it.each(["low", "medium", "high", "critical"] as const)(
    "renders all severity levels correctly for '%s'",
    (severity) => {
      const finding = { ...MOCK_FINDING, severity };
      render(<ReconFindingCard finding={finding} />);
      expect(screen.getByText(new RegExp(`recon\\.severity\\.${severity}`))).toBeInTheDocument();
    },
  );

  it("fires onCopyPoC analytics when PoC is copied", async () => {
    const onCopyPoC = vi.fn();
    render(
      <ReconFindingCard
        finding={MOCK_FINDING}
        defaultExpanded={true}
        onCopyPoC={onCopyPoC}
      />,
    );
    const pocCopyButton = screen.getByLabelText(/recon\.findingCard\.copy\.poc/i);
    fireEvent.click(pocCopyButton);
    await waitFor(() => {
      expect(onCopyPoC).toHaveBeenCalled();
    });
  });

  it("has no banned CSS classes (Uncodixify)", () => {
    const { container } = render(
      <ReconFindingCard finding={MOCK_FINDING} />,
    );
    const html = container.innerHTML;
    const banned = [
      "hover:-translate-y",
      "hover:shadow-md",
      "hover:shadow-lg",
      "animate-pulse",
      "transition-all",
      "rounded-2xl",
      "rounded-3xl",
      "rounded-full",
      "bg-gradient-to-",
      "backdrop-blur",
    ];
    banned.forEach((pattern) => {
      expect(html).not.toMatch(new RegExp(pattern));
    });
  });

  it("no min-h-[44px] on Switch (regression guard)", () => {
    const { container } = render(
      <ReconFindingCard finding={MOCK_FINDING} />,
    );
    const switches = container.querySelectorAll("[role='switch']");
    switches.forEach((sw) => {
      expect(sw.className).not.toMatch(/min-h-\[44px\]/);
      expect(sw.className).not.toMatch(/min-w-\[44px\]/);
    });
  });

  it("uses logical properties for RTL", () => {
    const { container } = render(
      <ReconFindingCard finding={MOCK_FINDING} />,
    );
    const html = container.innerHTML;
    expect(html).toMatch(/ms-1|me-/);
    expect(html).not.toMatch(/\bml-\d\b|\bmr-\d\b/);
  });

  it("matches snapshot in en", () => {
    const { container } = render(
      <ReconFindingCard finding={MOCK_FINDING} />,
    );
    expect(container).toMatchSnapshot();
  });

  it("matches snapshot in ar (RTL)", () => {
    document.documentElement.dir = "rtl";
    const { container } = render(
      <ReconFindingCard finding={MOCK_FINDING} />,
    );
    expect(container).toMatchSnapshot();
    document.documentElement.dir = "ltr";
  });

  it("has zero axe-core critical violations", async () => {
    const { container } = render(
      <ReconFindingCard finding={MOCK_FINDING} />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```
