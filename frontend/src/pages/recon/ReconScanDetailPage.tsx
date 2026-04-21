import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useNavigate,
  useParams,
  useSearchParams,
  Link,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  ChevronRight,
  Download,
  MoreVertical,
  Ban,
  PlayCircle,
  FileText,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ReconScanStatusBadge } from "@/components/recon/ReconScanStatusBadge";
import { ReconSeverityBadge } from "@/components/recon/ReconSeverityBadge";
import { cn } from "@/lib/utils";
import {
  cancelReconScan,
  getReconReportPdfUrl,
  listReconArtifacts,
  listReconFindings,
  resumeReconScan,
  type ReconFinding,
  type ReconScanArtifact,
  type ReconScanStatus,
  type ReconSeverity,
  type ReconVulnClass,
} from "@/services/recon-api";
import { isActiveStatus, useReconScan } from "./hooks/useReconScan";
import { PhaseTimeline } from "./components/PhaseTimeline";
import { ReportViewer } from "./components/ReportViewer";
import { FindingCard } from "./components/FindingCard";

export type ReconDetailTab = "findings" | "phases" | "report" | "raw";

const VALID_TABS: ReconDetailTab[] = ["findings", "phases", "report", "raw"];
const VALID_SEVERITIES: ReconSeverity[] = [
  "critical",
  "high",
  "medium",
  "low",
];
const VALID_VULN_CLASSES: ReconVulnClass[] = [
  "injection",
  "xss",
  "ssrf",
  "auth",
  "authz",
];
const VALID_SORTS = ["severity", "chronological"] as const;
type SortMode = (typeof VALID_SORTS)[number];

const TERMINAL_STATUSES: ReconScanStatus[] = [
  "completed",
  "failed",
  "cancelled",
  "stuck",
];

const LARGE_ARTIFACT_BYTES = 10 * 1024 * 1024;

function parseMulti(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

function defaultTabForStatus(status: ReconScanStatus): ReconDetailTab {
  if (status === "completed") return "findings";
  return "phases";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function SeverityFilterChips({
  selected,
  onToggle,
}: {
  selected: ReconSeverity[];
  onToggle: (s: ReconSeverity) => void;
}) {
  const { t } = useTranslation("recon");
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={t("recon.detail.findings.filter.severity")}
    >
      <span className="text-xs text-muted-foreground">
        {t("recon.detail.findings.filter.severity")}:
      </span>
      {VALID_SEVERITIES.map((s) => {
        const active = selected.includes(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => onToggle(s)}
            aria-pressed={active}
            data-testid={`filter-severity-${s}`}
            className={cn(
              "rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-150",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            {t(`recon.severity.${s}`)}
          </button>
        );
      })}
    </div>
  );
}

function VulnClassFilterChips({
  selected,
  onToggle,
}: {
  selected: ReconVulnClass[];
  onToggle: (s: ReconVulnClass) => void;
}) {
  const { t } = useTranslation("recon");
  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="group"
      aria-label={t("recon.detail.findings.filter.vulnClass")}
    >
      <span className="text-xs text-muted-foreground">
        {t("recon.detail.findings.filter.vulnClass")}:
      </span>
      {VALID_VULN_CLASSES.map((c) => {
        const active = selected.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => onToggle(c)}
            aria-pressed={active}
            data-testid={`filter-vuln-${c}`}
            className={cn(
              "rounded-md border px-2 py-1 text-xs font-medium transition-colors duration-150",
              active
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted/50",
            )}
          >
            {t(`recon.vulnClass.${c}`)}
          </button>
        );
      })}
    </div>
  );
}

export function ReconScanDetailPage() {
  const { t } = useTranslation("recon");
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { scan, loading: scanLoading, error: scanError, refetch } =
    useReconScan(scanId);

  const status = scan?.status;
  const rawTab = searchParams.get("tab");
  const tab: ReconDetailTab = useMemo(() => {
    if (rawTab && (VALID_TABS as string[]).includes(rawTab)) {
      return rawTab as ReconDetailTab;
    }
    if (!status) return "phases";
    return defaultTabForStatus(status);
  }, [rawTab, status]);

  const severities = useMemo(
    () =>
      parseMulti(searchParams.get("severity")).filter(
        (s): s is ReconSeverity =>
          VALID_SEVERITIES.includes(s as ReconSeverity),
      ),
    [searchParams],
  );
  const vulnClasses = useMemo(
    () =>
      parseMulti(searchParams.get("vulnClass")).filter(
        (c): c is ReconVulnClass =>
          VALID_VULN_CLASSES.includes(c as ReconVulnClass),
      ),
    [searchParams],
  );
  const sort = useMemo<SortMode>(() => {
    const raw = searchParams.get("sort");
    return (VALID_SORTS as readonly string[]).includes(raw ?? "")
      ? (raw as SortMode)
      : "severity";
  }, [searchParams]);

  const updateSearch = useCallback(
    (mutator: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams);
      mutator(next);
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const handleTabChange = useCallback(
    (next: string) => {
      if (!(VALID_TABS as string[]).includes(next)) return;
      updateSearch((p) => p.set("tab", next));
    },
    [updateSearch],
  );

  const toggleSeverity = useCallback(
    (s: ReconSeverity) => {
      const has = severities.includes(s);
      const nextList = has
        ? severities.filter((x) => x !== s)
        : [...severities, s];
      updateSearch((p) => {
        if (nextList.length) p.set("severity", nextList.join(","));
        else p.delete("severity");
      });
    },
    [severities, updateSearch],
  );

  const toggleVulnClass = useCallback(
    (c: ReconVulnClass) => {
      const has = vulnClasses.includes(c);
      const nextList = has
        ? vulnClasses.filter((x) => x !== c)
        : [...vulnClasses, c];
      updateSearch((p) => {
        if (nextList.length) p.set("vulnClass", nextList.join(","));
        else p.delete("vulnClass");
      });
    },
    [vulnClasses, updateSearch],
  );

  const setSort = useCallback(
    (next: SortMode) => {
      updateSearch((p) => p.set("sort", next));
    },
    [updateSearch],
  );

  // ---- findings ----
  const [findings, setFindings] = useState<ReconFinding[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [findingsError, setFindingsError] = useState<string | null>(null);

  useEffect(() => {
    if (!scanId || tab !== "findings" || status !== "completed") return;
    let cancelled = false;
    setFindingsLoading(true);
    setFindingsError(null);
    listReconFindings(scanId, {
      severities,
      vuln_classes: vulnClasses,
      sort,
    })
      .then((res) => {
        if (!cancelled) setFindings(res.findings);
      })
      .catch((err) => {
        if (!cancelled)
          setFindingsError(
            err instanceof Error ? err.message : "Failed to load findings",
          );
      })
      .finally(() => {
        if (!cancelled) setFindingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scanId, tab, status, severities, vulnClasses, sort]);

  // ---- artifacts ----
  const [artifacts, setArtifacts] = useState<ReconScanArtifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);
  const [artifactsError, setArtifactsError] = useState<string | null>(null);
  const [pendingArtifact, setPendingArtifact] =
    useState<ReconScanArtifact | null>(null);

  useEffect(() => {
    if (!scanId || tab !== "raw") return;
    let cancelled = false;
    setArtifactsLoading(true);
    setArtifactsError(null);
    listReconArtifacts(scanId)
      .then((res) => {
        if (!cancelled) setArtifacts(res.artifacts);
      })
      .catch((err) => {
        if (!cancelled)
          setArtifactsError(
            err instanceof Error ? err.message : "Failed to load artifacts",
          );
      })
      .finally(() => {
        if (!cancelled) setArtifactsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scanId, tab]);

  // ---- actions ----
  const [cancelOpen, setCancelOpen] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeUrl, setResumeUrl] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const canCancel = status ? isActiveStatus(status) : false;
  const canResume = status
    ? (["failed", "cancelled", "stuck"] as ReconScanStatus[]).includes(status)
    : false;
  const canDownload = status === "completed";

  const openResume = useCallback(() => {
    if (!scan) return;
    setResumeUrl(scan.target_url);
    setActionError(null);
    setResumeOpen(true);
  }, [scan]);

  const confirmCancel = useCallback(async () => {
    if (!scan) return;
    setActionPending(true);
    setActionError(null);
    try {
      await cancelReconScan(scan.id);
      setCancelOpen(false);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setActionPending(false);
    }
  }, [scan, refetch]);

  const confirmResume = useCallback(async () => {
    if (!scan) return;
    if (resumeUrl.trim() === "") {
      setActionError(t("recon.actions.resumeConfirm.urlRequired"));
      return;
    }
    if (resumeUrl.trim() !== scan.target_url) {
      setActionError(t("recon.actions.resumeConfirm.urlMismatch"));
      return;
    }
    setActionPending(true);
    setActionError(null);
    try {
      await resumeReconScan(scan.id, resumeUrl.trim());
      setResumeOpen(false);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setActionPending(false);
    }
  }, [scan, resumeUrl, refetch, t]);

  const handleRerun = useCallback(() => {
    if (!scan) return;
    const params = new URLSearchParams({
      project_id: scan.project_id,
      environment_id: scan.environment_id,
      target_url: scan.target_url,
    });
    navigate(`/recon/new?${params.toString()}`);
  }, [scan, navigate]);

  const handleDownloadPdf = useCallback(() => {
    if (!scan) return;
    window.open(getReconReportPdfUrl(scan.id), "_blank", "noopener,noreferrer");
  }, [scan]);

  const handleArtifactClick = useCallback(
    (artifact: ReconScanArtifact) => {
      if (artifact.size_bytes > LARGE_ARTIFACT_BYTES) {
        setPendingArtifact(artifact);
        return;
      }
      window.open(artifact.download_url, "_blank", "noopener,noreferrer");
    },
    [],
  );

  const confirmArtifactDownload = useCallback(() => {
    if (!pendingArtifact) return;
    window.open(
      pendingArtifact.download_url,
      "_blank",
      "noopener,noreferrer",
    );
    setPendingArtifact(null);
  }, [pendingArtifact]);

  // ---- loading / error ----
  if (scanLoading && !scan) {
    return (
      <div className="space-y-4" data-testid="scan-detail-loading">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (scanError && !scan) {
    return (
      <div className="rounded-lg border bg-card p-6" role="alert">
        <p className="text-sm text-destructive">{scanError}</p>
      </div>
    );
  }

  if (!scan) return null;

  const truncatedId =
    scan.id.length > 12 ? `${scan.id.slice(0, 8)}…` : scan.id;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-2 text-sm text-muted-foreground"
      >
        <Link to="/recon" className="hover:text-foreground transition-colors duration-150">
          {t("recon.list.title")}
        </Link>
        <ChevronRight
          className="h-4 w-4 rtl:scale-x-[-1]"
          aria-hidden="true"
        />
        <span className="truncate">{scan.project_name}</span>
        <ChevronRight
          className="h-4 w-4 rtl:scale-x-[-1]"
          aria-hidden="true"
        />
        <span
          className="font-mono text-xs text-foreground"
          data-testid="breadcrumb-scan-id"
        >
          {t("recon.detail.breadcrumb.scan")} {truncatedId}
        </span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
              {scan.project_name}
            </h1>
            <ReconScanStatusBadge status={scan.status} />
            {scan.environment_tag === "production" && (
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800"
              >
                {t("recon.list.environment.productionTag")}
              </Badge>
            )}
          </div>
          <p
            className="text-sm text-muted-foreground truncate"
            dir="ltr"
          >
            {scan.target_url}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="scan-actions-menu"
              aria-label="Scan actions"
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={!canCancel}
              onSelect={() => {
                setActionError(null);
                setCancelOpen(true);
              }}
              data-testid="action-cancel"
            >
              <Ban className="h-4 w-4 me-2" aria-hidden="true" />
              {t("recon.detail.actions.cancel")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canResume}
              onSelect={openResume}
              data-testid="action-resume"
            >
              <PlayCircle className="h-4 w-4 me-2" aria-hidden="true" />
              {t("recon.detail.actions.resume")}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canDownload}
              onSelect={handleDownloadPdf}
              data-testid="action-download-pdf"
            >
              <Download className="h-4 w-4 me-2" aria-hidden="true" />
              {t("recon.detail.actions.downloadPdf")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={handleRerun}
              data-testid="action-rerun"
            >
              <RefreshCcw className="h-4 w-4 me-2" aria-hidden="true" />
              {t("recon.detail.actions.rerun")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stuck banner */}
      {scan.status === "stuck" && (
        <Alert variant="destructive" data-testid="stuck-banner">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>{t("recon.detail.phases.stuckBanner")}</AlertTitle>
          <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>{scan.target_url}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openResume}
              data-testid="stuck-resume-cta"
            >
              {t("recon.detail.phases.stuckCta")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="findings" data-testid="tab-findings">
            {t("recon.detail.tab.findings")}
          </TabsTrigger>
          <TabsTrigger value="phases" data-testid="tab-phases">
            {t("recon.detail.tab.phases")}
          </TabsTrigger>
          <TabsTrigger value="report" data-testid="tab-report">
            {t("recon.detail.tab.report")}
          </TabsTrigger>
          <TabsTrigger value="raw" data-testid="tab-raw">
            {t("recon.detail.tab.raw")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="findings" className="mt-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                <SeverityFilterChips
                  selected={severities}
                  onToggle={toggleSeverity}
                />
                <VulnClassFilterChips
                  selected={vulnClasses}
                  onToggle={toggleVulnClass}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={sort === "severity" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSort("severity")}
                  data-testid="sort-severity"
                >
                  {t("recon.detail.findings.sort.severity")}
                </Button>
                <Button
                  type="button"
                  variant={sort === "chronological" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSort("chronological")}
                  data-testid="sort-chronological"
                >
                  {t("recon.detail.findings.sort.chronological")}
                </Button>
              </div>
            </div>

            {findingsLoading ? (
              <div className="space-y-3" data-testid="findings-loading">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full" />
                ))}
              </div>
            ) : findingsError ? (
              <div
                className="rounded-lg border bg-card p-6"
                role="alert"
              >
                <p className="text-sm text-destructive">{findingsError}</p>
              </div>
            ) : scan.status !== "completed" ? (
              <div
                className="rounded-lg border bg-card p-6 text-sm text-muted-foreground"
                data-testid="findings-pending"
              >
                {t("recon.detail.report.notReady")}
              </div>
            ) : findings.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center rounded-lg border bg-card py-12 px-6 text-center"
                data-testid="findings-empty"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border bg-muted/50">
                  <ShieldCheck
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-sm text-foreground font-medium">
                  {t("recon.detail.findings.empty")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {findings.map((f) => (
                  <FindingCard key={f.id} finding={f} />
                ))}
              </div>
            )}

            {scan.severity_counts && (
              <div className="flex flex-wrap items-center gap-2">
                {(VALID_SEVERITIES as ReconSeverity[])
                  .filter((s) => (scan.severity_counts?.[s] ?? 0) > 0)
                  .map((s) => (
                    <ReconSeverityBadge
                      key={s}
                      severity={s}
                      count={scan.severity_counts[s]}
                    />
                  ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="phases" className="mt-4">
          <div className="rounded-lg border bg-card p-4 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-foreground">
              {t("recon.detail.phases.title")}
            </h2>
            <PhaseTimeline phases={scan.phases ?? []} />
          </div>
        </TabsContent>

        <TabsContent value="report" className="mt-4">
          <ReportViewer
            scanId={scan.id}
            ready={scan.status === "completed"}
          />
        </TabsContent>

        <TabsContent value="raw" className="mt-4">
          <div className="rounded-lg border bg-card">
            {artifactsLoading ? (
              <div className="p-4 space-y-3" data-testid="artifacts-loading">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : artifactsError ? (
              <div className="p-6" role="alert">
                <p className="text-sm text-destructive">{artifactsError}</p>
              </div>
            ) : artifacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border bg-muted/50">
                  <FileText
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("recon.detail.findings.empty")}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      {t("recon.detail.raw.col.phase")}
                    </TableHead>
                    <TableHead>{t("recon.detail.raw.col.kind")}</TableHead>
                    <TableHead>{t("recon.detail.raw.col.size")}</TableHead>
                    <TableHead>
                      {t("recon.detail.raw.col.createdAt")}
                    </TableHead>
                    <TableHead className="text-end">
                      {t("recon.detail.raw.col.download")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {artifacts.map((artifact) => (
                    <TableRow
                      key={artifact.id}
                      data-testid={`artifact-row-${artifact.id}`}
                    >
                      <TableCell className="text-sm">{artifact.phase}</TableCell>
                      <TableCell className="text-sm">{artifact.kind}</TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {formatBytes(artifact.size_bytes)}
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {new Date(artifact.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArtifactClick(artifact)}
                          data-testid={`artifact-download-${artifact.id}`}
                        >
                          <Download
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Cancel dialog */}
      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          if (!open) setCancelOpen(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recon.actions.cancelConfirm.title")}</DialogTitle>
            <DialogDescription>
              {t("recon.actions.cancelConfirm.body")}
            </DialogDescription>
          </DialogHeader>
          {actionError && (
            <p className="text-sm text-destructive" role="alert">
              {actionError}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelOpen(false)}
              disabled={actionPending}
            >
              {t("recon.actions.cancelConfirm.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmCancel}
              disabled={actionPending}
              data-testid="confirm-cancel"
            >
              {t("recon.actions.cancelConfirm.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resume dialog */}
      <Dialog
        open={resumeOpen}
        onOpenChange={(open) => {
          if (!open) {
            setResumeOpen(false);
            setActionError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("recon.actions.resumeConfirm.title")}</DialogTitle>
            <DialogDescription>
              {t("recon.actions.resumeConfirm.body")}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resume-url">
              {t("recon.actions.resumeConfirm.urlLabel")}
            </Label>
            <Input
              id="resume-url"
              type="url"
              value={resumeUrl}
              onChange={(e) => setResumeUrl(e.target.value)}
              placeholder={t("recon.actions.resumeConfirm.urlPlaceholder")}
              data-testid="resume-url-input"
            />
            {actionError && (
              <p className="text-sm text-destructive" role="alert">
                {actionError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setResumeOpen(false);
                setActionError(null);
              }}
              disabled={actionPending}
            >
              {t("recon.actions.resumeConfirm.cancel")}
            </Button>
            <Button
              type="button"
              onClick={confirmResume}
              disabled={actionPending || resumeUrl.trim() === ""}
              data-testid="confirm-resume"
            >
              {t("recon.actions.resumeConfirm.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Large artifact download confirmation */}
      <Dialog
        open={pendingArtifact !== null}
        onOpenChange={(open) => {
          if (!open) setPendingArtifact(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("recon.detail.raw.largeDownload.title")}
            </DialogTitle>
            <DialogDescription>
              {t("recon.detail.raw.largeDownload.body")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingArtifact(null)}
            >
              {t("recon.detail.raw.largeDownload.cancel")}
            </Button>
            <Button
              type="button"
              onClick={confirmArtifactDownload}
              data-testid="confirm-large-download"
            >
              {t("recon.detail.raw.largeDownload.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
