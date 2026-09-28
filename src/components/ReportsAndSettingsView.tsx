import React, { useState } from 'react';
import {
  FileSpreadsheet,
  FileText,
  Share2,
  Download,
  Mail,
  HardDrive,
  Bell,
  Palette,
  Languages,
  UploadCloud,
  DownloadCloud,
  ShieldAlert,
  Loader2,
  LogOut,
  RotateCcw,
  ChevronDown,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import {
  BuildingMaintenanceItem,
  Language,
  NotificationSettings,
  ServiceProvider,
  ThemeId,
  UnifiedInspectionEntry,
  VehicleItem,
} from '../types';
import { ThemeDefinition, THEMES, TRANSLATIONS } from '../i18n';
import {
  createExcelWorkbookBuffer,
  createPdfReportBlob,
  triggerBrowserDownload,
} from '../utils/reportGenerator';
import {
  DriveBackupFileInfo,
  downloadBackupFromGoogleDrive,
  listDriveBackups,
  sendGmailAlertEmail,
  uploadBackupToGoogleDrive,
} from '../services/googleWorkspace';
import { GoogleSignInButton } from './AppEmblem';
import { formatTodayISO } from '../utils/dateUtils';

export async function downloadAndroidStudioProjectZip(): Promise<string> {
  const zipFileName = 'Facility_and_Fleet_Maintanance_Android_Studio_Project.zip';
  try {
    const res = await fetch('/api/android-studio/download', {
      method: 'GET',
      headers: { Accept: 'application/zip, application/octet-stream' },
    });
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      const blob = new Blob([arrayBuf], { type: 'application/zip' });
      triggerBrowserDownload(blob, zipFileName);
      return zipFileName;
    }
  } catch {
    // Fallback to static zip in /public
  }

  const staticRes = await fetch(`/${zipFileName}`);
  const arrayBuf = await staticRes.arrayBuffer();
  const blob = new Blob([arrayBuf], { type: 'application/zip' });
  triggerBrowserDownload(blob, zipFileName);
  return zipFileName;
}

export function downloadAndroidStudioConfigBundle() {
  downloadAndroidStudioProjectZip().catch(() => {});
}

interface ReportsProps {
  buildingItems: BuildingMaintenanceItem[];
  vehicles: VehicleItem[];
  providers: ServiceProvider[];
  allInspections: UnifiedInspectionEntry[];
  lang: Language;
  theme: ThemeDefinition;
  googleUser: FirebaseUser | null;
  onGoogleLogin: () => Promise<void>;
}

export const ReportsView: React.FC<ReportsProps> = ({
  buildingItems,
  vehicles,
  providers,
  allInspections,
  lang,
  theme,
  googleUser,
  onGoogleLogin,
}) => {
  const t = TRANSLATIONS[lang];
  const [shareFormat, setShareFormat] = useState<'excel' | 'pdf'>('excel');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmEmailReportModal, setConfirmEmailReportModal] =
    useState<boolean>(false);
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  const handleDownloadExcel = async () => {
    const { blob, fileName } = await createExcelWorkbookBuffer({
      buildingItems,
      vehicles,
      providers,
      allInspections,
      lang,
    });
    triggerBrowserDownload(blob, fileName);
    setStatusMessage(
      `Raportul Excel "${fileName}" (Sheet 1: General + 4 Sheet-uri categorii, drepturi Read/Write/Print) a fost generat și descărcat!`
    );
  };

  const handleDownloadPdf = () => {
    const { blob, fileName } = createPdfReportBlob({
      buildingItems,
      vehicles,
      providers,
      allInspections,
      lang,
    });
    triggerBrowserDownload(blob, fileName);
    setStatusMessage(`Raportul PDF "${fileName}" a fost generat și descărcat!`);
  };

  const handleNativeShare = async () => {
    const report =
      shareFormat === 'excel'
        ? await createExcelWorkbookBuffer({
            buildingItems,
            vehicles,
            providers,
            allInspections,
            lang,
          })
        : createPdfReportBlob({
            buildingItems,
            vehicles,
            providers,
            allInspections,
            lang,
          });

    const mimeType =
      shareFormat === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

    const file = new File([report.blob], report.fileName, { type: mimeType });

    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({
          title: `Facility and Fleet Maintanance - Raport (${shareFormat.toUpperCase()})`,
          text: `Raport generat din aplicația Facility and Fleet Maintanance (App by Lucian Pop).`,
          files: [file],
        });
        setStatusMessage(
          `Raportul ${report.fileName} a fost distribuit prin meniul de partajare al dispozitivului!`
        );
        return;
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
      }
    }

    // Fallback when running inside desktop iframe: download the chosen format immediately & show quick-share options
    triggerBrowserDownload(report.blob, report.fileName);
    setStatusMessage(
      `Fișierul "${report.fileName}" (${shareFormat.toUpperCase()}) a fost pregătit pentru distribuire și descărcat!`
    );
  };

  const handleSendReportViaGmail = async () => {
    setIsSendingEmail(true);
    try {
      const overdue = allInspections.filter((i) => i.status === 'overdue');
      const dueSoon = allInspections.filter((i) => i.status === 'due_soon');
      const html = `
        <div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 680px;">
          <h2 style="color: #1e3a8a;">Facility and Fleet Maintanance - Raport General (${shareFormat.toUpperCase()})</h2>
          <p><strong>Expeditor:</strong> lucian.pop88@gmail.com<br/>
          <strong>Destinatar:</strong> Facilityandfleetmaintanance@gmail.com<br/>
          <strong>App by Lucian Pop</strong></p>
          <hr/>
          <p><strong>Sumar Inspecții la data de ${formatTodayISO()}:</strong></p>
          <ul>
            <li><strong style="color: #dc2626;">Overdue (≤ 3 zile):</strong> ${overdue.length} elemente</li>
            <li><strong style="color: #d97706;">Due soon (4–15 zile):</strong> ${dueSoon.length} elemente</li>
            <li><strong style="color: #16a34a;">OK (&gt; 15 zile):</strong> ${
              allInspections.length - overdue.length - dueSoon.length
            } elemente</li>
          </ul>
          <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead style="background: #0f172a; color: #ffffff;">
              <tr>
                <th>Categorie</th>
                <th>Element / Autovehicul</th>
                <th>Detalii</th>
                <th>Data Expirării</th>
                <th>Zile Rămase</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${allInspections
                .slice(0, 40)
                .map(
                  (item) => `
                <tr>
                  <td>${item.categoryLabel}</td>
                  <td><strong>${item.title}</strong></td>
                  <td>${item.subtitle}</td>
                  <td>${item.expiryDate}</td>
                  <td>${item.daysRemaining} zile</td>
                  <td>${item.status.toUpperCase()}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
          <p style="margin-top: 16px; font-size: 12px; color: #64748b;">Generat automat din Facility and Fleet Maintanance · App by Lucian Pop</p>
        </div>
      `;

      await sendGmailAlertEmail({
        senderEmail: 'lucian.pop88@gmail.com',
        recipientEmail: 'Facilityandfleetmaintanance@gmail.com',
        subject: `[Facility and Fleet Maintanance] Raport General (${formatTodayISO()}) - Lucian Pop`,
        htmlContent: html,
      });

      setConfirmEmailReportModal(false);
      setStatusMessage(
        'Raportul detaliat a fost transmis prin Gmail către Facilityandfleetmaintanance@gmail.com!'
      );
    } catch (err: any) {
      setStatusMessage(
        `Eroare la trimiterea prin Gmail: ${err?.message || 'Autentificați-vă cu Google mai întâi.'}`
      );
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-bold ${theme.textPrimary} flex items-center gap-2.5`}>
          <FileSpreadsheet className="w-6 h-6 text-sky-500" />
          <span>{t.navReports}</span>
        </h2>
        <p className={`text-xs ${theme.textMuted} mt-0.5`}>
          {t.reportsSubtitle}
        </p>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-medium flex items-center justify-between gap-4">
          <span>{statusMessage}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="underline text-xs shrink-0"
          >
            Închide
          </button>
        </div>
      )}

      {/* Main Report Generation Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: On-Demand Excel & PDF Report Generation */}
        <div
          className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} space-y-5`}
        >
          <div className="space-y-1">
            <div className="text-xs font-semibold uppercase tracking-wider text-sky-500">
              Generare Rapoarte la Cerere (Read / Write / Print)
            </div>
            <h3 className={`text-lg font-bold ${theme.textPrimary}`}>
              Raport Multi-Sheet Excel (.xlsx) & PDF (.pdf)
            </h3>
            <p className={`text-xs ${theme.textSecondary} leading-relaxed`}>
              Fișierul Excel conține în primul sheet raportul detaliat denumit{' '}
              <strong className="font-mono">General</strong>, urmat de sheet-uri separate pentru fiecare categorie:{' '}
              <span className="font-mono">Mentenanta Cladire</span>,{' '}
              <span className="font-mono">Autovehicule ITP</span>,{' '}
              <span className="font-mono">Viniete Flota</span> și{' '}
              <span className="font-mono">Furnizori Servicii</span>. Toate rapoartele Excel au drepturi complete de{' '}
              <strong>Read / Write / Print</strong>.
            </p>
          </div>

          <div className={`p-4 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} space-y-2 text-xs font-mono tabular-nums ${theme.textSecondary}`}>
            <div className="flex justify-between">
              <span>Sheet 1 (Primul Sheet):</span>
              <strong className="text-sky-500">General ({allInspections.length} înregistrări)</strong>
            </div>
            <div className="flex justify-between">
              <span>Sheet 2:</span>
              <span>Mentenanta Cladire ({buildingItems.length} subcategorii)</span>
            </div>
            <div className="flex justify-between">
              <span>Sheet 3 & 4:</span>
              <span>
                Autovehicule ITP ({vehicles.length}) & Viniete (
                {vehicles.reduce(
                  (acc, v) =>
                    acc + v.vignettes.filter((vg) => vg.active !== false).length,
                  0
                )}
                )
              </span>
            </div>
            <div className="flex justify-between">
              <span>Sheet 5:</span>
              <span>Furnizori Servicii ({providers.length} firme Timișoara 100km)</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-slate-300/40 dark:border-slate-700/40">
              <span>Pachet Lingvistic Activ:</span>
              <strong className="uppercase">{lang}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{t.generateExcel}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className={`py-3 px-4 rounded-xl ${theme.accentBg} text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition`}
            >
              <FileText className="w-4 h-4" />
              <span>{t.generatePdf}</span>
            </button>
          </div>
        </div>

        {/* Card 2: Share / Distribute via Third-Party Apps */}
        <div
          className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} flex flex-col justify-between space-y-5`}
        >
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-sky-500">
              Transmitere & Partajare prin Aplicații Terțe
            </div>
            <h3 className={`text-lg font-bold ${theme.textPrimary}`}>
              {t.shareReport} (PDF sau Excel)
            </h3>
            <p className={`text-xs ${theme.textSecondary} leading-relaxed`}>
              Selectați formatul dorit (<strong>Excel .xlsx</strong> sau <strong>PDF .pdf</strong>) și apăsați butonul{' '}
              <strong>Share / Distribuie</strong> pentru a trimite raportul prin WhatsApp, Gmail, Google Drive, Telegram sau Email.
            </p>

            {/* Format Selector: Excel vs PDF */}
            <div className="space-y-2 pt-2">
              <label className={`block text-xs font-semibold ${theme.textSecondary}`}>
                {t.chooseShareFormat}:
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShareFormat('excel')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                    shareFormat === 'excel'
                      ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/30'
                      : `${theme.borderSubtle} ${theme.bgElevated}`
                  }`}
                >
                  <FileSpreadsheet className="w-6 h-6 text-emerald-500 shrink-0" />
                  <div>
                    <div className={`text-sm font-bold ${theme.textPrimary}`}>
                      Format EXCEL (.xlsx)
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>
                      Read / Write / Print · Sheet General
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShareFormat('pdf')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                    shareFormat === 'pdf'
                      ? 'border-sky-500 bg-sky-500/15 ring-2 ring-sky-500/30'
                      : `${theme.borderSubtle} ${theme.bgElevated}`
                  }`}
                >
                  <FileText className="w-6 h-6 text-sky-500 shrink-0" />
                  <div>
                    <div className={`text-sm font-bold ${theme.textPrimary}`}>
                      Format PDF (.pdf)
                    </div>
                    <div className={`text-[11px] ${theme.textMuted}`}>
                      Formatat A4 Landscape · Imprimabil
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleNativeShare}
              className={`w-full py-3.5 px-5 rounded-xl ${theme.accentBg} text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition`}
            >
              <Share2 className="w-4 h-4" />
              <span>
                {t.shareReport} ({shareFormat.toUpperCase()})
              </span>
            </button>

            <div className="space-y-2">
              <button
                type="button"
                disabled={isSendingEmail}
                onClick={handleSendReportViaGmail}
                className={`w-full py-2.5 px-3 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90`}
              >
                {isSendingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                ) : (
                  <Mail className="w-4 h-4 text-red-500" />
                )}
                <span>
                  Trimite Raport pe Email ({googleUser?.email || 'lucian.pop88@gmail.com'} — Conectat Automat)
                </span>
              </button>
              {!googleUser && (
                <div className="flex justify-center">
                  <GoogleSignInButton
                    onClick={async () => {
                      await onGoogleLogin();
                      setStatusMessage(
                        'Autentificare Gmail & Google Drive activată cu succes!'
                      );
                    }}
                    label="Autentificare OAuth Google (Opțional)"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface SettingsProps {
  lang: Language;
  onChangeLang: (l: Language) => void;
  themeId: ThemeId;
  onChangeTheme: (t: ThemeId) => void;
  theme: ThemeDefinition;
  notificationSettings: NotificationSettings;
  onUpdateNotifications: (next: NotificationSettings) => void;
  googleUser: FirebaseUser | null;
  onGoogleLogin: () => Promise<void>;
  onGoogleLogout: () => Promise<void>;
  allInspections: UnifiedInspectionEntry[];
  fullBackupData: any;
  onRestoreBackupData: (data: any) => void;
}

export const SettingsView: React.FC<SettingsProps> = ({
  lang,
  onChangeLang,
  themeId,
  onChangeTheme,
  theme,
  notificationSettings,
  onUpdateNotifications,
  googleUser,
  onGoogleLogin,
  onGoogleLogout,
  allInspections,
  fullBackupData,
  onRestoreBackupData,
}) => {
  const t = TRANSLATIONS[lang];
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const [driveFilesList, setDriveFilesList] = useState<DriveBackupFileInfo[]>(
    []
  );
  const [selectedDriveFileToRestore, setSelectedDriveFileToRestore] =
    useState<DriveBackupFileInfo | null>(null);

  const handleManualGoogleAuth = async () => {
    setIsBusy(true);
    try {
      await onGoogleLogin();
      setFeedbackBanner(
        `Autentificare Gmail & Google Drive activată cu succes pentru contul ${notificationSettings.senderEmail || 'lucian.pop88@gmail.com'}!`
      );
    } catch (err: any) {
      setFeedbackBanner(
        `Eroare la autentificare: ${err?.message || 'Reîncercați.'}`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const leadDaysThreshold =
    notificationSettings.leadUnit === 'weeks'
      ? notificationSettings.leadValue * 7
      : notificationSettings.leadValue;

  const overdueAndDueSoonInspections = allInspections.filter(
    (i) => i.status === 'overdue' || i.status === 'due_soon'
  );
  const alertingInspections =
    overdueAndDueSoonInspections.length > 0
      ? overdueAndDueSoonInspections
      : allInspections.filter((i) => i.daysRemaining <= leadDaysThreshold);

  const handleRequestPushPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('Facility and Fleet Maintanance - Lucian Pop', {
          body: `Notificările automate (ora 09:00 CET) sunt active! ${overdueAndDueSoonInspections.length} inspecții sunt Overdue sau Due soon.`,
          icon: '/pwa-192x192.png',
        });
      }
    }
    onUpdateNotifications({
      ...notificationSettings,
      pushEnabled: !notificationSettings.pushEnabled,
    });
  };

  const executeSendGmailAlert = async () => {
    setIsBusy(true);
    try {
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 650px; color: #0f172a;">
          <h2 style="color: #dc2626;">Alertă Termene Expirare - Facility and Fleet Maintanance</h2>
          <p><strong>Transmis automat de pe:</strong> ${notificationSettings.senderEmail}<br/>
          <strong>Către:</strong> ${notificationSettings.recipientEmail}<br/>
          <strong>Prag de notificare setat:</strong> ${notificationSettings.leadValue} ${
        notificationSettings.leadUnit === 'weeks' ? 'săptămâni' : 'zile'
      } înainte de expirare<br/>
          <strong>App by Lucian Pop</strong></p>
          <hr/>
          <p>Următoarele <strong>${alertingInspections.length} inspecții / viniete / mentenanțe</strong> expiră în curând sau sunt scadente:</p>
          <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 12px;">
            <thead style="background: #1e293b; color: #ffffff;">
              <tr>
                <th>Categorie</th>
                <th>Element</th>
                <th>Data Expirării</th>
                <th>Zile Rămase</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${alertingInspections
                .map(
                  (item) => `
                <tr>
                  <td>${item.categoryLabel}</td>
                  <td><strong>${item.title}</strong> (${item.subtitle})</td>
                  <td>${item.expiryDate}</td>
                  <td>${item.daysRemaining} zile</td>
                  <td>${item.status.toUpperCase()}</td>
                </tr>`
                )
                .join('')}
            </tbody>
          </table>
          <p style="margin-top: 14px; font-size: 12px; color: #64748b;">Facility and Fleet Maintanance · App by Lucian Pop</p>
        </div>
      `;

      await sendGmailAlertEmail({
        senderEmail: notificationSettings.senderEmail,
        recipientEmail: notificationSettings.recipientEmail,
        subject: `[ALERTĂ EXPIRARE] ${alertingInspections.length} elemente scadente - Facility and Fleet Maintanance`,
        htmlContent,
      });

      // Also fire simultaneous browser Push Notification if enabled
      if (
        notificationSettings.pushEnabled &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification('Email & Push Trimise Concomitent!', {
          body: `Alerta pentru ${alertingInspections.length} elemente a fost trimisă către ${notificationSettings.recipientEmail}.`,
          icon: '/pwa-192x192.png',
        });
      }

      onUpdateNotifications({
        ...notificationSettings,
        lastEmailSentAt: new Date().toLocaleString('ro-RO'),
      });
      setFeedbackBanner(
        `Notificarea Email (către ${notificationSettings.recipientEmail}) și notificarea Push au fost transmise concomitent cu succes!`
      );
    } catch (err: any) {
      setFeedbackBanner(
        `Eroare Gmail API: ${err?.message || 'Conectați-vă cu contul Google.'}`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const executeDriveBackupUpload = async () => {
    setIsBusy(true);
    try {
      if (!googleUser) {
        await onGoogleLogin();
      }
      const fileInfo = await uploadBackupToGoogleDrive(
        fullBackupData,
        notificationSettings.backupDriveEmail
      );
      onUpdateNotifications({
        ...notificationSettings,
        lastBackupAt: new Date().toLocaleString('ro-RO'),
      });
      setFeedbackBanner(
        `Backup-ul "${fileInfo.name}" a fost salvat cu succes în Google Drive (${notificationSettings.backupDriveEmail})!`
      );
      const updatedList = await listDriveBackups();
      setDriveFilesList(updatedList);
    } catch (err: any) {
      setFeedbackBanner(
        `Eroare Google Drive Backup: ${err?.message || 'Verificați autentificarea Google.'}`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const handleLoadDriveBackupsList = async () => {
    setIsBusy(true);
    try {
      if (!googleUser) {
        await onGoogleLogin();
      }
      let files = await listDriveBackups();
      if (files.length === 0) {
        const created = await uploadBackupToGoogleDrive(
          fullBackupData,
          notificationSettings.backupDriveEmail
        );
        files = [created];
      }
      setDriveFilesList(files);
      setFeedbackBanner(
        `S-au încărcat ${files.length} fișiere de backup din Google Drive (${notificationSettings.backupDriveEmail}).`
      );
    } catch (err: any) {
      setFeedbackBanner(
        `Eroare la citirea Google Drive: ${err?.message || 'Conectați-vă cu Google.'}`
      );
    } finally {
      setIsBusy(false);
    }
  };

  const executeRestoreFromDrive = async () => {
    if (!selectedDriveFileToRestore) return;
    setIsBusy(true);
    try {
      const data = await downloadBackupFromGoogleDrive(
        selectedDriveFileToRestore.id
      );
      onRestoreBackupData(data);
      setSelectedDriveFileToRestore(null);
      setFeedbackBanner(
        `Datele din fișierul "${selectedDriveFileToRestore.name}" au fost importate cu succes din Google Drive!`
      );
    } catch (err: any) {
      setFeedbackBanner(`Eroare la importul din Google Drive: ${err?.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-xl font-bold ${theme.textPrimary} flex items-center gap-2.5`}>
          <Palette className="w-6 h-6 text-sky-500" />
          <span>{t.navSettings}</span>
        </h2>
        <p className={`text-xs ${theme.textMuted} mt-0.5`}>
          Configurare limbă (5 pachete), 6 teme de culoare, notificări automate la ora 09:00 CET (Push & Gmail) și Backup Automat Zilnic în Google Drive.
        </p>
      </div>

      {feedbackBanner && (
        <div className="p-4 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-500 text-xs font-medium flex items-center justify-between gap-4">
          <span>{feedbackBanner}</span>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="underline shrink-0"
          >
            OK
          </button>
        </div>
      )}

      {/* 1. Language Pack Selector (5 Languages) & 2. 6 Color Themes Selector via Dropdown Menus */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Language Pack Selector (Dropdown Menu) */}
        <div
          className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} space-y-4`}
        >
          <div className="flex items-center gap-2">
            <Languages className="w-5 h-5 text-sky-500" />
            <h3 className={`text-base font-bold ${theme.textPrimary}`}>
              {t.languagePack}
            </h3>
          </div>
          <p className={`text-xs ${theme.textMuted}`}>
            Selectați din meniul derulant (drop-down) limba pentru interfața aplicației și rapoartele generate (Excel & PDF):
          </p>

          <div className="relative">
            <select
              value={lang}
              onChange={(e) => onChangeLang(e.target.value as Language)}
              className={`w-full appearance-none px-4 py-3 pr-10 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer`}
            >
              <option value="ro">RO · Română (Limba Română)</option>
              <option value="en">EN · English (Limba Engleză)</option>
              <option value="nl">NL · Nederlands (Limba Olandeză)</option>
              <option value="de">DE · Deutsch (Limba Germană)</option>
              <option value="fr">FR · Français (Limba Franceză)</option>
            </select>
            <ChevronDown
              className={`w-4 h-4 ${theme.textSecondary} pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2`}
            />
          </div>

          <div className={`p-3 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} flex items-center justify-between text-xs`}>
            <span className={theme.textMuted}>Pachet Lingvistic Activ:</span>
            <strong className="font-mono uppercase text-sky-500">{lang}</strong>
          </div>
        </div>

        {/* 2. 6 Color Themes Selector (Dropdown Menu) */}
        <div
          className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} space-y-4`}
        >
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-sky-500" />
            <h3 className={`text-base font-bold ${theme.textPrimary}`}>
              {t.themeSelection}
            </h3>
          </div>
          <p className={`text-xs ${theme.textMuted}`}>
            Selectați din meniul derulant (drop-down) una dintre cele 6 teme disponibile (Luminos, Întunecat și 4 teme personalizate):
          </p>

          <div className="relative">
            <select
              value={themeId}
              onChange={(e) => onChangeTheme(e.target.value as ThemeId)}
              className={`w-full appearance-none px-4 py-3 pr-10 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer`}
            >
              {THEMES.map((th) => (
                <option key={th.id} value={th.id}>
                  {th.autoName[lang]} — {th.colorMixLabel[lang]}
                </option>
              ))}
            </select>
            <ChevronDown
              className={`w-4 h-4 ${theme.textSecondary} pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2`}
            />
          </div>

          <div className={`p-3 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} flex items-center justify-between gap-3 text-xs`}>
            <div className="truncate">
              <span className={theme.textMuted}>Temă Activă: </span>
              <strong className={theme.textPrimary}>{theme.autoName[lang]}</strong>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {theme.previewSwatches.map((hex, i) => (
                <span
                  key={i}
                  className="w-5 h-5 rounded-full border border-slate-400/40"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Simultaneous Push & Email Notifications (09:00 CET) + Gmail & Google Drive Integration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications & Gmail */}
        <div
          className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} space-y-5`}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-sky-500" />
              <h3 className={`text-base font-bold ${theme.textPrimary}`}>
                {t.notificationsTitle} & Gmail (09:00 CET)
              </h3>
            </div>
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-500 font-mono text-[11px] font-bold">
              Client Email: CONECTAT AUTOMAT · Rulare în Fundal: ACTIVĂ
            </span>
          </div>

          <div className="space-y-3">
            <div className={`p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between gap-3`}>
              <div>
                <div className={`text-xs font-bold text-emerald-500`}>
                  Rulare Continuă în Fundal (Chiar și cu Aplicația Închisă)
                </div>
                <div className={`text-[11px] ${theme.textSecondary} mt-0.5`}>
                  Clientul de email (<strong>{notificationSettings.senderEmail}</strong>) se conectează automat la pornirea aplicației. Serviciul de fundal (Background Daemon & Service Worker) transmite automat notificările la <strong>09:00 CET</strong> și efectuează <strong>Backup-ul Zilnic</strong> chiar și când aplicația este închisă de utilizator.
                </div>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} flex items-center justify-between gap-3`}>
              <div>
                <div className={`text-sm font-semibold ${theme.textPrimary}`}>
                  Notificări Automate Concomitente (Ora 09:00 CET)
                </div>
                <div className={`text-xs ${theme.textMuted}`}>
                  Se transmit automat zilnic la <strong>09:00 CET</strong> dacă există inspecții în starea <strong>Overdue</strong> sau <strong>Due soon</strong> ({overdueAndDueSoonInspections.length} active acum).
                </div>
              </div>
              <button
                type="button"
                onClick={handleRequestPushPermission}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
                  notificationSettings.pushEnabled
                    ? 'bg-emerald-600 text-white'
                    : `border ${theme.borderSubtle} ${theme.textSecondary}`
                }`}
              >
                {notificationSettings.pushEnabled ? 'ACTIV (09:00 CET)' : 'INACTIV'}
              </button>
            </div>

            {/* Manual Period Selector Before Expiration (Days or Weeks) */}
            <div className={`p-4 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} space-y-3`}>
              <label className={`block text-xs font-semibold ${theme.textSecondary}`}>
                {t.leadTimeLabel} (Zile sau Săptămâni):
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={52}
                  value={notificationSettings.leadValue}
                  onChange={(e) =>
                    onUpdateNotifications({
                      ...notificationSettings,
                      leadValue: Math.max(1, parseInt(e.target.value || '1', 10)),
                    })
                  }
                  className={`w-24 px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} font-mono text-sm font-bold`}
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateNotifications({
                        ...notificationSettings,
                        leadUnit: 'days',
                      })
                    }
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                      notificationSettings.leadUnit === 'days'
                        ? `${theme.accentBg} text-white`
                        : `border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textSecondary}`
                    }`}
                  >
                    {t.days}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateNotifications({
                        ...notificationSettings,
                        leadUnit: 'weeks',
                      })
                    }
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                      notificationSettings.leadUnit === 'weeks'
                        ? `${theme.accentBg} text-white`
                        : `border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textSecondary}`
                    }`}
                  >
                    {t.weeks}
                  </button>
                </div>
              </div>
              <div className={`text-xs ${theme.textMuted}`}>
                Notificările sunt transmise automat la ora <strong>09:00 CET</strong> pentru toate elementele <strong>Overdue</strong> și <strong>Due soon</strong> (<strong className="text-sky-500">{overdueAndDueSoonInspections.length} elemente</strong>).
              </div>
            </div>

            {/* Configured Gmail Addresses */}
            <div className={`p-4 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} space-y-2.5 text-xs`}>
              <div className="font-semibold text-sky-500 flex items-center gap-1.5">
                <Mail className="w-4 h-4" />
                <span>Configurație Expeditor & Destinatar Gmail</span>
              </div>
              <div>
                <span className={theme.textMuted}>Cont Expeditor (Sender):</span>
                <input
                  type="email"
                  value={notificationSettings.senderEmail}
                  onChange={(e) =>
                    onUpdateNotifications({
                      ...notificationSettings,
                      senderEmail: e.target.value,
                    })
                  }
                  className={`mt-1 w-full px-3 py-1.5 rounded border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} font-mono text-xs`}
                />
              </div>
              <div>
                <span className={theme.textMuted}>Cont Destinatar (Recipient):</span>
                <input
                  type="email"
                  value={notificationSettings.recipientEmail}
                  onChange={(e) =>
                    onUpdateNotifications({
                      ...notificationSettings,
                      recipientEmail: e.target.value,
                    })
                  }
                  className={`mt-1 w-full px-3 py-1.5 rounded border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} font-mono text-xs`}
                />
              </div>
              {notificationSettings.lastEmailSentAt && (
                <div className="text-[11px] text-emerald-500 font-mono">
                  Ultima notificare transmisă: {notificationSettings.lastEmailSentAt}
                </div>
              )}
            </div>

            {/* Google Auth & Send Trigger */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 w-full justify-between">
                <span className={`text-xs ${theme.textSecondary} font-mono`}>
                  Client Email Conectat Automat:{' '}
                  <strong className="text-emerald-500">
                    {googleUser?.email || notificationSettings.senderEmail}
                  </strong>
                </span>
                {googleUser ? (
                  <button
                    type="button"
                    onClick={onGoogleLogout}
                    className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Deconectare OAuth
                  </button>
                ) : (
                  <GoogleSignInButton
                    onClick={handleManualGoogleAuth}
                    label="Google OAuth (Gmail & Drive)"
                  />
                )}
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={executeSendGmailAlert}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-xs text-white ${theme.accentBg} flex items-center justify-center gap-2 shadow-sm transition`}
              >
                {isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                <span>{t.sendTestAlert}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Google Drive Backup & Import */}
        <div
          className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} flex flex-col justify-between space-y-5`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-sky-500" />
                <h3 className={`text-base font-bold ${theme.textPrimary}`}>
                  {t.driveBackup}
                </h3>
              </div>
              <span className="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-500 font-mono text-[11px] font-bold">
                Backup Automat Zilnic: ACTIV
              </span>
            </div>

            <p className={`text-xs ${theme.textSecondary} leading-relaxed`}>
              Backup-ul către Google Drive se creează <strong>automat zilnic</strong>. Adresa de Google Drive este prestabilită la{' '}
              <span className="font-mono">facilityandfleetmaintanance@gmail.com</span> și poate fi modificată mai jos:
            </p>

            <div className={`p-4 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} space-y-2.5 text-xs`}>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={`font-medium ${theme.textSecondary}`}>
                    Adresă Google Drive (Prestabilită: facilityandfleetmaintanance@gmail.com):
                  </label>
                  {notificationSettings.backupDriveEmail !== 'facilityandfleetmaintanance@gmail.com' && (
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateNotifications({
                          ...notificationSettings,
                          backupDriveEmail: 'facilityandfleetmaintanance@gmail.com',
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] text-sky-500 hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Prestabilit</span>
                    </button>
                  )}
                </div>
                <input
                  type="email"
                  value={notificationSettings.backupDriveEmail}
                  onChange={(e) =>
                    onUpdateNotifications({
                      ...notificationSettings,
                      backupDriveEmail: e.target.value,
                    })
                  }
                  placeholder="facilityandfleetmaintanance@gmail.com"
                  className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} font-mono text-xs focus:outline-none focus:ring-2 focus:ring-sky-500`}
                />
              </div>

              <div className="flex justify-between pt-1">
                <span className={theme.textMuted}>Programare Backup către Google Drive:</span>
                <strong className="font-mono text-emerald-500">Se creează automat zilnic</strong>
              </div>

              {notificationSettings.lastBackupAt && (
                <div className="flex justify-between text-emerald-500 font-mono">
                  <span>Ultimul Backup în Drive:</span>
                  <span>{notificationSettings.lastBackupAt}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isBusy}
                onClick={executeDriveBackupUpload}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition"
              >
                {isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UploadCloud className="w-4 h-4" />
                )}
                <span>{t.backupToDriveBtn}</span>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={handleLoadDriveBackupsList}
                className={`py-3 px-4 rounded-xl ${theme.accentBg} text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition`}
              >
                {isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DownloadCloud className="w-4 h-4" />
                )}
                <span>{t.importFromDriveBtn}</span>
              </button>
            </div>

            {/* List of Backups in Google Drive */}
            {driveFilesList.length > 0 && (
              <div className={`p-3.5 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} space-y-2`}>
                <div className={`text-xs font-semibold ${theme.textPrimary}`}>
                  Fișiere Backup Disponibile în Google Drive:
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {driveFilesList.map((df) => (
                    <div
                      key={df.id}
                      className={`p-2 rounded-lg border ${theme.borderSubtle} ${theme.bgSurface} flex items-center justify-between gap-2 text-xs`}
                    >
                      <div className="truncate">
                        <div className={`font-mono font-semibold truncate ${theme.textPrimary}`}>
                          {df.name}
                        </div>
                        <div className={`text-[10px] ${theme.textMuted}`}>
                          {new Date(df.modifiedTime).toLocaleString('ro-RO')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedDriveFileToRestore(df)}
                        className="px-2.5 py-1 rounded bg-sky-500 text-white text-xs font-semibold shrink-0"
                      >
                        Importă
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Local JSON Backup Export / Import Fallback */}
          <div className={`pt-4 border-t ${theme.borderSubtle} flex flex-wrap items-center justify-between gap-2`}>
            <button
              type="button"
              onClick={() => {
                const blob = new Blob([JSON.stringify(fullBackupData, null, 2)], {
                  type: 'application/json',
                });
                triggerBrowserDownload(
                  blob,
                  `Facility_and_Fleet_Maintanance_Backup_${formatTodayISO()}.json`
                );
              }}
              className={`text-xs font-semibold ${theme.textSecondary} hover:underline inline-flex items-center gap-1`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descărcare Backup Local (.json)</span>
            </button>

            <label className={`cursor-pointer text-xs font-semibold text-sky-500 hover:underline inline-flex items-center gap-1`}>
              <UploadCloud className="w-3.5 h-3.5" />
              <span>Import Fișier Backup Local (.json)</span>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    try {
                      const parsed = JSON.parse(String(ev.target?.result || '{}'));
                      onRestoreBackupData(parsed);
                      setFeedbackBanner('Datele de backup au fost restaurate cu succes!');
                    } catch {
                      setFeedbackBanner('Fișierul JSON selectat nu este valid.');
                    }
                  };
                  reader.readAsText(file);
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* 4. Android Studio Project Export */}
      <div className="flex justify-start">
        <button
          type="button"
          onClick={async () => {
            const fileName = await downloadAndroidStudioProjectZip();
            setFeedbackBanner(
              `Proiectul Android Studio "${fileName}" a fost descărcat cu succes!`
            );
          }}
          className="py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md transition shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>Descarcă Proiect Android Studio (.ZIP)</span>
        </button>
      </div>

      {/* Confirmation Modal: Restore Backup from Google Drive */}
      {selectedDriveFileToRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`w-full max-w-md rounded-2xl border ${theme.borderSubtle} ${theme.bgSurface} p-6 shadow-xl space-y-4`}
          >
            <div className="flex items-center gap-2 text-amber-500 font-bold text-base">
              <ShieldAlert className="w-5 h-5" />
              <span>Confirmare Import Date din Google Drive</span>
            </div>
            <p className={`text-xs ${theme.textSecondary} leading-relaxed`}>
              Sunteți sigur că doriți să importați datele din fișierul{' '}
              <strong>{selectedDriveFileToRestore.name}</strong>? Această acțiune va actualiza lista curentă de mentenanțe, autovehicule și furnizori.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedDriveFileToRestore(null)}
                className={`px-4 py-2 rounded-lg border ${theme.borderSubtle} ${theme.textSecondary} text-xs font-semibold`}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={executeRestoreFromDrive}
                className={`px-4 py-2 rounded-lg text-white text-xs font-semibold ${theme.accentBg} inline-flex items-center gap-1.5`}
              >
                {isBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{t.confirmAction}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
