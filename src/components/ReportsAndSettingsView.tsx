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
  AlertTriangle,
  Loader2,
  LogOut,
  RotateCcw,
  ChevronDown,
  Smartphone,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Eye,
  Edit3,
  Save,
  Sun,
  Moon,
  CheckCircle2,
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
  createInspectionsCsvBlob,
  createPdfReportBlob,
  triggerBrowserDownload,
} from '../utils/reportGenerator';
import {
  DriveBackupFileInfo,
  downloadBackupFromGoogleDrive,
  getResolvedWebAppUrl,
  listDriveBackups,
  saveWebAppLauncherToGoogleDrive,
  sendGmailAlertEmail,
  uploadBackupToGoogleDrive,
} from '../services/googleWorkspace';
import { GoogleSignInButton } from './AppEmblem';
import { formatTodayISO } from '../utils/dateUtils';
import {
  DEFAULT_EMAIL_SIGNATURE,
  DEFAULT_EMAIL_SUBJECT,
  DEFAULT_EMAIL_TEMPLATE,
  renderEmailHtml,
  renderEmailSubject,
} from '../utils/emailTemplateUtils';

export async function downloadAndroidStudioProjectZip(): Promise<string> {
  const zipFileName = 'Facility_and_Fleet_Maintenance_Android_Studio_Project.zip';
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
  const [shareFormat, setShareFormat] = useState<'excel' | 'pdf' | 'csv'>('excel');
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

  const handleDownloadCsv = () => {
    const { blob, fileName, totalRecords } = createInspectionsCsvBlob({
      buildingItems,
      vehicles,
      allInspections,
      lang,
    });
    triggerBrowserDownload(blob, fileName);
    setStatusMessage(
      `Fișierul CSV "${fileName}" (${totalRecords} inspecții complete: Mentenanță Clădire, ITP/MOT și Viniete) a fost generat prin biblioteca xlsx și descărcat cu succes!`
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
        : shareFormat === 'csv'
        ? createInspectionsCsvBlob({
            buildingItems,
            vehicles,
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
        : shareFormat === 'csv'
        ? 'text/csv'
        : 'application/pdf';

    const file = new File([report.blob], report.fileName, { type: mimeType });

    if (
      typeof navigator !== 'undefined' &&
      navigator.share &&
      (!navigator.canShare || navigator.canShare({ files: [file] }))
    ) {
      try {
        await navigator.share({
          title: `Facility and Fleet Maintenance - Raport (${shareFormat.toUpperCase()})`,
          text: `Raport generat din aplicația Facility and Fleet Maintenance (App by Lucian Pop).`,
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
          <h2 style="color: #1e3a8a;">Facility and Fleet Maintenance - Raport General (${shareFormat.toUpperCase()})</h2>
          <p><strong>Expeditor:</strong> lucian.pop88@gmail.com<br/>
          <strong>Destinatar:</strong> Facilityandfleetmaintenance@gmail.com<br/>
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
          <p style="margin-top: 16px; font-size: 12px; color: #64748b;">Generat automat din Facility and Fleet Maintenance · App by Lucian Pop</p>
        </div>
      `;

      await sendGmailAlertEmail({
        senderEmail: 'lucian.pop88@gmail.com',
        recipientEmail: 'Facilityandfleetmaintenance@gmail.com',
        subject: `[Facility and Fleet Maintenance] Raport General (${formatTodayISO()}) - Lucian Pop`,
        htmlContent: html,
      });

      setConfirmEmailReportModal(false);
      setStatusMessage(
        'Raportul detaliat a fost transmis prin Gmail de pe lucian.pop88@gmail.com către Facilityandfleetmaintenance@gmail.com!'
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={handleDownloadExcel}
              className="py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span>{t.generateExcel} (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="py-3 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Export CSV (.csv · xlsx)</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className={`py-3 px-3 rounded-xl ${theme.accentBg} text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>{t.generatePdf} (.pdf)</span>
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
              {t.shareReport} (Excel, CSV sau PDF)
            </h3>

            {/* Format Selector: Excel vs CSV vs PDF */}
            <div className="space-y-2 pt-2">
              <label className={`block text-xs font-semibold ${theme.textSecondary}`}>
                {t.chooseShareFormat}:
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                <button
                  type="button"
                  onClick={() => setShareFormat('excel')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                    shareFormat === 'excel'
                      ? 'border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/30'
                      : `${theme.borderSubtle} ${theme.bgElevated}`
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span className={`text-xs font-bold ${theme.textPrimary}`}>
                      Excel (.xlsx)
                    </span>
                  </div>
                  <div className={`text-[10px] ${theme.textMuted}`}>
                    5 Sheet-uri
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShareFormat('csv')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                    shareFormat === 'csv'
                      ? 'border-amber-500 bg-amber-500/15 ring-2 ring-amber-500/30'
                      : `${theme.borderSubtle} ${theme.bgElevated}`
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className={`text-xs font-bold ${theme.textPrimary}`}>
                      CSV (.csv)
                    </span>
                  </div>
                  <div className={`text-[10px] ${theme.textMuted}`}>
                    Export xlsx
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShareFormat('pdf')}
                  className={`p-3 rounded-xl border text-left transition flex flex-col justify-between gap-1.5 cursor-pointer ${
                    shareFormat === 'pdf'
                      ? 'border-sky-500 bg-sky-500/15 ring-2 ring-sky-500/30'
                      : `${theme.borderSubtle} ${theme.bgElevated}`
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-sky-500 shrink-0" />
                    <span className={`text-xs font-bold ${theme.textPrimary}`}>
                      PDF (.pdf)
                    </span>
                  </div>
                  <div className={`text-[10px] ${theme.textMuted}`}>
                    A4 Landscape
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleNativeShare}
              className={`w-full py-3.5 px-5 rounded-xl ${theme.accentBg} text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md transition cursor-pointer`}
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
                className={`w-full py-2.5 px-3 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 cursor-pointer`}
              >
                {isSendingEmail ? (
                  <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                ) : (
                  <Mail className="w-4 h-4 text-red-500" />
                )}
                <span>
                  Trimite Raport pe Email (lucian.pop88@gmail.com → Facilityandfleetmaintenance@gmail.com)
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

      {/* Card 3: Dedicated CSV Export Card for Complete Inspections using 'xlsx' */}
      <div
        className={`p-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-4`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
              <Download className="w-4 h-4" />
              <span>Export CSV Inspecții Complete (Biblioteca 'xlsx')</span>
            </div>
            <h3 className={`text-lg font-bold ${theme.textPrimary}`}>
              Listă Completă Inspecții: Clădire, ITP / MOT & Viniete Flotă
            </h3>
          </div>

          <button
            type="button"
            onClick={handleDownloadCsv}
            className="py-3 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md hover:shadow-lg transition shrink-0 cursor-pointer active:scale-[0.99]"
          >
            <Download className="w-4 h-4" />
            <span>Descarcă CSV Inspecții (.csv)</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-amber-500/20 text-xs font-mono">
          <div className={`p-2.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated}`}>
            <span className={theme.textMuted}>Mentenanță Clădire:</span>
            <div className={`text-sm font-bold text-sky-400 mt-0.5`}>
              {buildingItems.length} subcategorii
            </div>
          </div>
          <div className={`p-2.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated}`}>
            <span className={theme.textMuted}>Flotă ITP / MOT:</span>
            <div className={`text-sm font-bold text-emerald-400 mt-0.5`}>
              {vehicles.length} autovehicule
            </div>
          </div>
          <div className={`p-2.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated}`}>
            <span className={theme.textMuted}>Viniete de Drum:</span>
            <div className={`text-sm font-bold text-amber-400 mt-0.5`}>
              {vehicles.reduce((acc, v) => acc + v.vignettes.length, 0)} înregistrări (RO, HU, SK, CZ, AT)
            </div>
          </div>
          <div className={`p-2.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated}`}>
            <span className={theme.textMuted}>Total Linii Exportate:</span>
            <div className={`text-sm font-bold text-purple-400 mt-0.5`}>
              {buildingItems.length + vehicles.length + vehicles.reduce((acc, v) => acc + v.vignettes.length, 0)} inspecții
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
  onResetAllDates: () => void;
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
  onResetAllDates,
}) => {
  const t = TRANSLATIONS[lang];
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const [driveFilesList, setDriveFilesList] = useState<DriveBackupFileInfo[]>(
    []
  );
  const [selectedDriveFileToRestore, setSelectedDriveFileToRestore] =
    useState<DriveBackupFileInfo | null>(null);
  const [showResetConfirmModal, setShowResetConfirmModal] =
    useState<boolean>(false);

  const [copiedWebLink, setCopiedWebLink] = useState(false);
  const [isSavingWebLinkToDrive, setIsSavingWebLinkToDrive] = useState(false);
  const [pushPermissionStatus, setPushPermissionStatus] = useState<
    NotificationPermission | 'unsupported'
  >(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );

  // Custom Email Template & Signature State
  const [emailSubject, setEmailSubject] = useState<string>(
    notificationSettings.customEmailSubject || DEFAULT_EMAIL_SUBJECT
  );
  const [emailTemplate, setEmailTemplate] = useState<string>(
    notificationSettings.customEmailTemplate || DEFAULT_EMAIL_TEMPLATE
  );
  const [emailSignature, setEmailSignature] = useState<string>(
    notificationSettings.customEmailSignature || DEFAULT_EMAIL_SIGNATURE
  );
  const [showEmailPreview, setShowEmailPreview] = useState<boolean>(false);

  React.useEffect(() => {
    if (notificationSettings.customEmailSubject !== undefined) {
      setEmailSubject(notificationSettings.customEmailSubject);
    }
    if (notificationSettings.customEmailTemplate !== undefined) {
      setEmailTemplate(notificationSettings.customEmailTemplate);
    }
    if (notificationSettings.customEmailSignature !== undefined) {
      setEmailSignature(notificationSettings.customEmailSignature);
    }
  }, [
    notificationSettings.customEmailSubject,
    notificationSettings.customEmailTemplate,
    notificationSettings.customEmailSignature,
  ]);

  const handleSaveEmailTemplate = () => {
    onUpdateNotifications({
      ...notificationSettings,
      customEmailSubject: emailSubject,
      customEmailTemplate: emailTemplate,
      customEmailSignature: emailSignature,
    });
    setFeedbackBanner(
      'Șablonul de e-mail personalizat și semnătura proprie au fost salvate cu succes!'
    );
  };

  const handleResetEmailTemplate = () => {
    setEmailSubject(DEFAULT_EMAIL_SUBJECT);
    setEmailTemplate(DEFAULT_EMAIL_TEMPLATE);
    setEmailSignature(DEFAULT_EMAIL_SIGNATURE);
    onUpdateNotifications({
      ...notificationSettings,
      customEmailSubject: DEFAULT_EMAIL_SUBJECT,
      customEmailTemplate: DEFAULT_EMAIL_TEMPLATE,
      customEmailSignature: DEFAULT_EMAIL_SIGNATURE,
    });
    setFeedbackBanner(
      'Șablonul și semnătura au fost resetate la valorile implicite standard.'
    );
  };

  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPushPermissionStatus(Notification.permission);
    }
  }, []);

  const handleManualGoogleAuth = async () => {
    setIsBusy(true);
    try {
      await onGoogleLogin();
      setFeedbackBanner(
        `Autentificare Gmail & Google Drive activată cu succes pentru contul ${
          notificationSettings.senderEmail || 'lucian.pop88@gmail.com'
        }!`
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
      setPushPermissionStatus(perm);
      if (perm === 'granted') {
        new Notification('Facility and Fleet Maintenance - Lucian Pop', {
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

  const handleTestPushNotification = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setFeedbackBanner(
        'Notificările de tip push/browser nu sunt suportate de acest dispozitiv sau browser.'
      );
      return;
    }

    try {
      let currentPerm = Notification.permission;
      if (currentPerm !== 'granted') {
        currentPerm = await Notification.requestPermission();
        setPushPermissionStatus(currentPerm);
      }

      if (currentPerm === 'denied') {
        setFeedbackBanner(
          'Permisiunea pentru notificări de tip push este BLOCATĂ în browser. Pentru a primi alerte, accesați setările din bara de adrese a browserului și permiteți notificările.'
        );
        onUpdateNotifications({
          ...notificationSettings,
          pushEnabled: false,
        });
        return;
      }

      if (currentPerm === 'granted') {
        setPushPermissionStatus('granted');
        onUpdateNotifications({
          ...notificationSettings,
          pushEnabled: true,
        });

        const title = '🔔 [TEST NOTIFICARE] Facility and Fleet Maintenance';
        const options: NotificationOptions = {
          body: `Permisiunile de notificare browser/push sunt ACTIVE și confirmate! Aplicația este gata să transmită alerte automate la ora 09:00 CET pentru cele ${overdueAndDueSoonInspections.length} inspecții scadente.`,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: `ffm-test-push-${Date.now()}`,
          requireInteraction: false,
          data: { url: window.location.href },
        };

        let sentViaServiceWorker = false;
        if ('serviceWorker' in navigator) {
          try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (reg) {
              await reg.showNotification(title, options);
              sentViaServiceWorker = true;
            }
          } catch {
            // Fallback to standard Notification
          }
        }

        if (!sentViaServiceWorker) {
          new Notification(title, options);
        }

        setFeedbackBanner(
          '✅ Notificarea Push de test a fost expediată cu succes! Permisiunile din browser sunt active și confirmate.'
        );
      }
    } catch (err: any) {
      setFeedbackBanner(
        `Eroare la testarea notificării: ${err?.message || 'Permisiune refuzată'}`
      );
    }
  };

  const handleCopyWebLink = () => {
    const url = getResolvedWebAppUrl();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedWebLink(true);
      setTimeout(() => setCopiedWebLink(false), 2500);
      setFeedbackBanner('Link-ul aplicației pentru browser web a fost copiat în clipboard!');
    }
  };

  const handleSaveWebLinkToDrive = async () => {
    setIsSavingWebLinkToDrive(true);
    try {
      if (!googleUser) {
        await onGoogleLogin();
      }
      const fileInfo = await saveWebAppLauncherToGoogleDrive(
        notificationSettings.backupDriveEmail
      );
      setFeedbackBanner(
        `Shortcut-ul "${fileInfo.name}" a fost creat și salvat cu succes în contul Google Drive (${notificationSettings.backupDriveEmail})! Puteți lansa aplicația web oricând direct din Google Drive.`
      );
      const updatedList = await listDriveBackups();
      setDriveFilesList(updatedList);
    } catch (err: any) {
      setFeedbackBanner(
        `Eroare la salvarea linkului în Google Drive: ${err?.message || 'Eroare necunoscută'}`
      );
    } finally {
      setIsSavingWebLinkToDrive(false);
    }
  };

  const executeSendGmailAlert = async () => {
    setIsBusy(true);
    try {
      const htmlContent = renderEmailHtml({
        template: emailTemplate,
        signature: emailSignature,
        inspections: alertingInspections,
        senderEmail: notificationSettings.senderEmail,
        recipientEmail: notificationSettings.recipientEmail,
        leadValue: notificationSettings.leadValue,
        leadUnit: notificationSettings.leadUnit,
        currentDate: formatTodayISO(),
      });

      const subject = renderEmailSubject(
        emailSubject,
        alertingInspections.length,
        formatTodayISO()
      );

      await sendGmailAlertEmail({
        senderEmail: notificationSettings.senderEmail,
        recipientEmail: notificationSettings.recipientEmail,
        subject,
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
        `Notificarea Email (către ${notificationSettings.recipientEmail}) și notificarea Push au fost transmise concomitent cu succes folosind șablonul personalizat!`
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
        `Backup-ul "${fileInfo.name}" a fost salvat cu succes în folderul "Facility and Fleet Maintenance - Backups" din Google Drive (${notificationSettings.backupDriveEmail})!`
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

        {/* 2. Color Themes Selector (Dropdown Menu Exclusively) */}
        <div
          className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} space-y-4`}
        >
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-sky-500" />
            <h3 className={`text-base font-bold ${theme.textPrimary}`}>
              {t.themeSelection}
            </h3>
          </div>

          <div className="relative">
            <select
              value={themeId}
              onChange={(e) => onChangeTheme(e.target.value as ThemeId)}
              className={`w-full appearance-none px-4 py-3 pr-10 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer`}
            >
              {THEMES.map((th) => (
                <option key={th.id} value={th.id}>
                  {th.mode === 'light' ? '☀️' : '🌙'} {th.autoName[lang]} — {th.colorMixLabel[lang]}
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
              <span className="ml-2 text-[11px] font-mono opacity-75">
                ({theme.mode === 'light' ? 'Mod Luminos' : 'Mod Întunecat'})
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {theme.previewSwatches.map((hex, i) => (
                <span
                  key={i}
                  className="w-5 h-5 rounded-full border border-slate-400/40 shadow-xs"
                  style={{ backgroundColor: hex }}
                  title={hex}
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
              <div className={`text-xs font-bold text-emerald-500`}>
                Rulare Continuă în Fundal (Chiar și cu Aplicația Închisă)
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} flex items-center justify-between gap-3`}>
              <div className={`text-sm font-semibold ${theme.textPrimary}`}>
                Notificări Automate Concomitente (Ora 09:00 CET)
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

            {/* Push / Browser Notification Status & Manual Test Button */}
            <div className={`p-4 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} space-y-3`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className={`text-xs font-semibold ${theme.textPrimary} flex items-center gap-1.5`}>
                    <Bell className="w-4 h-4 text-sky-500" />
                    <span>Permisiuni Notificări Browser / Push:</span>
                  </div>
                  <div className="text-xs font-mono flex items-center gap-1.5">
                    {pushPermissionStatus === 'granted' ? (
                      <span className="text-emerald-500 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        ACTIVE & CONFIRMATE (Granted)
                      </span>
                    ) : pushPermissionStatus === 'denied' ? (
                      <span className="text-red-500 font-bold flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        BLOCATE în setările browserului (Denied)
                      </span>
                    ) : pushPermissionStatus === 'default' ? (
                      <span className="text-amber-500 font-bold">
                        ○ NECONFIRMATE (Apasă butonul de test pentru activare)
                      </span>
                    ) : (
                      <span className="text-slate-400">Nesuportat pe acest dispozitiv</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestPushNotification}
                  className={`py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 transition flex items-center justify-center gap-2 shadow-xs shrink-0`}
                >
                  <Bell className="w-4 h-4" />
                  <span>Testează Notificare Push / Browser Acum</span>
                </button>
              </div>
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
            </div>

            {/* Configured Gmail Addresses */}
            <div className={`p-4 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} space-y-2 text-xs font-mono`}>
              <div className="flex justify-between gap-2">
                <span className={theme.textMuted}>{t.senderEmailLabel}:</span>
                <strong className="text-emerald-500">
                  {notificationSettings.senderEmail}
                </strong>
              </div>
              <div className="flex justify-between gap-2">
                <span className={theme.textMuted}>{t.recipientEmailLabel}:</span>
                <strong className="text-sky-500">
                  {notificationSettings.recipientEmail}
                </strong>
              </div>
              {notificationSettings.lastEmailSentAt && (
                <div className="flex justify-between gap-2 pt-1 border-t border-slate-300/30 dark:border-slate-700/30 text-emerald-500">
                  <span>Ultima notificare transmisă:</span>
                  <span>{notificationSettings.lastEmailSentAt}</span>
                </div>
              )}
            </div>

            {/* Google Auth & Send Trigger */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 w-full justify-between">
                <span className={`text-xs ${theme.textSecondary} font-mono`}>
                  Client Email Conectat Automat:{' '}
                  <strong className="text-emerald-500">
                    {notificationSettings.senderEmail}
                  </strong>
                </span>
                <div className="flex items-center gap-2">
                  <GoogleSignInButton
                    onClick={handleManualGoogleAuth}
                    label={
                      googleUser
                        ? 'Re-autentifică Google (Gmail & Drive)'
                        : 'Google OAuth (Opțional)'
                    }
                  />
                  {googleUser && (
                    <button
                      type="button"
                      onClick={onGoogleLogout}
                      className="inline-flex items-center gap-1 text-xs text-red-500 hover:underline"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Deconectare
                    </button>
                  )}
                </div>
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

            <div className={`p-4 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} space-y-2.5 text-xs`}>
              <div className="flex justify-between">
                <span className={theme.textMuted}>{t.backupAccountLabel}:</span>
                <strong className="font-mono text-sky-500">
                  {notificationSettings.backupDriveEmail}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className={theme.textMuted}>Folder Google Drive dedicat:</span>
                <strong className="font-mono text-sky-500">Facility and Fleet Maintenance - Backups</strong>
              </div>
              <div className="flex justify-between">
                <span className={theme.textMuted}>Programare Backup către Google Drive:</span>
                <strong className="font-mono text-emerald-500">Zilnic automat la ora 16:00 CET</strong>
              </div>
              {notificationSettings.lastBackupAt && (
                <div className="flex justify-between pt-1 border-t border-slate-300/30 dark:border-slate-700/30 text-emerald-500 font-mono">
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

            {/* Google Drive Web App Link & Launcher */}
            <div className={`p-4 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-3`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-sky-500" />
                  <span className={`text-xs font-bold ${theme.textPrimary}`}>
                    Link Aplicație în Browser Web via Google Drive
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-sky-500/15 text-sky-500">
                  Acces Web & Drive
                </span>
              </div>

              <div className={`p-2.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} font-mono text-xs break-all flex items-center justify-between gap-2`}>
                <span className="text-sky-500 font-semibold truncate">
                  {getResolvedWebAppUrl()}
                </span>
                <button
                  type="button"
                  onClick={handleCopyWebLink}
                  title="Copiază linkul aplicației web"
                  className={`p-1.5 rounded hover:bg-slate-500/10 text-slate-400 hover:text-slate-200 transition shrink-0`}
                >
                  {copiedWebLink ? (
                    <Check className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Copy className="w-4 h-4 text-sky-500" />
                  )}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={isSavingWebLinkToDrive}
                  onClick={handleSaveWebLinkToDrive}
                  className="flex-1 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                >
                  {isSavingWebLinkToDrive ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <HardDrive className="w-3.5 h-3.5" />
                  )}
                  <span>Creează & Salvează Link Web în Google Drive</span>
                </button>

                <a
                  href={getResolvedWebAppUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`py-2.5 px-3.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} hover:opacity-80 font-semibold text-xs flex items-center justify-center gap-1.5 transition`}
                >
                  <ExternalLink className="w-3.5 h-3.5 text-sky-500" />
                  <span>Deschide în Browser Web</span>
                </a>
              </div>
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
                  `Facility_and_Fleet_Maintenance_Backup_${formatTodayISO()}.json`
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

      {/* 4. Dedicated Card: Custom Email Template & Personal Signature (Notificări Automate) */}
      <div
        className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} space-y-5`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Mail className="w-5 h-5 text-sky-500" />
            <h3 className={`text-base font-bold ${theme.textPrimary}`}>
              Șablon E-mail Personalizat & Semnătură Proprie (Notificări Automate)
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmailPreview(!showEmailPreview)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} hover:opacity-90 transition flex items-center gap-1.5 cursor-pointer`}
            >
              <Eye className="w-3.5 h-3.5 text-sky-500" />
              <span>{showEmailPreview ? 'Ascunde Previzualizarea' : 'Previzualizare E-mail'}</span>
            </button>
            <button
              type="button"
              onClick={handleResetEmailTemplate}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-500 border border-amber-500/30 hover:bg-amber-500/10 transition flex items-center gap-1.5 cursor-pointer`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Resetare Implicit</span>
            </button>
          </div>
        </div>

        {/* Available Placeholder Tags Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[11px] font-semibold ${theme.textSecondary}`}>
            Variabile disponibile:
          </span>
          {[
            { tag: '{nr_elemente}', label: 'Număr elemente' },
            { tag: '{data}', label: 'Data curentă' },
            { tag: '{tabel_inspectii}', label: 'Tabel inspecții' },
            { tag: '{expeditor}', label: 'Email expeditor' },
            { tag: '{destinatar}', label: 'Email destinatar' },
            { tag: '{prag_alerta}', label: 'Prag alertă' },
          ].map((v) => (
            <button
              key={v.tag}
              type="button"
              onClick={() => setEmailTemplate((prev) => prev + ` ${v.tag}`)}
              title={`Apasă pentru a insera ${v.tag} în șablon`}
              className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} hover:border-sky-500/60 transition cursor-pointer`}
            >
              {v.tag}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Column: Email Subject & Email Template Body */}
          <div className="space-y-4">
            <div>
              <label className={`block text-xs font-semibold ${theme.textSecondary} mb-1.5`}>
                Subiect E-mail Notificare:
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="[ALERTĂ EXPIRARE] {nr_elemente} elemente scadente..."
                className={`w-full px-3.5 py-2.5 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-xs font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500`}
              />
            </div>

            <div>
              <label className={`block text-xs font-semibold ${theme.textSecondary} mb-1.5`}>
                Șablon Mesaj E-mail (HTML / Text):
              </label>
              <textarea
                rows={7}
                value={emailTemplate}
                onChange={(e) => setEmailTemplate(e.target.value)}
                className={`w-full p-3 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y`}
              />
            </div>
          </div>

          {/* Right Column: Personal Signature & Save Buttons */}
          <div className="space-y-4 flex flex-col justify-between">
            <div>
              <label className={`block text-xs font-semibold ${theme.textSecondary} mb-1.5 flex items-center justify-between`}>
                <span>Semnătură Proprie (Personalizată):</span>
                <span className="text-[10px] text-sky-500 font-normal">Apare la finalul fiecărui e-mail</span>
              </label>
              <textarea
                rows={5}
                value={emailSignature}
                onChange={(e) => setEmailSignature(e.target.value)}
                placeholder="Numele dumneavoastră&#10;Funcția / Rolul&#10;Numele Companiei&#10;Telefon / Contact"
                className={`w-full p-3 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-xs font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-500 resize-y`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSaveEmailTemplate}
                className={`flex-1 py-3 px-4 rounded-xl ${theme.accentBg} text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition cursor-pointer active:scale-[0.99]`}
              >
                <Save className="w-4 h-4" />
                <span>Salvează Șablonul & Semnătura</span>
              </button>

              <button
                type="button"
                disabled={isBusy}
                onClick={executeSendGmailAlert}
                className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer shrink-0"
              >
                {isBusy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                <span>Trimite Test cu acest Șablon</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Preview of the Email */}
        {showEmailPreview && (
          <div className="pt-3 border-t border-slate-200/60 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-sky-500">
              <div className="flex items-center gap-1.5">
                <Eye className="w-4 h-4" />
                <span>Previzualizare Format E-mail (Cum va arăta în Inbox-ul destinatarului):</span>
              </div>
              <span className="font-mono text-[11px] text-slate-400">
                Subiect: {renderEmailSubject(emailSubject, alertingInspections.length, formatTodayISO())}
              </span>
            </div>
            <div
              className="p-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white text-slate-900 text-xs overflow-x-auto shadow-inner"
              dangerouslySetInnerHTML={{
                __html: renderEmailHtml({
                  template: emailTemplate,
                  signature: emailSignature,
                  inspections: alertingInspections.slice(0, 5),
                  senderEmail: notificationSettings.senderEmail,
                  recipientEmail: notificationSettings.recipientEmail,
                  leadValue: notificationSettings.leadValue,
                  leadUnit: notificationSettings.leadUnit,
                  currentDate: formatTodayISO(),
                }),
              }}
            />
          </div>
        )}
      </div>

      {/* 5. Settings Footer: Android Studio Project Export & Reset Dates Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200/60 dark:border-slate-800">
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

        <button
          type="button"
          onClick={() => setShowResetConfirmModal(true)}
          className="py-3.5 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-md transition shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Resetare Date Expirare</span>
        </button>
      </div>

      {/* Confirmation Modal: Reset All Expiration Dates */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className={`w-full max-w-md rounded-2xl border border-red-500/40 ${theme.bgSurface} p-6 shadow-2xl space-y-4`}
          >
            <div className="flex items-center gap-2.5 text-red-500 font-bold text-base">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Confirmare Resetare Date de Expirare</span>
            </div>
            <div className={`text-xs ${theme.textSecondary} space-y-2.5 leading-relaxed`}>
              <p>
                Sunteți sigur că doriți să resetați toate datele de expirare din aplicație?
              </p>
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 space-y-1">
                <p className="font-semibold text-red-500">Această acțiune va reseta:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                  <li>Toate datele de expirare Mentenanță Clădire (27+ subcategorii)</li>
                  <li>Toate datele de expirare ITP / MOT pentru flota de vehicule</li>
                  <li>Toate vinietele de drum (RO, HU, SK, CZ, AT vor fi dezactivate)</li>
                </ul>
              </div>
              <p className={`text-[11px] ${theme.textMuted}`}>
                După resetare, veți putea seta manual noile date de expirare pentru fiecare element în parte.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className={`px-4 py-2.5 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-xs font-semibold hover:opacity-90 transition`}
              >
                Anulează
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetAllDates();
                  setShowResetConfirmModal(false);
                  setFeedbackBanner(
                    'Reset complet: Toate datele de expirare (Mentenanță Clădire, ITP/MOT și Viniete) au fost șterse, iar toate vinietele au fost dezactivate! Acum puteți adăuga manual noile date de expirare.'
                  );
                }}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Confirmă Resetarea</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
