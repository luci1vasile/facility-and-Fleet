import React, { useState, useMemo } from 'react';
import {
  Car,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Plus,
  User,
  ShieldCheck,
  Globe,
  Trash2,
} from 'lucide-react';
import {
  Language,
  VehicleItem,
  VignetteCountry,
  VignetteDurationCode,
} from '../types';
import { ThemeDefinition, TRANSLATIONS } from '../i18n';
import {
  calculateItpExpiryDate,
  calculateVignetteExpiryDate,
  formatDateDisplay,
  formatTodayISO,
  getDaysRemaining,
  getInspectionStatus,
} from '../utils/dateUtils';

interface Props {
  vehicles: VehicleItem[];
  selectedVehicleId: string | null;
  onSelectVehicle: (id: string | null) => void;
  onBackToDashboard?: () => void;
  onRenewItp: (
    vehicleId: string,
    baseDate: string,
    periodYears: 1 | 2 | 3,
    newExpiryDate: string,
    updatedUserName?: string,
    updatedPlate?: string,
    updatedVin?: string
  ) => void;
  onRenewVignette: (
    vehicleId: string,
    country: VignetteCountry,
    baseDate: string,
    durationCode: VignetteDurationCode,
    newExpiryDate: string
  ) => void;
  onToggleVignetteActive: (
    vehicleId: string,
    country: VignetteCountry,
    active: boolean
  ) => void;
  onDeleteVehicle: (vehicleId: string) => void;
  onOpenAddVehicleModal: () => void;
  lang: Language;
  theme: ThemeDefinition;
}

const VIGNETTE_DURATIONS: Array<{
  code: VignetteDurationCode;
  labelKey: string;
}> = [
  { code: '1d', labelKey: 'dur1d' },
  { code: '7d', labelKey: 'dur7d' },
  { code: '10d', labelKey: 'dur10d' },
  { code: '3m', labelKey: 'dur3m' },
  { code: '6m', labelKey: 'dur6m' },
  { code: '12m', labelKey: 'dur12m' },
];

const COUNTRY_FLAGS: Record<VignetteCountry, string> = {
  Romania: 'RO · România (Rovinietă)',
  Ungaria: 'HU · Ungaria (e-Matrica)',
  Slovacia: 'SK · Slovacia (eZnamka)',
  Cehia: 'CZ · Cehia (eDalnice)',
  Austria: 'AT · Austria (Vignette)',
};

export const VehiclesView: React.FC<Props> = ({
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  onBackToDashboard,
  onRenewItp,
  onRenewVignette,
  onToggleVignetteActive,
  onDeleteVehicle,
  onOpenAddVehicleModal,
  lang,
  theme,
}) => {
  const t = TRANSLATIONS[lang];

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) || null,
    [vehicles, selectedVehicleId]
  );

  // Local state for ITP renewal on the vehicle's dedicated page
  const [itpBaseDate, setItpBaseDate] = useState<string>(formatTodayISO());
  const [itpYears, setItpYears] = useState<1 | 2 | 3>(2);
  const [editUserName, setEditUserName] = useState<string>('');
  const [editPlate, setEditPlate] = useState<string>('');
  const [editVin, setEditVin] = useState<string>('');
  const [itpSavedToast, setItpSavedToast] = useState<boolean>(false);

  // Per-country vignette renewal controls
  const [vignetteBaseDates, setVignetteBaseDates] = useState<
    Record<VignetteCountry, string>
  >({
    Romania: formatTodayISO(),
    Ungaria: formatTodayISO(),
    Slovacia: formatTodayISO(),
    Cehia: formatTodayISO(),
    Austria: formatTodayISO(),
  });
  const [vignetteDurations, setVignetteDurations] = useState<
    Record<VignetteCountry, VignetteDurationCode>
  >({
    Romania: '12m',
    Ungaria: '10d',
    Slovacia: '10d',
    Cehia: '10d',
    Austria: '10d',
  });
  const [vignetteSavedCountry, setVignetteSavedCountry] =
    useState<VignetteCountry | null>(null);

  React.useEffect(() => {
    if (selectedVehicle) {
      setItpBaseDate(formatTodayISO());
      setItpYears(selectedVehicle.itpPeriodYears || 2);
      setEditUserName(selectedVehicle.userName);
      setEditPlate(selectedVehicle.plateNumber);
      setEditVin(selectedVehicle.vinNumber || '');
      setItpSavedToast(false);
      setVignetteSavedCountry(null);
      const nextDurations: Record<VignetteCountry, VignetteDurationCode> = {
        Romania: '12m',
        Ungaria: '10d',
        Slovacia: '10d',
        Cehia: '10d',
        Austria: '10d',
      };
      selectedVehicle.vignettes.forEach((vg) => {
        nextDurations[vg.country] = vg.lastDurationCode || '12m';
      });
      setVignetteDurations(nextDurations);
    }
  }, [selectedVehicle]);

  const calculatedItpExpiry = useMemo(() => {
    return calculateItpExpiryDate(itpBaseDate, itpYears);
  }, [itpBaseDate, itpYears]);

  // Dedicated Subcategory Page for Selected Vehicle
  if (selectedVehicle) {
    const itpDays = getDaysRemaining(selectedVehicle.itpExpiryDate);
    const itpStatus = getInspectionStatus(selectedVehicle.itpExpiryDate);
    const previewItpDays = getDaysRemaining(calculatedItpExpiry);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectVehicle(null)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} text-sm font-medium hover:opacity-90 transition`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.backToList}</span>
            </button>
            {onBackToDashboard && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm font-medium hover:opacity-90 transition`}
              >
                <ArrowLeft className="w-4 h-4 text-sky-500" />
                <span>Înapoi la Panoul Principal (Fără modificări)</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onDeleteVehicle(selectedVehicle.id);
              onSelectVehicle(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Șterge Autovehicul</span>
          </button>
        </div>

        {/* Vehicle Identification & ITP / MOT Section */}
        <div
          className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} space-y-6`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-slate-200/60 dark:border-slate-800">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-500 shrink-0">
                <Car className="w-6 h-6" />
              </div>
              <div>
                <div className={`text-xs font-medium ${theme.textMuted}`}>
                  Subcategorie Autoturism · {selectedVehicle.makeModel}
                </div>
                <h2 className={`text-2xl font-bold font-mono tabular-nums ${theme.textPrimary}`}>
                  {selectedVehicle.plateNumber}
                </h2>
                <div className={`text-xs font-mono ${theme.textSecondary} mt-0.5`}>
                  {t.vinNumber}: <strong className={theme.textPrimary}>{selectedVehicle.vinNumber || '—'}</strong>
                </div>
                <div className={`text-sm ${theme.textSecondary} flex items-center gap-1.5 mt-0.5`}>
                  <User className="w-4 h-4 text-sky-500" />
                  <span>
                    {t.vehicleUser}: <strong>{selectedVehicle.userName}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Current ITP/MOT Status Box */}
            <div
              className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border ${
                itpStatus === 'overdue'
                  ? 'bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400'
                  : itpStatus === 'due_soon'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              <ShieldCheck className="w-7 h-7 shrink-0" />
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider">
                  {t.itpExpiry} ·{' '}
                  {itpStatus === 'overdue'
                    ? t.overdue
                    : itpStatus === 'due_soon'
                    ? t.dueSoon
                    : t.ok}
                </div>
                <div className="text-xl font-bold font-mono tabular-nums">
                  {selectedVehicle.itpExpiryDate} ({formatDateDisplay(selectedVehicle.itpExpiryDate, lang)})
                </div>
                <div className="text-xs font-mono tabular-nums mt-0.5">
                  {itpDays < 0
                    ? `${Math.abs(itpDays)} ${t.daysOverdue}`
                    : itpDays === 0
                    ? t.expiresToday
                    : `${itpDays} ${t.daysRemaining}`}
                </div>
              </div>
            </div>
          </div>

          {/* ITP / MOT Renewal Calculator (1 Year, 2 Years, 3 Years - New Car) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-4">
              <h3 className={`text-base font-semibold ${theme.textPrimary} flex items-center gap-2`}>
                <Calendar className="w-4 h-4 text-sky-500" />
                <span>Reînnoire ITP / MOT și Date Autovehicul</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-3">
                  <div>
                    <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                      {t.plateNumber}
                    </label>
                    <input
                      type="text"
                      value={editPlate}
                      onChange={(e) => setEditPlate(e.target.value.toUpperCase())}
                      className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} font-mono text-sm font-bold`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                      {t.vinNumber}
                    </label>
                    <input
                      type="text"
                      value={editVin}
                      onChange={(e) => setEditVin(e.target.value.toUpperCase())}
                      placeholder="Ex: W1N1671191A482910"
                      maxLength={17}
                      className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} font-mono text-sm uppercase tracking-wider`}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                      {t.vehicleUser}
                    </label>
                    <input
                      type="text"
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm`}
                    />
                  </div>

                  <div>
                    <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                      Dată Calendar ITP / MOT
                    </label>
                    <input
                      type="date"
                      value={itpBaseDate}
                      onChange={(e) => setItpBaseDate(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} font-mono text-sm`}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className={`block text-xs font-semibold ${theme.textSecondary}`}>
                  {t.itpRenewalPeriod} (Selectare Manuală):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(
                    [
                      { years: 1, label: t.year1, desc: 'Autoutilitare / Flotă intensivă' },
                      { years: 2, label: t.year2, desc: 'Standard autoturisme < 12 ani' },
                      { years: 3, label: t.year3NewCar, desc: 'Autoturism nou la prima înmatriculare' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.years}
                      type="button"
                      onClick={() => setItpYears(opt.years)}
                      className={`p-3 rounded-xl border text-left transition ${
                        itpYears === opt.years
                          ? 'border-sky-500 bg-sky-500/15 ring-2 ring-sky-500/30'
                          : `${theme.borderSubtle} ${theme.bgElevated} hover:opacity-90`
                      }`}
                    >
                      <div className={`text-sm font-bold ${theme.textPrimary}`}>
                        {opt.label}
                      </div>
                      <div className={`text-[11px] ${theme.textMuted} mt-0.5`}>
                        {opt.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculated ITP Result */}
            <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-sky-500">
                  Noua Dată de Expirare ITP / MOT Calculată
                </div>
                <div className={`text-3xl font-bold font-mono tabular-nums ${theme.textPrimary}`}>
                  {calculatedItpExpiry}
                </div>
                <div className={`text-xs ${theme.textSecondary}`}>
                  {formatDateDisplay(calculatedItpExpiry, lang)} ·{' '}
                  <span className="font-mono font-semibold text-emerald-500">
                    +{previewItpDays} {t.daysRemaining}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    onRenewItp(
                      selectedVehicle.id,
                      itpBaseDate,
                      itpYears,
                      calculatedItpExpiry,
                      editUserName,
                      editPlate,
                      editVin
                    );
                    setItpSavedToast(true);
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-sm text-white ${theme.accentBg} shadow-sm transition flex items-center justify-center gap-2`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Actualizează ITP / MOT ({itpYears === 3 ? t.year3NewCar : `${itpYears} Ani`})</span>
                </button>
                {itpSavedToast && (
                  <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-500 text-xs font-medium text-center">
                    ITP/MOT actualizat la {calculatedItpExpiry}!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Vignettes List Section: Romania, Ungaria, Slovacia, Cehia, Austria */}
        <div
          className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} space-y-5`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className={`text-lg font-bold ${theme.textPrimary} flex items-center gap-2`}>
                <Globe className="w-5 h-5 text-sky-500" />
                <span>{t.vignettesTitle}</span>
              </h3>
              <p className={`text-xs ${theme.textMuted}`}>
                Selectați data din calendar și perioada (1 zi, 7 zile, 10 zile, 3 luni, 6 luni, 12 luni). Vinietele pentru anumite țări pot fi oprite și reactivate la nevoie (vinietele inactive nu apar în rapoarte).
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {selectedVehicle.vignettes.map((vig) => {
              const isActive = vig.active !== false;
              const vigDays = getDaysRemaining(vig.expiryDate);
              const vigStatus = getInspectionStatus(vig.expiryDate);
              const selectedBase =
                vignetteBaseDates[vig.country] || formatTodayISO();
              const selectedDur =
                vignetteDurations[vig.country] || vig.lastDurationCode || '12m';
              const previewNewVigExpiry = calculateVignetteExpiryDate(
                selectedBase,
                selectedDur
              );

              const rowBorder = !isActive
                ? 'border-l-4 border-l-slate-400 dark:border-l-slate-600 opacity-75'
                : vigStatus === 'overdue'
                ? 'border-l-4 border-l-red-600'
                : vigStatus === 'due_soon'
                ? 'border-l-4 border-l-amber-500'
                : 'border-l-4 border-l-emerald-600';

              const statusColor = !isActive
                ? theme.textMuted
                : vigStatus === 'overdue'
                ? 'text-red-600 dark:text-red-400'
                : vigStatus === 'due_soon'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-emerald-600 dark:text-emerald-400';

              return (
                <div
                  key={vig.country}
                  className={`p-4 rounded-xl border ${theme.borderSubtle} ${rowBorder} ${theme.bgElevated} space-y-4`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Country & Current Expiration + Stop / Reactivate Toggle */}
                    <div className="space-y-1.5 min-w-[230px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-base font-bold ${theme.textPrimary}`}>
                          {COUNTRY_FLAGS[vig.country]}
                        </span>
                        {isActive ? (
                          <span className={`text-xs font-bold font-mono ${statusColor}`}>
                            ●{' '}
                            {vigStatus === 'overdue'
                              ? t.overdue
                              : vigStatus === 'due_soon'
                              ? t.dueSoon
                              : t.ok}
                          </span>
                        ) : (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textMuted}`}
                          >
                            Oprită (Inactivă)
                          </span>
                        )}
                      </div>

                      {isActive ? (
                        <div className={`text-xs ${theme.textSecondary} font-mono tabular-nums`}>
                          Expiră la: <strong className="text-sm">{vig.expiryDate}</strong> ·{' '}
                          <span className={statusColor}>
                            {vigDays < 0
                              ? `${Math.abs(vigDays)} ${t.daysOverdue}`
                              : vigDays === 0
                              ? t.expiresToday
                              : `${vigDays} ${t.daysRemaining}`}
                          </span>
                        </div>
                      ) : (
                        <div className={`text-xs ${theme.textMuted}`}>
                          Vinietă oprită — exclusă din alerte și din rapoarte.
                        </div>
                      )}

                      <div className="pt-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            onToggleVignetteActive(
                              selectedVehicle.id,
                              vig.country,
                              !isActive
                            )
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                            isActive
                              ? 'border-red-500/40 bg-red-500/10 text-red-500 hover:bg-red-500/20'
                              : 'border-emerald-500 bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          {isActive ? 'Oprește Vinieta' : 'Reactivează Vinieta'}
                        </button>
                      </div>
                    </div>

                    {isActive && (
                      <>
                        {/* Calendar Picker for Vignette */}
                        <div className="flex flex-wrap items-center gap-3">
                          <div>
                            <label className={`block text-[11px] ${theme.textMuted} mb-1`}>
                              Dată Start / Prelungire
                            </label>
                            <input
                              type="date"
                              value={selectedBase}
                              onChange={(e) =>
                                setVignetteBaseDates((prev) => ({
                                  ...prev,
                                  [vig.country]: e.target.value,
                                }))
                              }
                              className={`px-2.5 py-1.5 rounded-lg border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} font-mono text-xs`}
                            />
                          </div>

                          {/* 6 Duration Buttons: 1 zi, 7 zile, 10 zile, 3 luni, 6 luni, 12 luni */}
                          <div>
                            <label className={`block text-[11px] ${theme.textMuted} mb-1`}>
                              Perioadă Valabilitate Vinietă
                            </label>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {VIGNETTE_DURATIONS.map((d) => (
                                <button
                                  key={d.code}
                                  type="button"
                                  onClick={() =>
                                    setVignetteDurations((prev) => ({
                                      ...prev,
                                      [vig.country]: d.code,
                                    }))
                                  }
                                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                                    selectedDur === d.code
                                      ? `${theme.accentBg} text-white`
                                      : `border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textSecondary}`
                                  }`}
                                >
                                  {t[d.labelKey]}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Auto-Calculated New Date & Apply Button */}
                        <div className="flex items-center justify-between lg:justify-end gap-4 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-300/40 dark:border-slate-700/40">
                          <div className="text-left lg:text-right">
                            <div className={`text-[11px] ${theme.textMuted}`}>
                              Noua Expirare Calculată
                            </div>
                            <div className="text-sm font-bold font-mono tabular-nums text-sky-500">
                              {previewNewVigExpiry}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              onRenewVignette(
                                selectedVehicle.id,
                                vig.country,
                                selectedBase,
                                selectedDur,
                                previewNewVigExpiry
                              );
                              setVignetteSavedCountry(vig.country);
                            }}
                            className={`px-3.5 py-2 rounded-lg text-xs font-semibold text-white ${theme.accentBg} shadow-sm transition whitespace-nowrap`}
                          >
                            {t.extendVignette}
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {isActive && vignetteSavedCountry === vig.country && (
                    <div className="text-xs text-emerald-500 font-medium">
                      ✓ Vinieta pentru {vig.country} a fost prelungită până la {vig.expiryDate}!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Overview Grid of all Fleet Vehicles
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${theme.textPrimary} flex items-center gap-2.5`}>
            <Car className="w-6 h-6 text-sky-500" />
            <span>{t.navVehicles} ({vehicles.length} Autoturisme în Flotă)</span>
          </h2>
          <p className={`text-xs ${theme.textMuted} mt-0.5`}>
            Fiecare autoturism are subcategorie și pagină proprie pentru ITP/MOT (1, 2, 3 ani) și Viniete (România, Ungaria, Slovacia, Cehia, Austria).
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddVehicleModal}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white ${theme.accentBg} shadow-sm transition whitespace-nowrap`}
        >
          <Plus className="w-4 h-4" />
          <span>{t.addVehicle}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vehicles.map((veh) => {
          const itpDays = getDaysRemaining(veh.itpExpiryDate);
          const itpStatus = getInspectionStatus(veh.itpExpiryDate);

          const cardBorder =
            itpStatus === 'overdue'
              ? 'border-l-4 border-l-red-600'
              : itpStatus === 'due_soon'
              ? 'border-l-4 border-l-amber-500'
              : 'border-l-4 border-l-emerald-600';

          return (
            <div
              key={veh.id}
              onClick={() => onSelectVehicle(veh.id)}
              className={`cursor-pointer p-5 rounded-xl border ${theme.borderSubtle} ${cardBorder} ${theme.bgSurface} hover:border-sky-500/50 transition space-y-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold font-mono tabular-nums ${theme.textPrimary}`}>
                      {veh.plateNumber}
                    </span>
                    <span className={`text-xs ${theme.textMuted}`}>·</span>
                    <span className={`text-sm font-medium ${theme.textSecondary}`}>
                      {veh.userName}
                    </span>
                  </div>
                  {veh.vinNumber && (
                    <div className={`text-[11px] font-mono ${theme.textSecondary} mt-0.5`}>
                      VIN: {veh.vinNumber}
                    </div>
                  )}
                  <div className={`text-xs ${theme.textMuted} mt-0.5`}>
                    {veh.makeModel}
                  </div>
                </div>

                <div className="text-right font-mono tabular-nums">
                  <div
                    className={`text-xs font-bold ${
                      itpStatus === 'overdue'
                        ? 'text-red-600 dark:text-red-400'
                        : itpStatus === 'due_soon'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    ITP: {veh.itpExpiryDate}
                  </div>
                  <div className={`text-[11px] ${theme.textMuted}`}>
                    {itpDays < 0
                      ? `${Math.abs(itpDays)} ${t.daysOverdue}`
                      : `${itpDays} ${t.daysRemaining}`}
                  </div>
                </div>
              </div>

              {/* Mini Summary of the 5 Country Vignettes */}
              <div className={`pt-3 border-t ${theme.borderSubtle}`}>
                <div className={`text-[11px] ${theme.textMuted} mb-2`}>
                  Viniete (RO · HU · SK · CZ · AT):
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {veh.vignettes.map((vg) => {
                    const isActive = vg.active !== false;
                    const st = getInspectionStatus(vg.expiryDate);
                    const days = getDaysRemaining(vg.expiryDate);
                    return (
                      <div
                        key={vg.country}
                        className={`p-1.5 rounded border ${theme.borderSubtle} ${theme.bgElevated} text-center ${
                          !isActive ? 'opacity-50' : ''
                        }`}
                      >
                        <div className={`text-[10px] font-semibold ${theme.textSecondary} truncate`}>
                          {vg.country}
                        </div>
                        {isActive ? (
                          <div
                            className={`text-[10px] font-mono font-bold tabular-nums ${
                              st === 'overdue'
                                ? 'text-red-500'
                                : st === 'due_soon'
                                ? 'text-amber-500'
                                : 'text-emerald-500'
                            }`}
                          >
                            {days}z
                          </div>
                        ) : (
                          <div className={`text-[10px] font-mono ${theme.textMuted}`}>
                            Oprită
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
