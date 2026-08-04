import type { RateSchedule } from "@ev/shared";
import { useEffect, useState } from "react";
import { getRateSchedule } from "../api/client";

/** Static config for the app's lifetime — fetched once, no polling. */
export function useRateSchedule() {
  const [rateSchedule, setRateSchedule] = useState<RateSchedule | null>(null);

  useEffect(() => {
    getRateSchedule()
      .then(setRateSchedule)
      .catch(() => setRateSchedule(null));
  }, []);

  return rateSchedule;
}
