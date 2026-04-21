import { useCallback, useEffect, useRef, useState } from "react";
import {
  listReconScans,
  type ListReconScansParams,
  type ReconScanListItem,
} from "@/services/recon-api";

const POLL_INTERVAL_MS = 10_000;

interface UseReconScansResult {
  scans: ReconScanListItem[];
  setScans: (updater: (prev: ReconScanListItem[]) => ReconScanListItem[]) => void;
  loading: boolean;
  error: string | null;
  nextCursor: string | null;
  refetch: () => Promise<void>;
}

function hasActiveScans(scans: ReconScanListItem[]): boolean {
  return scans.some(
    (s) => s.status === "running" || s.status === "pending",
  );
}

function isVisible(): boolean {
  return typeof document === "undefined" ? true : !document.hidden;
}

export function useReconScans(params: ListReconScansParams): UseReconScansResult {
  const [scans, setScansState] = useState<ReconScanListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetchScans = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const res = await listReconScans(paramsRef.current);
      if (!mountedRef.current) return;
      setScansState(res.scans);
      setNextCursor(res.next_cursor);
      setError(null);
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof Error ? err.message : "Failed to load scans";
      setError(message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const paramsKey = JSON.stringify({
    tab: params.tab,
    cursor: params.cursor,
    project_ids: params.project_ids,
    severities: params.severities,
    limit: params.limit,
  });

  useEffect(() => {
    mountedRef.current = true;
    fetchScans(true);
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, fetchScans]);

  const clearPollInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const setupPolling = useCallback(() => {
    clearPollInterval();
    if (!isVisible()) return;
    if (!hasActiveScans(scans)) return;
    intervalRef.current = setInterval(() => {
      if (!isVisible()) return;
      fetchScans(false);
    }, POLL_INTERVAL_MS);
  }, [scans, clearPollInterval, fetchScans]);

  useEffect(() => {
    setupPolling();
    return clearPollInterval;
  }, [setupPolling, clearPollInterval]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (isVisible()) {
        if (hasActiveScans(scans)) {
          fetchScans(false);
          setupPolling();
        }
      } else {
        clearPollInterval();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [scans, fetchScans, setupPolling, clearPollInterval]);

  const setScans = useCallback(
    (updater: (prev: ReconScanListItem[]) => ReconScanListItem[]) => {
      setScansState(updater);
    },
    [],
  );

  const refetch = useCallback(() => fetchScans(false), [fetchScans]);

  return { scans, setScans, loading, error, nextCursor, refetch };
}

export const RECON_POLL_INTERVAL_MS = POLL_INTERVAL_MS;
