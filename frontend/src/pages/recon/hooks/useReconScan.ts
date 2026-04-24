import { useCallback, useEffect, useRef, useState } from "react";
import {
  getReconScan,
  type ReconScanDetail,
  type ReconScanStatus,
} from "@/services/recon-api";

const POLL_INTERVAL_MS = 5_000;

const ACTIVE_STATUSES: ReconScanStatus[] = ["pending", "running"];

export function isActiveStatus(status: ReconScanStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

function isVisible(): boolean {
  return typeof document === "undefined" ? true : !document.hidden;
}

export interface UseReconScanResult {
  scan: ReconScanDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useReconScan(scanId: string | undefined): UseReconScanResult {
  const [scan, setScan] = useState<ReconScanDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(scanId));
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statusRef = useRef<ReconScanStatus | null>(null);

  const fetchScan = useCallback(
    async (showLoading = false) => {
      if (!scanId) return;
      if (showLoading) setLoading(true);
      try {
        const res = await getReconScan(scanId);
        if (!mountedRef.current) return;
        setScan(res);
        statusRef.current = res.status;
        setError(null);
      } catch (err) {
        if (!mountedRef.current) return;
        const message =
          err instanceof Error ? err.message : "Failed to load scan";
        setError(message);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [scanId],
  );

  const clearPollInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const setupPolling = useCallback(() => {
    clearPollInterval();
    if (!isVisible()) return;
    const status = statusRef.current;
    if (!status || !isActiveStatus(status)) return;
    intervalRef.current = setInterval(() => {
      if (!isVisible()) return;
      const current = statusRef.current;
      if (!current || !isActiveStatus(current)) {
        clearPollInterval();
        return;
      }
      fetchScan(false);
    }, POLL_INTERVAL_MS);
  }, [clearPollInterval, fetchScan]);

  useEffect(() => {
    mountedRef.current = true;
    if (scanId) fetchScan(true);
    return () => {
      mountedRef.current = false;
      clearPollInterval();
    };
  }, [scanId, fetchScan, clearPollInterval]);

  useEffect(() => {
    setupPolling();
    return clearPollInterval;
  }, [scan?.status, setupPolling, clearPollInterval]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibility = () => {
      if (isVisible()) {
        const current = statusRef.current;
        if (current && isActiveStatus(current)) {
          fetchScan(false);
          setupPolling();
        }
      } else {
        clearPollInterval();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchScan, setupPolling, clearPollInterval]);

  const refetch = useCallback(() => fetchScan(false), [fetchScan]);

  return { scan, loading, error, refetch };
}

export const RECON_SCAN_POLL_INTERVAL_MS = POLL_INTERVAL_MS;
