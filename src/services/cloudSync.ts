import {
  BuildingMaintenanceItem,
  Language,
  NotificationSettings,
  ServiceProvider,
  ThemeId,
  VehicleItem,
} from '../types';
import { fetchApiWithFallback } from './googleWorkspace';

export interface AppSyncStatePayload {
  version?: number;
  updatedAt?: string;
  sourceDevice?: string;
  lang?: Language;
  themeId?: ThemeId;
  buildingItems?: BuildingMaintenanceItem[];
  vehicles?: VehicleItem[];
  providers?: ServiceProvider[];
  notificationSettings?: NotificationSettings;
}

let lastSyncedJson = '';
let syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastKnownVersion = 0;
let lastKnownUpdatedAt = '';

/**
 * Fetches the latest state from the online server.
 * Used on initial page load / refresh and periodic background polling.
 */
export async function fetchOnlineState(): Promise<AppSyncStatePayload | null> {
  try {
    const res = await fetchApiWithFallback('/api/app-state', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.ok && data.state) {
        if (data.state.version) lastKnownVersion = data.state.version;
        if (data.state.updatedAt) lastKnownUpdatedAt = data.state.updatedAt;
        return data.state as AppSyncStatePayload;
      }
    }
  } catch (err) {
    console.warn('Could not fetch online app state:', err);
  }
  return null;
}

/**
 * Saves state online so it is immediately accessible from phone or any other browser window.
 */
export async function saveOnlineState(
  payload: AppSyncStatePayload,
  immediate: boolean = false
): Promise<boolean> {
  const currentJson = JSON.stringify({
    lang: payload.lang,
    themeId: payload.themeId,
    buildingItems: payload.buildingItems,
    vehicles: payload.vehicles,
    providers: payload.providers,
    notificationSettings: payload.notificationSettings,
  });

  // Don't duplicate requests if nothing actually changed
  if (currentJson === lastSyncedJson && !immediate) {
    return true;
  }

  const doSync = async () => {
    try {
      const res = await fetchApiWithFallback('/api/app-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...payload,
          sourceDevice:
            typeof navigator !== 'undefined' && /Mobi|Android/i.test(navigator.userAgent)
              ? 'phone'
              : 'web',
        }),
      });

      if (res.ok) {
        lastSyncedJson = currentJson;
        const resData = await res.json();
        if (resData?.version) lastKnownVersion = resData.version;
        if (resData?.updatedAt) lastKnownUpdatedAt = resData.updatedAt;
        return true;
      }
    } catch (err) {
      console.warn('Could not save online state:', err);
    }
    return false;
  };

  if (immediate) {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    return await doSync();
  }

  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(doSync, 800);
  return true;
}

/**
 * Subscribes to online changes. Whenever the window gains focus or visibility,
 * or on a periodic interval, checks if a newer state was saved from the phone.
 */
export function subscribeToOnlineStateUpdates(
  onUpdate: (state: AppSyncStatePayload) => void
): () => void {
  let isChecking = false;

  const checkForRemoteUpdates = async () => {
    if (isChecking) return;
    isChecking = true;
    try {
      const remote = await fetchOnlineState();
      if (remote) {
        const isNewer =
          (remote.version && remote.version > lastKnownVersion) ||
          (remote.updatedAt && remote.updatedAt !== lastKnownUpdatedAt);

        if (isNewer) {
          onUpdate(remote);
        }
      }
    } finally {
      isChecking = false;
    }
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      checkForRemoteUpdates();
    }
  };

  window.addEventListener('focus', checkForRemoteUpdates);
  document.addEventListener('visibilitychange', handleVisibility);

  // Periodic poll every 12 seconds so phone and web stay in lockstep even without refreshing
  const intervalId = window.setInterval(checkForRemoteUpdates, 12000);

  return () => {
    window.removeEventListener('focus', checkForRemoteUpdates);
    document.removeEventListener('visibilitychange', handleVisibility);
    window.clearInterval(intervalId);
  };
}
