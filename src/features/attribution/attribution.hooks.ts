import { useEffect, useRef } from "react";

import { captureAttributionOnce, trackInstallOnce } from "./attribution.service";

export function useAttributionCapture(): void {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void captureAttributionOnce();
  }, []);
}

export function useInstallTrack(): void {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void trackInstallOnce();
  }, []);
}
