import { useCallback, useState } from "react";
import {
  createReconScan,
  type CreateReconScanRequest,
  type CreateReconScanResponse,
} from "@/services/recon-api";

interface UseCreateReconScanResult {
  submit: (payload: CreateReconScanRequest) => Promise<CreateReconScanResponse>;
  pending: boolean;
  error: string | null;
  resetError: () => void;
}

export function useCreateReconScan(): UseCreateReconScanResult {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (payload: CreateReconScanRequest) => {
      setPending(true);
      setError(null);
      try {
        const res = await createReconScan(payload);
        return res;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create scan";
        setError(message);
        throw err;
      } finally {
        setPending(false);
      }
    },
    [],
  );

  const resetError = useCallback(() => setError(null), []);

  return { submit, pending, error, resetError };
}
