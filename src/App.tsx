/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Car,
  Wrench,
  FileSpreadsheet,
  Settings,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  X,
  ArrowLeft,
  ArrowRight,
  Award,
  Search,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  BuildingMaintenanceItem,
  InspectionStatus,
  Language,
  MainPage,
  NotificationSettings,
  ServiceProvider,
  ThemeId,
  UnifiedInspectionEntry,
  VehicleItem,
  VignetteCountry,
  VignetteDurationCode,
} from './types';
import { THEMES, TRANSLATIONS } from './i18n';
import {
  createInitialBuildingItems,
  createInitialVehicles,
  INITIAL_PROVIDERS,
  VIGNETTE_COUNTRIES,
} from './data/initialData';
import {
  calculateCombinedExpiryDate,
  calculateItpExpiryDate,
  calculateVignetteExpiryDate,
  formatDateDisplay,
  formatTodayISO,
  getDaysRemaining,
  getInspectionStatus,
} from './utils/dateUtils';
import {
  AppEmblem,
  OfflineIndicator,
  PWAInstallButton,
} from './components/AppEmblem';
import { BuildingMaintenanceView } from './components/BuildingMaintenanceView';
import { VehiclesView } from './components/VehiclesView';
import { ProvidersView } from './components/ProvidersView';
import {
  ReportsView,
  SettingsView,
} from './components/ReportsAndSettingsView';
import {
  autoConnectEmailClientOnStartup,
  googleSignIn,
  initAuth,
  logout,
  sendGmailAlertEmail,
  syncStateToBackgroundDaemon,
  uploadBackupToGoogleDrive,
} from './services/googleWorkspace';
import {
  DEFAULT_EMAIL_SIGNATURE,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_EMAIL_TEMPLATE,
  renderEmailHtml,
  renderEmailSubject,
} from './utils/emailTemplateUtils';

const STORAGE_KEY = 'ffm_lucian_pop_state_v1';

export default function App() {
  // Persistent State initialization
  const [lang, setLang] = useState<Language>('ro');
  const [themeId, setThemeId] = useState<ThemeId>('midnight-cobalt');
  const [buildingItems, setBuildingItems] = useState<BuildingMaintenanceItem[]>(
    () => createInitialBuildingItems()
  );
  const [vehicles, setVehicles] = useState<VehicleItem[]>(() =>
    createInitialVehicles()
  );
  const [providers, setProviders] =
    useState<ServiceProvider[]>(INITIAL_PROVIDERS);
  const [notificationSettings, setNotificationSettings] =
    useState<NotificationSettings>({
      pushEnabled: true,
      emailEnabled: true,
      autoEmailEnabled: true,
      autoDailyBackup: true,
      emailClientConnected: true,
      backgroundDaemonActive: true,
      notificationTimeCET: '09:00',
      leadValue: 7,
      leadUnit: 'days',
      senderEmail: 'lucian.pop88@gmail.com',
      recipientEmail: 'Facilityandfleetmaintanance@gmail.com',
      backupDriveEmail: 'facilityandfleetmaintanance@gmail.com',
      customEmailSubject: DEFAULT_EMAIL_SUBJECT,
      customEmailTemplate: DEFAULT_EMAIL_TEMPLATE,
      customEmailSignature: DEFAULT_EMAIL_SIGNATURE,
    });

  // Navigation State
  const [activePage, setActivePage] = useState<MainPage>('dashboard');
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState<boolean>(false);
  const [expandBuildingMenu, setExpandBuildingMenu] = useState<boolean>(false);
  const [expandVehiclesMenu, setExpandVehiclesMenu] = useState<boolean>(false);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string | null>(
    null
  );
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(
    null
  );

  // Dashboard Active Rubric Menu: 'overdue' | 'due_soon' | 'ok' | null
  const [activeDashboardRubric, setActiveDashboardRubric] =
    useState<InspectionStatus | null>(null);

  // Modals for Add Maintenance Item & Add Vehicle
  const [showAddBuildingModal, setShowAddBuildingModal] =
    useState<boolean>(false);
  const [showAddVehicleModal, setShowAddVehicleModal] =
    useState<boolean>(false);

  // Add Building Modal Form State
  const [newBldgName, setNewBldgName] = useState<string>('');
  const [newBldgBaseDate, setNewBldgBaseDate] = useState<string>(
    formatTodayISO()
  );
  const [newBldgYears, setNewBldgYears] = useState<number>(0);
  const [newBldgMonths, setNewBldgMonths] = useState<number>(6);
  const [newBldgWeeks, setNewBldgWeeks] = useState<number>(0);
  const [newBldgDays, setNewBldgDays] = useState<number>(0);
  const [newBldgProvider, setNewBldgProvider] = useState<string>('');

  // Add Vehicle Modal Form State
  const [newVehPlate, setNewVehPlate] = useState<string>('');
  const [newVehVin, setNewVehVin] = useState<string>('');
  const [newVehUser, setNewVehUser] = useState<string>('');
  const [newVehModel, setNewVehModel] = useState<string>('');
  const [newVehFirstRegDate, setNewVehFirstRegDate] = useState<string>('');
  const [newVehItpBaseDate, setNewVehItpBaseDate] = useState<string>(
    formatTodayISO()
  );
  const [newVehItpYears, setNewVehItpYears] = useState<1 | 2 | 3>(2);

  // Google Workspace Auth State
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.lang) setLang(parsed.lang);
        if (parsed.themeId) setThemeId(parsed.themeId);
        if (Array.isArray(parsed.buildingItems) && parsed.buildingItems.length > 0) {
          setBuildingItems(parsed.buildingItems);
        }
        if (Array.isArray(parsed.vehicles) && parsed.vehicles.length > 0) {
          setVehicles(parsed.vehicles);
        }
        if (Array.isArray(parsed.providers) && parsed.providers.length > 0) {
          setProviders(parsed.providers);
        }
        if (parsed.notificationSettings) {
          setNotificationSettings({
            ...parsed.notificationSettings,
            autoDailyBackup: parsed.notificationSettings.autoDailyBackup ?? true,
            notificationTimeCET:
              parsed.notificationSettings.notificationTimeCET || '09:00',
            senderEmail: 'lucian.pop88@gmail.com',
            recipientEmail: 'Facilityandfleetmaintanance@gmail.com',
            backupDriveEmail: 'facilityandfleetmaintanance@gmail.com',
          });
        }
      }
    } catch (e) {
      console.error('Failed to load saved state:', e);
    }
  }, []);

  // Save state to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          lang,
          themeId,
          buildingItems,
          vehicles,
          providers,
          notificationSettings,
        })
      );
    } catch (e) {
      console.error('Failed to save state:', e);
    }
  }, [lang, themeId, buildingItems, vehicles, providers, notificationSettings]);

  // Initialize Firebase Google Auth listener & Auto-Connect Email Client + Background Service at App Startup
  useEffect(() => {
    const unsub = initAuth(
      (u) => setGoogleUser(u),
      () => setGoogleUser(null)
    );

    autoConnectEmailClientOnStartup({
      senderEmail: notificationSettings.senderEmail || 'lucian.pop88@gmail.com',
      recipientEmail:
        notificationSettings.recipientEmail ||
        'Facilityandfleetmaintanance@gmail.com',
      backupDriveEmail:
        notificationSettings.backupDriveEmail ||
        'facilityandfleetmaintanance@gmail.com',
    }).then((status) => {
      setNotificationSettings((prev) => ({
        ...prev,
        emailClientConnected: status.connected,
        emailClientConnectedAt: status.connectedAt,
        backgroundDaemonActive: status.backgroundDaemonActive,
      }));
    });

    if (
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'default'
    ) {
      Notification.requestPermission().catch(() => {});
    }

    return () => unsub();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const res = await googleSignIn(
        notificationSettings.senderEmail || 'lucian.pop88@gmail.com'
      );
      if (res) {
        setGoogleUser(res.user);
      }
    } catch (err) {
      console.error('Google Sign-In failed:', err);
    }
  };

  const handleGoogleLogout = async () => {
    await logout();
    setGoogleUser(null);
  };

  const currentTheme = useMemo(
    () => THEMES.find((th) => th.id === themeId) || THEMES[0],
    [themeId]
  );

  const t = TRANSLATIONS[lang];

  // Unified list of all inspections across Building Maintenance, Vehicle ITP/MOT, and Vehicle Vignettes
  const allInspections = useMemo<UnifiedInspectionEntry[]>(() => {
    const list: UnifiedInspectionEntry[] = [];

    // 1. Building Maintenance items (only include items that have an expiry date set)
    buildingItems.forEach((b) => {
      if (!b.expiryDate || !b.expiryDate.trim()) return;
      const daysRemaining = getDaysRemaining(b.expiryDate);
      const status = getInspectionStatus(b.expiryDate);
      list.push({
        id: `insp-bldg-${b.id}`,
        sourceType: 'building',
        targetId: b.id,
        title: b.name,
        subtitle: b.assignedProvider ? `${b.code} · Furnizor: ${b.assignedProvider}` : b.code,
        categoryLabel: t.navBuilding,
        expiryDate: b.expiryDate,
        daysRemaining,
        status,
        provider: b.assignedProvider || '',
      });
    });

    // 2. Vehicle ITP/MOT and Vignettes (only include items with an expiry date set and active vignettes)
    vehicles.forEach((v) => {
      if (v.itpExpiryDate && v.itpExpiryDate.trim()) {
        const itpDays = getDaysRemaining(v.itpExpiryDate);
        const itpStatus = getInspectionStatus(v.itpExpiryDate);
        list.push({
          id: `insp-itp-${v.id}`,
          sourceType: 'vehicle_itp',
          targetId: v.id,
          title: `${v.plateNumber} — ITP / MOT`,
          subtitle: `Utilizator: ${v.userName} · ${v.makeModel}`,
          categoryLabel: 'Autovehicule · ITP/MOT',
          expiryDate: v.itpExpiryDate,
          daysRemaining: itpDays,
          status: itpStatus,
          provider: v.userName,
        });
      }

      v.vignettes.forEach((vig) => {
        if (vig.active === false || !vig.expiryDate || !vig.expiryDate.trim())
          return;
        const vigDays = getDaysRemaining(vig.expiryDate);
        const vigStatus = getInspectionStatus(vig.expiryDate);
        list.push({
          id: `insp-vig-${v.id}-${vig.country}`,
          sourceType: 'vehicle_vignette',
          targetId: v.id,
          title: `${v.plateNumber} — Vinietă ${vig.country}`,
          subtitle: `Utilizator: ${v.userName} · Durată: ${vig.lastDurationCode}`,
          categoryLabel: `Vinietă ${vig.country}`,
          expiryDate: vig.expiryDate,
          daysRemaining: vigDays,
          status: vigStatus,
          country: vig.country,
          provider: v.userName,
        });
      });
    });

    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [buildingItems, vehicles, t.navBuilding]);

  const overdueInspections = useMemo(
    () => allInspections.filter((i) => i.status === 'overdue'),
    [allInspections]
  );
  const dueSoonInspections = useMemo(
    () => allInspections.filter((i) => i.status === 'due_soon'),
    [allInspections]
  );
  const okInspections = useMemo(
    () => allInspections.filter((i) => i.status === 'ok'),
    [allInspections]
  );

  // Automatic Daily Google Drive Backup & Automatic 09:00 CET Notification Scheduler (if Overdue or Due soon exist)
  useEffect(() => {
    const runDailySchedulers = async () => {
      const now = new Date();
      // Compute current date & time in CET (Europe/Berlin)
      const cetFormatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Berlin',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = cetFormatter.formatToParts(now);
      const getPart = (type: string) =>
        parts.find((p) => p.type === type)?.value || '00';
      const cetDateISO = `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
      const cetHour = parseInt(getPart('hour'), 10);

      // 1. Automatic 09:00 CET notifications if Overdue or Due soon exist
      const urgentItems = [...overdueInspections, ...dueSoonInspections];
      if (
        urgentItems.length > 0 &&
        cetHour >= 9 &&
        notificationSettings.lastAutoNotifyDateCET !== cetDateISO
      ) {
        // Trigger browser push notification if enabled
        if (
          notificationSettings.pushEnabled &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification(
            'Notificare Automată 09:00 CET — Facility and Fleet Maintenance',
            {
              body: `Atenție: ${overdueInspections.length} Overdue și ${dueSoonInspections.length} Due soon necesită reînnoire!`,
              icon: '/pwa-192x192.png',
            }
          );
        }

        // Trigger automatic email notification via auto-connected email client / Gmail
        if (notificationSettings.emailEnabled) {
          try {
            const htmlContent = renderEmailHtml({
              template: notificationSettings.customEmailTemplate,
              signature: notificationSettings.customEmailSignature,
              inspections: urgentItems,
              senderEmail: notificationSettings.senderEmail,
              recipientEmail: notificationSettings.recipientEmail,
              leadValue: notificationSettings.leadValue,
              leadUnit: notificationSettings.leadUnit,
              currentDate: cetDateISO,
            });
            const subject = renderEmailSubject(
              notificationSettings.customEmailSubject,
              urgentItems.length,
              cetDateISO
            );
            await sendGmailAlertEmail({
              senderEmail: notificationSettings.senderEmail,
              recipientEmail: notificationSettings.recipientEmail,
              subject,
              htmlContent,
            });
            setNotificationSettings((prev) => ({
              ...prev,
              lastAutoNotifyDateCET: cetDateISO,
              lastEmailSentAt: `${now.toLocaleString('ro-RO')} (Auto 09:00 CET)`,
            }));
          } catch (e) {
            console.warn('Auto 09:00 CET email dispatch warning:', e);
          }
        } else {
          setNotificationSettings((prev) => ({
            ...prev,
            lastAutoNotifyDateCET: cetDateISO,
          }));
        }
      }

      // 2. Sync state to 24/7 Background Daemon & Service Worker so notifications and daily backups run even if app is closed by user
      const fullBackupPayload = {
        appName: 'Facility and Fleet Maintenance',
        signature: 'Lucian Pop',
        exportedAt: new Date().toISOString(),
        lang,
        themeId,
        buildingItems,
        vehicles,
        providers,
        notificationSettings,
      };

      const daemonSyncResult = await syncStateToBackgroundDaemon({
        senderEmail: notificationSettings.senderEmail,
        recipientEmail: notificationSettings.recipientEmail,
        backupDriveEmail:
          notificationSettings.backupDriveEmail ||
          'facilityandfleetmaintanance@gmail.com',
        overdueCount: overdueInspections.length,
        dueSoonCount: dueSoonInspections.length,
        urgentItems: urgentItems.map((u) => ({
          title: u.title,
          categoryLabel: u.categoryLabel,
          expiryDate: u.expiryDate,
          daysRemaining: u.daysRemaining,
          status: u.status,
        })),
        fullBackupPayload,
      });

      if (daemonSyncResult) {
        setNotificationSettings((prev) => {
          const next = { ...prev };
          let updated = false;
          if (
            daemonSyncResult.lastDailyBackupDate &&
            daemonSyncResult.lastDailyBackupDate !== prev.lastDailyBackupDate
          ) {
            next.lastDailyBackupDate = daemonSyncResult.lastDailyBackupDate;
            next.lastBackupAt =
              daemonSyncResult.lastBackupAt || prev.lastBackupAt;
            updated = true;
          }
          if (
            daemonSyncResult.lastAutoNotifyDateCET &&
            daemonSyncResult.lastAutoNotifyDateCET !== prev.lastAutoNotifyDateCET
          ) {
            next.lastAutoNotifyDateCET = daemonSyncResult.lastAutoNotifyDateCET;
            next.lastEmailSentAt =
              daemonSyncResult.lastEmailSentAt || prev.lastEmailSentAt;
            updated = true;
          }
          return updated ? next : prev;
        });
      }

      // 3. Automatic Daily Backup to Google Drive when OAuth token is active
      const todayISO = formatTodayISO();
      if (
        googleUser &&
        notificationSettings.autoDailyBackup !== false &&
        notificationSettings.lastDailyBackupDate !== todayISO
      ) {
        try {
          await uploadBackupToGoogleDrive(
            fullBackupPayload,
            notificationSettings.backupDriveEmail ||
              'facilityandfleetmaintanance@gmail.com'
          );
          setNotificationSettings((prev) => ({
            ...prev,
            lastDailyBackupDate: todayISO,
            lastBackupAt: `${new Date().toLocaleString('ro-RO')} (Auto Zilnic)`,
          }));
        } catch (e) {
          console.warn('Daily auto-backup handled by background daemon:', e);
        }
      }
    };

    runDailySchedulers();
    const intervalId = window.setInterval(runDailySchedulers, 60000);

    // Sync state immediately before user closes tab/app or switches app to background
    const handleAppClosingOrBackgrounding = () => {
      if (document.visibilityState === 'hidden') {
        runDailySchedulers();
      }
    };
    document.addEventListener(
      'visibilitychange',
      handleAppClosingOrBackgrounding
    );
    window.addEventListener('pagehide', runDailySchedulers);
    window.addEventListener('beforeunload', runDailySchedulers);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener(
        'visibilitychange',
        handleAppClosingOrBackgrounding
      );
      window.removeEventListener('pagehide', runDailySchedulers);
      window.removeEventListener('beforeunload', runDailySchedulers);
    };
  }, [
    overdueInspections,
    dueSoonInspections,
    googleUser,
    notificationSettings,
    lang,
    themeId,
    buildingItems,
    vehicles,
    providers,
  ]);

  // Handlers for Building Maintenance Renewal & Creation
  const handleRenewBuildingItem = (
    id: string,
    baseDate: string,
    newExpiryDate: string,
    periodLabel: string,
    assignedProvider?: string,
    notes?: string
  ) => {
    const today = formatTodayISO();
    setBuildingItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          expiryDate: newExpiryDate,
          lastRenewedDate: today,
          lastPeriodLabel: periodLabel,
          assignedProvider: assignedProvider ?? item.assignedProvider,
          notes: notes ?? item.notes,
          history: [
            {
              id: `hist-${Date.now()}`,
              renewedAt: today,
              baseDate,
              periodLabel,
              newExpiryDate,
              previousExpiryDate: item.expiryDate || undefined,
              assignedProvider: assignedProvider ?? item.assignedProvider,
              notes: notes ?? item.notes,
            },
            ...(item.history || []),
          ],
        };
      })
    );
    if (activeDashboardRubric) {
      setSelectedBuildingId(null);
      setActiveDashboardRubric(null);
      setActivePage('dashboard');
    }
  };

  const handleAddBuildingElement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBldgName.trim()) return;
    const newExpiry = calculateCombinedExpiryDate(
      newBldgBaseDate,
      newBldgYears,
      newBldgMonths,
      newBldgWeeks,
      newBldgDays
    );
    const parts: string[] = [];
    if (newBldgYears > 0) parts.push(`${newBldgYears} ani`);
    if (newBldgMonths > 0) parts.push(`${newBldgMonths} luni`);
    if (newBldgWeeks > 0) parts.push(`${newBldgWeeks} săpt.`);
    if (newBldgDays > 0) parts.push(`${newBldgDays} zile`);
    const periodLabel = parts.length > 0 ? parts.join(' + ') : '6 luni';

    const newItem: BuildingMaintenanceItem = {
      id: `bldg-custom-${Date.now()}`,
      code: `BM-${String(buildingItems.length + 1).padStart(2, '0')}`,
      name: newBldgName.trim(),
      expiryDate: newExpiry,
      lastRenewedDate: formatTodayISO(),
      lastPeriodLabel: periodLabel,
      assignedProvider: newBldgProvider.trim() || '',
      isCustom: true,
      history: [
        {
          id: `hist-${Date.now()}`,
          renewedAt: formatTodayISO(),
          baseDate: newBldgBaseDate,
          periodLabel,
          newExpiryDate: newExpiry,
        },
      ],
    };

    setBuildingItems((prev) => [newItem, ...prev]);
    setShowAddBuildingModal(false);
    setNewBldgName('');
    setNewBldgProvider('');
    setActivePage('building');
    setSelectedBuildingId(newItem.id);
  };

  // Handlers for Vehicle ITP & Vignettes & Creation
  const handleRenewVehicleItp = (
    vehicleId: string,
    _baseDate: string,
    periodYears: 1 | 2 | 3,
    newExpiryDate: string,
    updatedUserName?: string,
    updatedPlate?: string,
    updatedVin?: string,
    updatedFirstRegistrationDate?: string
  ) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== vehicleId) return v;
        return {
          ...v,
          plateNumber: updatedPlate?.trim() || v.plateNumber,
          vinNumber:
            updatedVin !== undefined
              ? updatedVin.trim().toUpperCase()
              : v.vinNumber,
          userName: updatedUserName?.trim() || v.userName,
          firstRegistrationDate:
            updatedFirstRegistrationDate !== undefined
              ? updatedFirstRegistrationDate.trim()
              : v.firstRegistrationDate,
          itpExpiryDate: newExpiryDate,
          itpLastRenewedDate: formatTodayISO(),
          itpPeriodYears: periodYears,
        };
      })
    );
    setSelectedVehicleId(null);
    setActiveDashboardRubric(null);
    setActivePage('dashboard');
  };

  const handleRenewVehicleVignette = (
    vehicleId: string,
    country: VignetteCountry,
    _baseDate: string,
    durationCode: VignetteDurationCode,
    newExpiryDate: string
  ) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== vehicleId) return v;
        return {
          ...v,
          vignettes: v.vignettes.map((vg) =>
            vg.country === country
              ? {
                  ...vg,
                  active: true,
                  expiryDate: newExpiryDate,
                  lastRenewedDate: formatTodayISO(),
                  lastDurationCode: durationCode,
                }
              : vg
          ),
        };
      })
    );
    setSelectedVehicleId(null);
    setActiveDashboardRubric(null);
    setActivePage('dashboard');
  };

  const handleToggleVehicleVignetteActive = (
    vehicleId: string,
    country: VignetteCountry,
    active: boolean
  ) => {
    setVehicles((prev) =>
      prev.map((v) => {
        if (v.id !== vehicleId) return v;
        return {
          ...v,
          vignettes: v.vignettes.map((vg) =>
            vg.country === country ? { ...vg, active } : vg
          ),
        };
      })
    );
  };

  // Reset all expiration dates across Building Maintenance, Vehicle ITP/MOT, and Vehicle Vignettes, and deactivate all vignettes
  const handleResetAllDates = () => {
    setBuildingItems((prev) =>
      prev.map((item) => ({
        ...item,
        expiryDate: '',
        lastRenewedDate: '',
        lastPeriodLabel: 'Nesetat',
        history: [],
      }))
    );
    setVehicles((prev) =>
      prev.map((veh) => ({
        ...veh,
        itpExpiryDate: '',
        itpLastRenewedDate: '',
        vignettes: veh.vignettes.map((vg) => ({
          ...vg,
          active: false,
          expiryDate: '',
          lastRenewedDate: '',
        })),
      }))
    );
  };

  const handleAddVehicle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVehPlate.trim() || !newVehUser.trim()) return;
    const today = formatTodayISO();
    const itpExpiry = calculateItpExpiryDate(newVehItpBaseDate, newVehItpYears);
    const defaultVigExpiry = calculateVignetteExpiryDate(today, '12m');

    const newVeh: VehicleItem = {
      id: `veh-${Date.now()}`,
      plateNumber: newVehPlate.trim().toUpperCase(),
      vinNumber: newVehVin.trim().toUpperCase(),
      userName: newVehUser.trim(),
      makeModel: newVehModel.trim() || 'Autoturism Flotă',
      firstRegistrationDate: newVehFirstRegDate.trim() || undefined,
      itpExpiryDate: itpExpiry,
      itpLastRenewedDate: today,
      itpPeriodYears: newVehItpYears,
      vignettes: VIGNETTE_COUNTRIES.map((country) => ({
        country,
        expiryDate: defaultVigExpiry,
        lastRenewedDate: today,
        lastDurationCode: '12m',
      })),
    };

    setVehicles((prev) => [newVeh, ...prev]);
    setShowAddVehicleModal(false);
    setNewVehPlate('');
    setNewVehVin('');
    setNewVehUser('');
    setNewVehModel('');
    setNewVehFirstRegDate('');
    setActivePage('vehicles');
    setSelectedVehicleId(newVeh.id);
  };

  const handleNavigateToInspection = (entry: UnifiedInspectionEntry) => {
    if (entry.sourceType === 'building') {
      setActivePage('building');
      setSelectedBuildingId(entry.targetId);
    } else {
      setActivePage('vehicles');
      setSelectedVehicleId(entry.targetId);
    }
  };

  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<
    'all' | 'overdue' | 'due_soon' | 'ok'
  >('all');

  const filteredDashboardInspections = useMemo(() => {
    const query = dashboardSearchQuery.trim().toLowerCase();
    return allInspections.filter((item) => {
      if (
        dashboardStatusFilter !== 'all' &&
        item.status !== dashboardStatusFilter
      ) {
        return false;
      }
      if (!query) return true;
      const matchName = item.title.toLowerCase().includes(query);
      const matchSubtitle = item.subtitle.toLowerCase().includes(query);
      const matchCategory = item.categoryLabel.toLowerCase().includes(query);
      const matchProvider = (item.provider || '').toLowerCase().includes(query);
      return matchName || matchSubtitle || matchCategory || matchProvider;
    });
  }, [allInspections, dashboardSearchQuery, dashboardStatusFilter]);

  const activeRubricList = useMemo(() => {
    const baseList =
      activeDashboardRubric === 'overdue'
        ? overdueInspections
        : activeDashboardRubric === 'due_soon'
        ? dueSoonInspections
        : activeDashboardRubric === 'ok'
        ? okInspections
        : [];
    if (!dashboardSearchQuery.trim()) return baseList;
    const query = dashboardSearchQuery.trim().toLowerCase();
    return baseList.filter((item) => {
      const matchName = item.title.toLowerCase().includes(query);
      const matchSubtitle = item.subtitle.toLowerCase().includes(query);
      const matchCategory = item.categoryLabel.toLowerCase().includes(query);
      const matchProvider = (item.provider || '').toLowerCase().includes(query);
      return matchName || matchSubtitle || matchCategory || matchProvider;
    });
  }, [
    activeDashboardRubric,
    overdueInspections,
    dueSoonInspections,
    okInspections,
    dashboardSearchQuery,
  ]);

  return (
    <div
      className={`min-h-screen flex flex-col ${currentTheme.bgCanvas} ${currentTheme.textPrimary} transition-colors duration-200`}
    >
      <OfflineIndicator />

      {/* Top Navigation Bar with 3 Horizontal Lines Menu Icon in Top-Left */}
      <header
        className={`sticky top-0 z-30 min-h-16 py-2 px-2.5 sm:px-4 lg:px-6 border-b ${currentTheme.borderSubtle} ${currentTheme.bgSurface} flex items-center justify-between gap-2 sm:gap-4`}
      >
        {/* Left Zone: 3 Horizontal Lines Menu Icon + Brand Emblem & Full Visible Title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setIsLeftDrawerOpen((prev) => !prev)}
            aria-label="Deschide meniul principal lateral stânga"
            className={`min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] p-2 sm:p-2.5 rounded-xl border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} hover:opacity-90 transition flex flex-col items-center justify-center gap-1.5 shrink-0`}
          >
            {/* Explicit 3 Horizontal Lines Menu Icon */}
            <span className="w-5 h-0.5 bg-current rounded-full block" />
            <span className="w-5 h-0.5 bg-current rounded-full block" />
            <span className="w-5 h-0.5 bg-current rounded-full block" />
          </button>

          <button
            type="button"
            onClick={() => {
              setActivePage('dashboard');
              setActiveDashboardRubric(null);
              setSelectedBuildingId(null);
              setSelectedVehicleId(null);
            }}
            className="flex items-center gap-2 sm:gap-3 text-left min-w-0 flex-1"
          >
            <AppEmblem size={34} className="w-8 h-8 sm:w-9 sm:h-9 shrink-0" />
            <span className="text-xs sm:text-base lg:text-lg font-bold tracking-tight leading-tight break-words">
              Facility and Fleet Maintenance
            </span>
          </button>
        </div>

        {/* Center Zone: Quick Desktop Navigation Links */}
        <nav className="hidden xl:flex items-center gap-5 text-xs font-semibold">
          {(
            [
              { id: 'dashboard', label: t.navDashboard },
              { id: 'building', label: t.navBuilding },
              { id: 'vehicles', label: t.navVehicles },
              { id: 'providers', label: t.navProviders },
              { id: 'reports', label: t.navReports },
              { id: 'settings', label: t.navSettings },
            ] as const
          ).map((navItem) => (
            <button
              key={navItem.id}
              type="button"
              onClick={() => {
                setActivePage(navItem.id);
                setActiveDashboardRubric(null);
                setSelectedBuildingId(null);
                setSelectedVehicleId(null);
              }}
              className={`py-1 transition-colors whitespace-nowrap ${
                activePage === navItem.id
                  ? 'text-sky-500 border-b-2 border-sky-500'
                  : `${currentTheme.textSecondary} hover:text-sky-500`
              }`}
            >
              {navItem.label}
            </button>
          ))}
        </nav>

        {/* Right Zone: Primary Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <PWAInstallButton />
          <button
            type="button"
            onClick={() => {
              setActivePage('settings');
              setActiveDashboardRubric(null);
              setSelectedBuildingId(null);
              setSelectedVehicleId(null);
            }}
            aria-label={t.navSettings}
            className={`px-3 py-1.5 rounded-lg border ${
              activePage === 'settings'
                ? `${currentTheme.accentBg} text-white border-transparent`
                : `${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} hover:border-sky-500/50`
            } text-xs font-semibold flex items-center gap-1.5 transition`}
          >
            <Settings className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{t.navSettings}</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Container with Left Sidebar Menu */}
      <div className="flex-1 flex relative">
        {/* Backdrop when Left Drawer is open on mobile/tablet or overlay */}
        {isLeftDrawerOpen && (
          <div
            onClick={() => setIsLeftDrawerOpen(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
          />
        )}

        {/* Left Sidebar Navigation Drawer */}
        <aside
          className={`${
            isLeftDrawerOpen
              ? 'translate-x-0 fixed inset-y-0 left-0 z-50 w-72 shadow-2xl'
              : '-translate-x-full fixed inset-y-0 left-0 z-50 w-72 lg:translate-x-0 lg:static lg:w-68'
          } ${currentTheme.sidebarBg} ${currentTheme.sidebarText} transition-transform duration-200 flex flex-col justify-between overflow-y-auto`}
        >
          <div className="p-4 space-y-5">
            {/* Drawer Header */}
            <div className="flex items-center justify-between gap-2 border-b pb-3 border-slate-300/30 dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <AppEmblem size={32} />
                <div className="min-w-0">
                  <div className="text-xs font-bold leading-tight break-words">
                    Facility and Fleet Maintenance
                  </div>
                  <div className={`text-[11px] ${currentTheme.textMuted}`}>
                    App by Lucian Pop
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLeftDrawerOpen(false)}
                className="lg:hidden p-1.5 rounded-lg hover:bg-slate-500/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Primary Navigation Pages */}
            <div className="space-y-1">
              {/* 0. Panou Primar */}
              <button
                type="button"
                onClick={() => {
                  setActivePage('dashboard');
                  setActiveDashboardRubric(null);
                  setSelectedBuildingId(null);
                  setSelectedVehicleId(null);
                  setIsLeftDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activePage === 'dashboard'
                    ? `${currentTheme.accentBg} text-white shadow-xs`
                    : 'hover:bg-slate-500/10'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <LayoutDashboard className="w-4 h-4" />
                  <span>{t.navDashboard}</span>
                </span>
                <span className="font-mono text-[11px] opacity-80">
                  {allInspections.length}
                </span>
              </button>

              {/* 1. Mentenanță Clădire + Expandable Subcategories */}
              <div className="space-y-1">
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage('building');
                      setSelectedBuildingId(null);
                      setExpandBuildingMenu((prev) => !prev);
                    }}
                    className={`flex-1 flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                      activePage === 'building'
                        ? `${currentTheme.accentBg} text-white shadow-xs`
                        : 'hover:bg-slate-500/10'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Building2 className="w-4 h-4" />
                      <span>{t.navBuilding}</span>
                    </span>
                    <span className="flex items-center gap-1 font-mono text-[11px]">
                      <span>{buildingItems.length}</span>
                      {expandBuildingMenu ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </span>
                  </button>
                </div>

                {expandBuildingMenu && (
                  <div className="pl-4 pr-1 py-1 space-y-0.5 max-h-60 overflow-y-auto border-l border-slate-400/20 ml-4">
                    {buildingItems.map((b) => {
                      const hasDate = Boolean(b.expiryDate && b.expiryDate.trim());
                      const st = hasDate ? getInspectionStatus(b.expiryDate) : null;
                      const dotColor = !hasDate
                        ? 'text-slate-400'
                        : st === 'overdue'
                        ? 'text-red-500'
                        : st === 'due_soon'
                        ? 'text-amber-500'
                        : 'text-emerald-500';
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setActivePage('building');
                            setSelectedBuildingId(b.id);
                            setIsLeftDrawerOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center justify-between gap-2 transition ${
                            selectedBuildingId === b.id &&
                            activePage === 'building'
                              ? 'bg-sky-500/20 font-bold text-sky-400'
                              : `${currentTheme.textSecondary} hover:bg-slate-500/10`
                          }`}
                        >
                          <span className="truncate">{b.name}</span>
                          <span className={`font-mono ${dotColor}`}>●</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Autovehicule + Expandable Vehicle Subcategories */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setActivePage('vehicles');
                    setSelectedVehicleId(null);
                    setExpandVehiclesMenu((prev) => !prev);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                    activePage === 'vehicles'
                      ? `${currentTheme.accentBg} text-white shadow-xs`
                      : 'hover:bg-slate-500/10'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Car className="w-4 h-4" />
                    <span>{t.navVehicles}</span>
                  </span>
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <span>{vehicles.length}</span>
                    {expandVehiclesMenu ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </span>
                </button>

                {expandVehiclesMenu && (
                  <div className="pl-4 pr-1 py-1 space-y-0.5 border-l border-slate-400/20 ml-4">
                    {vehicles.map((v) => {
                      const hasDate = Boolean(v.itpExpiryDate && v.itpExpiryDate.trim());
                      const st = hasDate ? getInspectionStatus(v.itpExpiryDate) : null;
                      const dotColor = !hasDate
                        ? 'text-slate-400'
                        : st === 'overdue'
                        ? 'text-red-500'
                        : st === 'due_soon'
                        ? 'text-amber-500'
                        : 'text-emerald-500';
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setActivePage('vehicles');
                            setSelectedVehicleId(v.id);
                            setIsLeftDrawerOpen(false);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] flex items-center justify-between gap-2 transition ${
                            selectedVehicleId === v.id &&
                            activePage === 'vehicles'
                              ? 'bg-sky-500/20 font-bold text-sky-400'
                              : `${currentTheme.textSecondary} hover:bg-slate-500/10`
                          }`}
                        >
                          <span className="font-mono font-semibold truncate">
                            {v.plateNumber} · {v.userName}
                          </span>
                          <span className={dotColor}>●</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Furnizori Servicii */}
              <button
                type="button"
                onClick={() => {
                  setActivePage('providers');
                  setIsLeftDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activePage === 'providers'
                    ? `${currentTheme.accentBg} text-white shadow-xs`
                    : 'hover:bg-slate-500/10'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Wrench className="w-4 h-4" />
                  <span>{t.navProviders}</span>
                </span>
                <span className="font-mono text-[11px] opacity-80">
                  {providers.length}
                </span>
              </button>

              {/* 4. Rapoarte / Distribuire */}
              <button
                type="button"
                onClick={() => {
                  setActivePage('reports');
                  setIsLeftDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activePage === 'reports'
                    ? `${currentTheme.accentBg} text-white shadow-xs`
                    : 'hover:bg-slate-500/10'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{t.navReports}</span>
                </span>
              </button>

              {/* 5. Setări */}
              <button
                type="button"
                onClick={() => {
                  setActivePage('settings');
                  setIsLeftDrawerOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  activePage === 'settings'
                    ? `${currentTheme.accentBg} text-white shadow-xs`
                    : 'hover:bg-slate-500/10'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Settings className="w-4 h-4" />
                  <span>{t.navSettings}</span>
                </span>
              </button>
            </div>
          </div>

          {/* Sidebar Footer with Official Author Signature: Lucian Pop */}
          <div className="p-4 border-t border-slate-300/30 dark:border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-500">
              <Award className="w-4 h-4 shrink-0" />
              <span>{t.signature}</span>
            </div>
            <div className={`text-[11px] ${currentTheme.textMuted} font-mono`}>
              Timișoara · RO / EN / NL / DE / FR
            </div>
          </div>
        </aside>

        {/* Main Viewport Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {/* PRIMARY DASHBOARD VIEW (PANOUL PRIMAR) */}
          {activePage === 'dashboard' && (
            <div className="space-y-6">
              {/* Top Welcome & Signature Banner */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                  <AppEmblem size={48} className="w-11 h-11 sm:w-12 sm:h-12 shrink-0" />
                  <div className="min-w-0">
                    <h1 className={`text-base sm:text-xl lg:text-2xl font-bold leading-snug break-words ${currentTheme.textPrimary}`}>
                      Facility and Fleet Maintenance
                    </h1>
                  </div>
                </div>

                <div className={`text-xs font-mono tabular-nums ${currentTheme.textMuted}`}>
                  Data curentă: <strong>{formatDateDisplay(formatTodayISO(), lang)}</strong>
                </div>
              </div>

              {/* SEPARATE CATEGORY INSPECTION LIST VIEW (Overdue / Due soon / OK) */}
              {activeDashboardRubric ? (
                <div className="space-y-5">
                  {/* Top Bar: Back to Main Dashboard without modifying expiration dates + Category Switcher */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveDashboardRubric(null)}
                      className={`inline-flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-xl border ${currentTheme.borderSubtle} ${currentTheme.bgSurface} ${currentTheme.textPrimary} text-xs sm:text-sm font-bold shadow-xs hover:opacity-90 transition`}
                    >
                      <ArrowLeft className="w-4 h-4 text-sky-500 shrink-0" />
                      <span>Înapoi la Panoul Principal (Fără modificări)</span>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {(
                        [
                          { id: 'overdue', label: `${t.overdue} (${overdueInspections.length})` },
                          { id: 'due_soon', label: `${t.dueSoon} (${dueSoonInspections.length})` },
                          { id: 'ok', label: `${t.ok} (${okInspections.length})` },
                        ] as const
                      ).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setActiveDashboardRubric(r.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            activeDashboardRubric === r.id
                              ? r.id === 'overdue'
                                ? 'bg-red-600 text-white shadow-xs'
                                : r.id === 'due_soon'
                                ? 'bg-amber-500 text-slate-950 shadow-xs'
                                : 'bg-emerald-600 text-white shadow-xs'
                              : `border ${currentTheme.borderSubtle} ${currentTheme.bgSurface} ${currentTheme.textSecondary}`
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Separate Category List Container */}
                  <div
                    className={`p-5 rounded-2xl border ${currentTheme.borderSubtle} ${currentTheme.bgSurface} space-y-4`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 border-slate-200/60 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`w-3.5 h-3.5 rounded-full shrink-0 ${
                            activeDashboardRubric === 'overdue'
                              ? 'bg-red-600 animate-pulse'
                              : activeDashboardRubric === 'due_soon'
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                          }`}
                        />
                        <div>
                          <h2 className={`text-base sm:text-lg font-bold ${currentTheme.textPrimary}`}>
                            {activeDashboardRubric === 'overdue'
                              ? `Listă Inspecții ${t.overdue}`
                              : activeDashboardRubric === 'due_soon'
                              ? `Listă Inspecții ${t.dueSoon}`
                              : `Listă Inspecții ${t.ok}`}{' '}
                            ({activeRubricList.length})
                          </h2>
                        </div>
                      </div>
                    </div>

                    {/* Search Bar inside Rubric View */}
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={dashboardSearchQuery}
                        onChange={(e) => setDashboardSearchQuery(e.target.value)}
                        placeholder="Filtrează în această categorie după denumire sau furnizor (ex: AC, Lift, PSI, TM 22 XYZ)..."
                        className={`w-full pl-10 pr-9 py-2.5 rounded-xl border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500`}
                      />
                      {dashboardSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setDashboardSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {activeRubricList.length === 0 ? (
                      <div className={`py-10 text-center text-sm ${currentTheme.textMuted}`}>
                        {dashboardSearchQuery
                          ? `Nicio inspecție nu corespunde căutării "${dashboardSearchQuery}" în această categorie.`
                          : 'Nu există inspecții în această categorie în acest moment.'}
                        {dashboardSearchQuery && (
                          <div className="mt-3">
                            <button
                              type="button"
                              onClick={() => setDashboardSearchQuery('')}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600 transition"
                            >
                              Resetează căutarea
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200/50 dark:divide-slate-800">
                        {activeRubricList.map((entry) => {
                          const statusColor =
                            entry.status === 'overdue'
                              ? 'text-red-500'
                              : entry.status === 'due_soon'
                              ? 'text-amber-500'
                              : 'text-emerald-500';

                          return (
                            <div
                              key={entry.id}
                              className="py-3.5 px-2 hover:bg-slate-500/5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  {entry.sourceType === 'building' ? (
                                    <Building2 className="w-4 h-4 text-sky-500 shrink-0" />
                                  ) : (
                                    <Car className="w-4 h-4 text-emerald-500 shrink-0" />
                                  )}
                                  <span className={`text-sm font-bold ${currentTheme.textPrimary}`}>
                                    {entry.title}
                                  </span>
                                  <span className={`text-xs ${currentTheme.textMuted}`}>
                                    · {entry.categoryLabel}
                                  </span>
                                </div>
                                <div className={`text-xs ${currentTheme.textSecondary} flex flex-wrap items-center gap-x-3 gap-y-1`}>
                                  <span>{entry.subtitle}</span>
                                  <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                                    <Wrench className="w-3 h-3" />
                                    <span>Furnizor: {entry.provider || 'Standard'}</span>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4 font-mono tabular-nums">
                                <div className="text-left sm:text-right">
                                  <div className={`text-xs font-bold ${currentTheme.textPrimary}`}>
                                    Expiră: {entry.expiryDate}
                                  </div>
                                  <div className={`text-xs font-semibold ${statusColor}`}>
                                    {entry.daysRemaining < 0
                                      ? `${Math.abs(entry.daysRemaining)} ${t.daysOverdue}`
                                      : entry.daysRemaining === 0
                                      ? t.expiresToday
                                      : `${entry.daysRemaining} ${t.daysRemaining}`}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleNavigateToInspection(entry)}
                                  className={`px-3 py-1.5 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} hover:border-sky-500/60 inline-flex items-center gap-1 text-xs font-sans font-semibold text-sky-500 transition`}
                                >
                                  <span>Deschide / Reînnoiește</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="pt-4 border-t border-slate-200/60 dark:border-slate-800 flex justify-between items-center">
                      <button
                        type="button"
                        onClick={() => setActiveDashboardRubric(null)}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} text-xs sm:text-sm font-bold hover:opacity-90 transition`}
                      >
                        <ArrowLeft className="w-4 h-4 text-sky-500" />
                        <span>Înapoi la Panoul Principal (Fără modificări ale datelor de expirare)</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* 3 PRIMARY STATUS RUBRICS: OVERDUE (Red), DUE SOON (Yellow), OK (Green) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 1. OVERDUE (Red - <= 3 days until due date) */}
                    <button
                      type="button"
                      onClick={() => setActiveDashboardRubric('overdue')}
                      className={`p-5 rounded-2xl border border-red-500/40 ${currentTheme.bgSurface} hover:bg-red-500/10 text-left transition flex flex-col justify-between gap-4`}
                    >
                      <div className="flex items-start justify-between gap-3 w-full">
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-2 text-red-500 font-bold text-sm uppercase tracking-wider">
                            <span className="w-3 h-3 rounded-full bg-red-600 animate-pulse" />
                            <span>{t.overdue}</span>
                          </div>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
                      </div>

                      <div className="flex items-baseline justify-between w-full pt-2 border-t border-red-500/20">
                        <span className="text-3xl font-extrabold font-mono tabular-nums text-red-500">
                          {overdueInspections.length}
                        </span>
                        <span className="text-xs font-semibold text-red-500 flex items-center gap-1">
                          <span>Deschide lista Overdue</span>
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </button>

                    {/* 2. DUE SOON (Yellow - next 4 to 15 days) */}
                    <button
                      type="button"
                      onClick={() => setActiveDashboardRubric('due_soon')}
                      className={`p-5 rounded-2xl border border-amber-500/40 ${currentTheme.bgSurface} hover:bg-amber-500/10 text-left transition flex flex-col justify-between gap-4`}
                    >
                      <div className="flex items-start justify-between gap-3 w-full">
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-2 text-amber-500 font-bold text-sm uppercase tracking-wider">
                            <span className="w-3 h-3 rounded-full bg-amber-400" />
                            <span>{t.dueSoon}</span>
                          </div>
                        </div>
                        <Clock className="w-8 h-8 text-amber-500 shrink-0" />
                      </div>

                      <div className="flex items-baseline justify-between w-full pt-2 border-t border-amber-500/20">
                        <span className="text-3xl font-extrabold font-mono tabular-nums text-amber-500">
                          {dueSoonInspections.length}
                        </span>
                        <span className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                          <span>Deschide lista Due soon</span>
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </button>

                    {/* 3. OK (Green - > 15 days valid term) */}
                    <button
                      type="button"
                      onClick={() => setActiveDashboardRubric('ok')}
                      className={`p-5 rounded-2xl border border-emerald-500/40 ${currentTheme.bgSurface} hover:bg-emerald-500/10 text-left transition flex flex-col justify-between gap-4`}
                    >
                      <div className="flex items-start justify-between gap-3 w-full">
                        <div className="space-y-1">
                          <div className="inline-flex items-center gap-2 text-emerald-500 font-bold text-sm uppercase tracking-wider">
                            <span className="w-3 h-3 rounded-full bg-emerald-500" />
                            <span>{t.ok}</span>
                          </div>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                      </div>

                      <div className="flex items-baseline justify-between w-full pt-2 border-t border-emerald-500/20">
                        <span className="text-3xl font-extrabold font-mono tabular-nums text-emerald-500">
                          {okInspections.length}
                        </span>
                        <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                          <span>Deschide lista OK</span>
                          <ArrowRight className="w-4 h-4" />
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* 2 ACTION BUTTONS DIRECTLY BELOW THE DISPLAY: Add Maintenance Element & Add Vehicle */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setShowAddBuildingModal(true)}
                      className={`py-4 px-6 rounded-2xl ${currentTheme.accentBg} text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-3`}
                    >
                      <Plus className="w-5 h-5" />
                      <Building2 className="w-5 h-5" />
                      <span>{t.addBuildingItem}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAddVehicleModal(true)}
                      className="py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-3"
                    >
                      <Plus className="w-5 h-5" />
                      <Car className="w-5 h-5" />
                      <span>{t.addVehicle}</span>
                    </button>
                  </div>

                  {/* MAIN DASHBOARD SEARCH BAR & UNIFIED INSPECTIONS LIST */}
                  <div
                    className={`p-5 rounded-2xl border ${currentTheme.borderSubtle} ${currentTheme.bgSurface} space-y-4`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3 border-slate-200/60 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <Search className="w-5 h-5 text-sky-500 shrink-0" />
                          <h2 className={`text-base sm:text-lg font-bold ${currentTheme.textPrimary}`}>
                            Căutare & Filtrare Inspecții
                          </h2>
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-500">
                            {filteredDashboardInspections.length} din {allInspections.length}
                          </span>
                        </div>
                      </div>

                      {/* Status Filter Buttons */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setDashboardStatusFilter('all')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            dashboardStatusFilter === 'all'
                              ? `${currentTheme.accentBg} text-white shadow-xs`
                              : `border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textSecondary}`
                          }`}
                        >
                          Toate ({allInspections.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDashboardStatusFilter('overdue')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            dashboardStatusFilter === 'overdue'
                              ? 'bg-red-600 text-white shadow-xs'
                              : `border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} text-red-500`
                          }`}
                        >
                          Overdue ({overdueInspections.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDashboardStatusFilter('due_soon')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            dashboardStatusFilter === 'due_soon'
                              ? 'bg-amber-500 text-slate-950 shadow-xs'
                              : `border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} text-amber-500`
                          }`}
                        >
                          Due soon ({dueSoonInspections.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setDashboardStatusFilter('ok')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            dashboardStatusFilter === 'ok'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : `border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} text-emerald-500`
                          }`}
                        >
                          OK ({okInspections.length})
                        </button>
                      </div>
                    </div>

                    {/* Search Bar Input */}
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={dashboardSearchQuery}
                        onChange={(e) => setDashboardSearchQuery(e.target.value)}
                        placeholder="Căutare după nume inspecție, vehicul (ex: AC, Lift, PSI, TM 22 XYZ) sau furnizor (ex: Facility Tech, Timișoara)..."
                        className={`w-full pl-10 pr-9 py-2.5 rounded-xl border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500`}
                      />
                      {dashboardSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setDashboardSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Inspection List Items */}
                    {filteredDashboardInspections.length === 0 ? (
                      <div className="py-10 text-center space-y-3">
                        <div className={`text-sm ${currentTheme.textMuted}`}>
                          Nicio inspecție nu corespunde criteriilor de căutare
                          {dashboardSearchQuery ? ` "${dashboardSearchQuery}"` : ''}.
                        </div>
                        {(dashboardSearchQuery || dashboardStatusFilter !== 'all') && (
                          <button
                            type="button"
                            onClick={() => {
                              setDashboardSearchQuery('');
                              setDashboardStatusFilter('all');
                            }}
                            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 text-white hover:bg-sky-600 transition"
                          >
                            Resetează filtrele de căutare
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200/50 dark:divide-slate-800 max-h-[500px] overflow-y-auto pr-1">
                        {filteredDashboardInspections.map((entry) => {
                          const statusColor =
                            entry.status === 'overdue'
                              ? 'text-red-500'
                              : entry.status === 'due_soon'
                              ? 'text-amber-500'
                              : 'text-emerald-500';
                          const statusBadgeBg =
                            entry.status === 'overdue'
                              ? 'bg-red-500/10 text-red-500 border-red-500/30'
                              : entry.status === 'due_soon'
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';

                          return (
                            <div
                              key={entry.id}
                              className="py-3 px-2 hover:bg-slate-500/5 transition rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  {entry.sourceType === 'building' ? (
                                    <Building2 className="w-4 h-4 text-sky-500 shrink-0" />
                                  ) : (
                                    <Car className="w-4 h-4 text-emerald-500 shrink-0" />
                                  )}
                                  <span className={`text-sm font-bold truncate ${currentTheme.textPrimary}`}>
                                    {entry.title}
                                  </span>
                                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-400">
                                    {entry.categoryLabel}
                                  </span>
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusBadgeBg}`}>
                                    {entry.status === 'overdue' ? 'Overdue' : entry.status === 'due_soon' ? 'Due soon' : 'OK'}
                                  </span>
                                </div>
                                <div className={`text-xs ${currentTheme.textSecondary} flex flex-wrap items-center gap-x-3 gap-y-1`}>
                                  <span>{entry.subtitle}</span>
                                  <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                                    <Wrench className="w-3 h-3" />
                                    <span>Furnizor: {entry.provider || 'Standard'}</span>
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-3 font-mono tabular-nums shrink-0">
                                <div className="text-left sm:text-right">
                                  <div className={`text-xs font-bold ${currentTheme.textPrimary}`}>
                                    Expiră: {entry.expiryDate}
                                  </div>
                                  <div className={`text-xs font-semibold ${statusColor}`}>
                                    {entry.daysRemaining < 0
                                      ? `${Math.abs(entry.daysRemaining)} ${t.daysOverdue}`
                                      : entry.daysRemaining === 0
                                      ? t.expiresToday
                                      : `${entry.daysRemaining} ${t.daysRemaining}`}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleNavigateToInspection(entry)}
                                  className={`px-3 py-1.5 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} hover:border-sky-500/60 inline-flex items-center gap-1.5 text-xs font-sans font-semibold text-sky-500 transition`}
                                >
                                  <span>Deschide / Reînnoiește</span>
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Quick Navigation Cards to Main Sections */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                    <div
                      onClick={() => {
                        setActivePage('building');
                        setSelectedBuildingId(null);
                      }}
                      className={`cursor-pointer p-4 rounded-xl border ${currentTheme.borderSubtle} ${currentTheme.bgSurface} hover:border-sky-500/50 transition space-y-1.5`}
                    >
                      <div className="flex items-center justify-between text-sky-500">
                        <Building2 className="w-5 h-5" />
                        <span className="font-mono text-xs font-bold">
                          {buildingItems.length} subcategorii
                        </span>
                      </div>
                      <div className={`text-sm font-bold ${currentTheme.textPrimary}`}>
                        {t.navBuilding}
                      </div>
                    </div>

                    <div
                      onClick={() => {
                        setActivePage('vehicles');
                        setSelectedVehicleId(null);
                      }}
                      className={`cursor-pointer p-4 rounded-xl border ${currentTheme.borderSubtle} ${currentTheme.bgSurface} hover:border-sky-500/50 transition space-y-1.5`}
                    >
                      <div className="flex items-center justify-between text-emerald-500">
                        <Car className="w-5 h-5" />
                        <span className="font-mono text-xs font-bold">
                          {vehicles.length} vehicule
                        </span>
                      </div>
                      <div className={`text-sm font-bold ${currentTheme.textPrimary}`}>
                        {t.navVehicles}
                      </div>
                    </div>

                    <div
                      onClick={() => setActivePage('providers')}
                      className={`cursor-pointer p-4 rounded-xl border ${currentTheme.borderSubtle} ${currentTheme.bgSurface} hover:border-sky-500/50 transition space-y-1.5`}
                    >
                      <div className="flex items-center justify-between text-amber-500">
                        <Wrench className="w-5 h-5" />
                        <span className="font-mono text-xs font-bold">
                          {providers.length} parteneri
                        </span>
                      </div>
                      <div className={`text-sm font-bold ${currentTheme.textPrimary}`}>
                        {t.navProviders}
                      </div>
                    </div>

                    <div
                      onClick={() => setActivePage('reports')}
                      className={`cursor-pointer p-4 rounded-xl border ${currentTheme.borderSubtle} ${currentTheme.bgSurface} hover:border-sky-500/50 transition space-y-1.5`}
                    >
                      <div className="flex items-center justify-between text-purple-400">
                        <FileSpreadsheet className="w-5 h-5" />
                        <span className="font-mono text-xs font-bold">
                          Excel & PDF
                        </span>
                      </div>
                      <div className={`text-sm font-bold ${currentTheme.textPrimary}`}>
                        {t.navReports}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* BUILDING MAINTENANCE PAGE */}
          {activePage === 'building' && (
            <BuildingMaintenanceView
              items={buildingItems}
              selectedItemId={selectedBuildingId}
              onSelectItem={setSelectedBuildingId}
              onBackToDashboard={() => {
                setSelectedBuildingId(null);
                setActiveDashboardRubric(null);
                setActivePage('dashboard');
              }}
              onRenewItem={handleRenewBuildingItem}
              onOpenAddModal={() => setShowAddBuildingModal(true)}
              lang={lang}
              theme={currentTheme}
            />
          )}

          {/* FLEET VEHICLES PAGE */}
          {activePage === 'vehicles' && (
            <VehiclesView
              vehicles={vehicles}
              selectedVehicleId={selectedVehicleId}
              onSelectVehicle={setSelectedVehicleId}
              onBackToDashboard={() => {
                setSelectedVehicleId(null);
                setActiveDashboardRubric(null);
                setActivePage('dashboard');
              }}
              onRenewItp={handleRenewVehicleItp}
              onRenewVignette={handleRenewVehicleVignette}
              onToggleVignetteActive={handleToggleVehicleVignetteActive}
              onDeleteVehicle={(id) =>
                setVehicles((prev) => prev.filter((v) => v.id !== id))
              }
              onOpenAddVehicleModal={() => setShowAddVehicleModal(true)}
              lang={lang}
              theme={currentTheme}
            />
          )}

          {/* SERVICE PROVIDERS PAGE (100KM TIMISOARA) */}
          {activePage === 'providers' && (
            <ProvidersView
              providers={providers}
              onAddProvider={(newProv) =>
                setProviders((prev) => [newProv, ...prev])
              }
              onUpdateProvider={(updatedProv) =>
                setProviders((prev) =>
                  prev.map((p) => (p.id === updatedProv.id ? updatedProv : p))
                )
              }
              lang={lang}
              theme={currentTheme}
            />
          )}

          {/* REPORTS & SHARE PAGE */}
          {activePage === 'reports' && (
            <ReportsView
              buildingItems={buildingItems}
              vehicles={vehicles}
              providers={providers}
              allInspections={allInspections}
              lang={lang}
              theme={currentTheme}
              googleUser={googleUser}
              onGoogleLogin={handleGoogleLogin}
            />
          )}

          {/* SETTINGS PAGE */}
          {activePage === 'settings' && (
            <SettingsView
              lang={lang}
              onChangeLang={setLang}
              themeId={themeId}
              onChangeTheme={setThemeId}
              theme={currentTheme}
              notificationSettings={notificationSettings}
              onUpdateNotifications={setNotificationSettings}
              googleUser={googleUser}
              onGoogleLogin={handleGoogleLogin}
              onGoogleLogout={handleGoogleLogout}
              allInspections={allInspections}
              fullBackupData={{
                appName: 'Facility and Fleet Maintenance',
                signature: 'App by Lucian Pop',
                exportedAt: new Date().toISOString(),
                lang,
                themeId,
                buildingItems,
                vehicles,
                providers,
                notificationSettings,
              }}
              onRestoreBackupData={(data) => {
                if (data?.buildingItems) setBuildingItems(data.buildingItems);
                if (data?.vehicles) setVehicles(data.vehicles);
                if (data?.providers) setProviders(data.providers);
                if (data?.notificationSettings)
                  setNotificationSettings(data.notificationSettings);
                if (data?.lang) setLang(data.lang);
                if (data?.themeId) setThemeId(data.themeId);
              }}
              onResetAllDates={handleResetAllDates}
            />
          )}
        </main>
      </div>

      {/* Footer with Official Signature */}
      <footer
        className={`py-4 px-6 border-t ${currentTheme.borderSubtle} ${currentTheme.bgSurface} text-xs ${currentTheme.textMuted} flex flex-col sm:flex-row items-center justify-between gap-2`}
      >
        <div>
          <strong>Facility and Fleet Maintenance</strong> · Monitorizare Clădiri, Flotă Auto, Viniete & Furnizori Timișoara
        </div>
        <div className="font-semibold text-sky-500">{t.signature}</div>
      </footer>

      {/* Modal 1: Add Building Maintenance Element */}
      {showAddBuildingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border ${currentTheme.borderSubtle} ${currentTheme.bgSurface} p-6 shadow-2xl space-y-4`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200/60 dark:border-slate-800">
              <h3 className={`text-base font-bold ${currentTheme.textPrimary}`}>
                {t.addBuildingItem}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddBuildingModal(false)}
                className="p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddBuildingElement} className="space-y-4">
              <div>
                <label className={`block text-xs font-semibold ${currentTheme.textSecondary} mb-1`}>
                  Denumire Element / Subcategorie Mentenanță *
                </label>
                <input
                  type="text"
                  required
                  value={newBldgName}
                  onChange={(e) => setNewBldgName(e.target.value)}
                  placeholder="Ex: Generator Electric Backup / Ascensor"
                  className={`w-full px-3.5 py-2 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} text-sm`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium ${currentTheme.textSecondary} mb-1`}>
                    Dată Calendar Start
                  </label>
                  <input
                    type="date"
                    value={newBldgBaseDate}
                    onChange={(e) => setNewBldgBaseDate(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} font-mono text-xs`}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={`text-xs font-medium ${currentTheme.textSecondary}`}>
                      Prestator / Furnizor Asociat
                    </label>
                    {newBldgProvider && (
                      <button
                        type="button"
                        onClick={() => setNewBldgProvider('')}
                        className="text-[10px] text-red-500 hover:underline cursor-pointer"
                        title="Lasă complet gol"
                      >
                        Lasă gol
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <select
                      value={
                        providers.some((p) => p.name === newBldgProvider)
                          ? newBldgProvider
                          : newBldgProvider.trim() === ''
                          ? ''
                          : '__manual__'
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val !== '__manual__') {
                          setNewBldgProvider(val);
                        }
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} text-xs cursor-pointer`}
                    >
                      <option value="">— Fără prestator (Rubrică lăsată goală) —</option>
                      {providers.length > 0 && (
                        <optgroup label="Selectează din lista furnizorilor:">
                          {providers.map((p) => (
                            <option key={p.id} value={p.name}>
                              {p.name} ({p.category})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {newBldgProvider && !providers.some((p) => p.name === newBldgProvider) && (
                        <option value="__manual__">Manual: {newBldgProvider}</option>
                      )}
                    </select>
                    <input
                      type="text"
                      value={newBldgProvider}
                      onChange={(e) => setNewBldgProvider(e.target.value)}
                      placeholder="Sau introduceți manual (opțional)..."
                      className={`w-full px-2.5 py-1.5 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} text-xs`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${currentTheme.textSecondary} mb-1.5`}>
                  Perioadă Valabilitate (Combinabilă Ani + Luni + Săptămâni + Zile):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <span className={`block text-[10px] ${currentTheme.textMuted}`}>{t.years}</span>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={newBldgYears}
                      onChange={(e) => setNewBldgYears(Number(e.target.value))}
                      className={`w-full px-2 py-1.5 rounded border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} font-mono text-xs font-bold`}
                    />
                  </div>
                  <div>
                    <span className={`block text-[10px] ${currentTheme.textMuted}`}>{t.months}</span>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={newBldgMonths}
                      onChange={(e) => setNewBldgMonths(Number(e.target.value))}
                      className={`w-full px-2 py-1.5 rounded border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} font-mono text-xs font-bold`}
                    />
                  </div>
                  <div>
                    <span className={`block text-[10px] ${currentTheme.textMuted}`}>{t.weeks}</span>
                    <input
                      type="number"
                      min={0}
                      max={52}
                      value={newBldgWeeks}
                      onChange={(e) => setNewBldgWeeks(Number(e.target.value))}
                      className={`w-full px-2 py-1.5 rounded border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} font-mono text-xs font-bold`}
                    />
                  </div>
                  <div>
                    <span className={`block text-[10px] ${currentTheme.textMuted}`}>{t.days}</span>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={newBldgDays}
                      onChange={(e) => setNewBldgDays(Number(e.target.value))}
                      className={`w-full px-2 py-1.5 rounded border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} font-mono text-xs font-bold`}
                    />
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between text-xs">
                <span>Data Expirării Calculată Automat:</span>
                <strong className="font-mono text-sm text-sky-500">
                  {calculateCombinedExpiryDate(
                    newBldgBaseDate,
                    newBldgYears,
                    newBldgMonths,
                    newBldgWeeks,
                    newBldgDays
                  )}
                </strong>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBuildingModal(false)}
                  className={`px-4 py-2 rounded-lg border ${currentTheme.borderSubtle} text-xs font-semibold`}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 rounded-lg text-white text-xs font-semibold ${currentTheme.accentBg}`}
                >
                  Salvează Element
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Fleet Vehicle */}
      {showAddVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div
            className={`w-full max-w-lg rounded-2xl border ${currentTheme.borderSubtle} ${currentTheme.bgSurface} p-6 shadow-2xl space-y-4`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200/60 dark:border-slate-800">
              <h3 className={`text-base font-bold ${currentTheme.textPrimary}`}>
                {t.addVehicle}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddVehicleModal(false)}
                className="p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-3">
                  <div>
                    <label className={`block text-xs font-semibold ${currentTheme.textSecondary} mb-1`}>
                      {t.plateNumber} *
                    </label>
                    <input
                      type="text"
                      required
                      value={newVehPlate}
                      onChange={(e) => setNewVehPlate(e.target.value.toUpperCase())}
                      placeholder="Ex: TM 10 FFM"
                      className={`w-full px-3.5 py-2 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} font-mono text-sm font-bold`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-semibold ${currentTheme.textSecondary} mb-1`}>
                      {t.vinNumber}
                    </label>
                    <input
                      type="text"
                      value={newVehVin}
                      onChange={(e) => setNewVehVin(e.target.value.toUpperCase())}
                      placeholder="Ex: W1N1671191A482910"
                      maxLength={17}
                      className={`w-full px-3.5 py-2 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} font-mono text-sm uppercase tracking-wider`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-semibold ${currentTheme.textSecondary} mb-1`}>
                    {t.vehicleUser} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newVehUser}
                    onChange={(e) => setNewVehUser(e.target.value)}
                    placeholder="Ex: Lucian Pop"
                    className={`w-full px-3.5 py-2 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} text-sm`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-medium ${currentTheme.textSecondary} mb-1`}>
                    {t.vehicleModel}
                  </label>
                  <input
                    type="text"
                    value={newVehModel}
                    onChange={(e) => setNewVehModel(e.target.value)}
                    placeholder="Ex: Hyundai Tucson Hybrid"
                    className={`w-full px-3.5 py-2 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} text-sm`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-semibold ${currentTheme.textSecondary} mb-1 flex items-center gap-1.5`}>
                    <Calendar className="w-3.5 h-3.5 text-sky-500" />
                    <span>{t.firstRegistrationDate || 'Data primei înmatriculări'}</span>
                  </label>
                  <input
                    type="date"
                    value={newVehFirstRegDate}
                    onChange={(e) => setNewVehFirstRegDate(e.target.value)}
                    className={`w-full px-3.5 py-2 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} font-mono text-xs`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${currentTheme.textSecondary} mb-1`}>
                  Dată Calendar ITP / MOT
                </label>
                <input
                  type="date"
                  value={newVehItpBaseDate}
                  onChange={(e) => setNewVehItpBaseDate(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-lg border ${currentTheme.borderSubtle} ${currentTheme.bgElevated} ${currentTheme.textPrimary} font-mono text-xs`}
                />
              </div>

              <div>
                <label className={`block text-xs font-medium ${currentTheme.textSecondary} mb-1.5`}>
                  Perioadă ITP / MOT:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { y: 1, label: t.year1 },
                      { y: 2, label: t.year2 },
                      { y: 3, label: t.year3NewCar },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.y}
                      type="button"
                      onClick={() => setNewVehItpYears(o.y)}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold border transition ${
                        newVehItpYears === o.y
                          ? `${currentTheme.accentBg} text-white border-transparent`
                          : `${currentTheme.borderSubtle} ${currentTheme.bgElevated}`
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs">
                <span>Expirare ITP / MOT Calculată Automat:</span>
                <strong className="font-mono text-sm text-emerald-500">
                  {calculateItpExpiryDate(newVehItpBaseDate, newVehItpYears)}
                </strong>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className={`px-4 py-2 rounded-lg border ${currentTheme.borderSubtle} text-xs font-semibold`}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                >
                  Salvează Autovehicul
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
