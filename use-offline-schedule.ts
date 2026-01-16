import { useState, useEffect, useCallback } from "react";
import { get, set, del } from "idb-keyval";

interface OfflineScheduleData {
  schedule: any;
  exceptions: any[];
  timestamp: number;
  version: number | null;
}

const OFFLINE_KEY = "anchor_offline_schedule";
const OFFLINE_TTL_MS = 24 * 60 * 60 * 1000;

export function useOfflineSchedule() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<OfflineScheduleData | null>(null);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    get<OfflineScheduleData>(OFFLINE_KEY).then((data) => {
      if (data && Date.now() - data.timestamp < OFFLINE_TTL_MS) {
        setOfflineData(data);
      } else if (data) {
        del(OFFLINE_KEY);
      }
    });
  }, []);

  const saveForOffline = useCallback(
    async (schedule: any, exceptions: any[], version: number | null) => {
      const data: OfflineScheduleData = {
        schedule,
        exceptions,
        timestamp: Date.now(),
        version,
      };
      await set(OFFLINE_KEY, data);
      setOfflineData(data);
    },
    []
  );

  const clearOfflineData = useCallback(async () => {
    await del(OFFLINE_KEY);
    setOfflineData(null);
  }, []);

  const markPendingSync = useCallback((pending: boolean) => {
    setHasPendingSync(pending);
    if (pending) {
      localStorage.setItem("anchor_pending_sync", "true");
    } else {
      localStorage.removeItem("anchor_pending_sync");
    }
  }, []);

  return {
    isOnline,
    offlineData,
    hasPendingSync,
    saveForOffline,
    clearOfflineData,
    markPendingSync,
  };
}
