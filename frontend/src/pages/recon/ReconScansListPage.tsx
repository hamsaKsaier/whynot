import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldCheck } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ReconNewScanButton } from "./components/ReconNewScanButton";
import { ReconScanRow } from "./components/ReconScanRow";
import { useReconScans } from "./hooks/useReconScans";
import {
  cancelReconScan,
  resumeReconScan,
  type ReconListTab,
  type ReconScanListItem,
  type ReconSeverity,
} from "@/services/recon-api";

const VALID_TABS: ReconListTab[] = ["running", "completed", "failed", "all"];
const VALID_SEVERITIES: ReconSeverity[] = ["critical", "high", "medium", "low"];

function parseTab(raw: string | null): ReconListTab {
  return VALID_TABS.includes(raw as ReconListTab)
    ? (raw as ReconListTab)
    : "running";
}

function parseMulti(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSeverities(raw: string | null): ReconSeverity[] {
  return parseMulti(raw).filter((s): s is ReconSeverity =>
    VALID_SEVERITIES.includes(s as ReconSeverity),
  );
}

export function ReconScansListPage() {
  const { t } = useTranslation("recon");
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = parseTab(searchParams.get("tab"));
  const projectIds = parseMulti(searchParams.get("project"));
  const severities = parseSeverities(searchParams.get("severity"));
  const cursor = searchParams.get("cursor");

  const queryParams = useMemo(
    () => ({
      tab,
      cursor: cursor ?? undefined,
      project_ids: projectIds,
      severities,
    }),
    [tab, cursor, projectIds.join(","), severities.join(",")],
  );

  const { scans, setScans, loading, error, nextCursor, refetch } =
    useReconScans(queryParams);

  const [cancelTarget, setCancelTarget] = useState<ReconScanListItem | null>(null);
  const [resumeTarget, setResumeTarget] = useState<ReconScanListItem | null>(null);
  const [resumeUrl, setResumeUrl] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  const handleTabChange = useCallback(
    (value: string) => {
      const next = parseTab(value);
      const newParams = new URLSearchParams(searchParams);
      newParams.set("tab", next);
      newParams.delete("cursor");
      setSearchParams(newParams, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const openCancel = useCallback((scan: ReconScanListItem) => {
    setActionError(null);
    setCancelTarget(scan);
  }, []);

  const openResume = useCallback((scan: ReconScanListItem) => {
    setActionError(null);
    setResumeUrl(scan.target_url);
    setResumeTarget(scan);
  }, []);

  const confirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setActionPending(true);
    const id = cancelTarget.id;
    setScans((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "cancelled" } : s)),
    );
    try {
      await cancelReconScan(id);
      setCancelTarget(null);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Cancel failed");
      await refetch();
    } finally {
      setActionPending(false);
    }
  }, [cancelTarget, refetch, setScans]);

  const confirmResume = useCallback(async () => {
    if (!resumeTarget) return;
    if (resumeUrl.trim() === "") {
      setActionError(t("recon.actions.resumeConfirm.urlRequired"));
      return;
    }
    if (resumeUrl.trim() !== resumeTarget.target_url) {
      setActionError(t("recon.actions.resumeConfirm.urlMismatch"));
      return;
    }
    setActionPending(true);
    try {
      await resumeReconScan(resumeTarget.id, resumeUrl.trim());
      setResumeTarget(null);
      await refetch();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setActionPending(false);
    }
  }, [resumeTarget, resumeUrl, refetch, t]);

  const goToNextPage = useCallback(() => {
    if (!nextCursor) return;
    const newParams = new URLSearchParams(searchParams);
    newParams.set("cursor", nextCursor);
    setSearchParams(newParams, { replace: true });
  }, [nextCursor, searchParams, setSearchParams]);

  return (
    <div>
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
            {t("recon.list.title")}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {t("recon.list.subtitle")}
          </p>
        </div>
        <ReconNewScanButton />
      </div>

      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="running" className="flex-1 sm:flex-initial">
            {t("recon.list.tab.running")}
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 sm:flex-initial">
            {t("recon.list.tab.completed")}
          </TabsTrigger>
          <TabsTrigger value="failed" className="flex-1 sm:flex-initial">
            {t("recon.list.tab.failed")}
          </TabsTrigger>
          <TabsTrigger value="all" className="flex-1 sm:flex-initial">
            {t("recon.list.tab.all")}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 border rounded-lg bg-card">
        {loading ? (
          <LoadingRows />
        ) : error ? (
          <div className="p-8 text-center text-sm text-destructive" role="alert">
            {error}
          </div>
        ) : scans.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("recon.list.col.project")}</TableHead>
                  <TableHead>{t("recon.list.col.environment")}</TableHead>
                  <TableHead>{t("recon.list.col.status")}</TableHead>
                  <TableHead>{t("recon.list.col.severity")}</TableHead>
                  <TableHead>{t("recon.list.col.startedAt")}</TableHead>
                  <TableHead>{t("recon.list.col.duration")}</TableHead>
                  <TableHead>{t("recon.list.col.cost")}</TableHead>
                  <TableHead className="text-end">
                    {t("recon.list.col.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((scan) => (
                  <ReconScanRow
                    key={scan.id}
                    scan={scan}
                    onCancel={openCancel}
                    onResume={openResume}
                  />
                ))}
              </TableBody>
            </Table>
            {nextCursor && (
              <div className="flex justify-center p-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  data-testid="load-more"
                >
                  {t("recon.list.loadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
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
              onClick={() => setCancelTarget(null)}
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

      <Dialog
        open={resumeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setResumeTarget(null);
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
                setResumeTarget(null);
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
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="p-4 space-y-3" data-testid="scans-loading">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-16 ms-auto" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation("recon");
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
      data-testid="scans-empty"
    >
      <div className="h-12 w-12 rounded-lg border bg-muted/50 flex items-center justify-center mb-4">
        <ShieldCheck
          className="h-6 w-6 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <h2 className="text-base font-semibold text-foreground">
        {t("recon.list.empty.title")}
      </h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        {t("recon.list.empty.body")}
      </p>
      <div className="mt-4">
        <ReconNewScanButton />
      </div>
    </div>
  );
}
