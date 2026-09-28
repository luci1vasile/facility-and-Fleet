import React, { useState, useMemo } from 'react';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  Plus,
  Wrench,
  RotateCcw,
  Search,
} from 'lucide-react';
import { BuildingMaintenanceItem, Language } from '../types';
import { ThemeDefinition, TRANSLATIONS } from '../i18n';
import {
  calculateCombinedExpiryDate,
  formatDateDisplay,
  formatTodayISO,
  getDaysRemaining,
  getInspectionStatus,
} from '../utils/dateUtils';

interface Props {
  items: BuildingMaintenanceItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string | null) => void;
  onBackToDashboard?: () => void;
  onRenewItem: (
    id: string,
    baseDate: string,
    newExpiryDate: string,
    periodLabel: string,
    assignedProvider?: string,
    notes?: string
  ) => void;
  onOpenAddModal: () => void;
  lang: Language;
  theme: ThemeDefinition;
}

export const BuildingMaintenanceView: React.FC<Props> = ({
  items,
  selectedItemId,
  onSelectItem,
  onBackToDashboard,
  onRenewItem,
  onOpenAddModal,
  lang,
  theme,
}) => {
  const t = TRANSLATIONS[lang];
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'overdue' | 'due_soon' | 'ok'>('all');

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) || null,
    [items, selectedItemId]
  );

  // State for the dedicated subcategory page renewal calculator
  const [baseDate, setBaseDate] = useState<string>(formatTodayISO());
  const [years, setYears] = useState<number>(0);
  const [months, setMonths] = useState<number>(6);
  const [weeks, setWeeks] = useState<number>(0);
  const [days, setDays] = useState<number>(0);
  const [notesInput, setNotesInput] = useState<string>('');
  const [savedBanner, setSavedBanner] = useState<boolean>(false);

  React.useEffect(() => {
    if (selectedItem) {
      setBaseDate(formatTodayISO());
      setYears(0);
      setMonths(6);
      setWeeks(0);
      setDays(0);
      setNotesInput(selectedItem.notes || '');
      setSavedBanner(false);
    }
  }, [selectedItem]);

  const calculatedExpiry = useMemo(() => {
    return calculateCombinedExpiryDate(baseDate, years, months, weeks, days);
  }, [baseDate, years, months, weeks, days]);

  const combinedPeriodSummary = useMemo(() => {
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} ${t.years.toLowerCase()}`);
    if (months > 0) parts.push(`${months} ${t.months.toLowerCase()}`);
    if (weeks > 0) parts.push(`${weeks} ${t.weeks.toLowerCase()}`);
    if (days > 0) parts.push(`${days} ${t.days.toLowerCase()}`);
    return parts.length > 0 ? parts.join(' + ') : `0 ${t.days.toLowerCase()}`;
  }, [years, months, weeks, days, t]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const st = getInspectionStatus(item.expiryDate);
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (
        searchQuery.trim() &&
        !item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !item.code.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [items, statusFilter, searchQuery]);

  // Dedicated Page for a selected Building Maintenance Subcategory
  if (selectedItem) {
    const daysLeft = getDaysRemaining(selectedItem.expiryDate);
    const status = getInspectionStatus(selectedItem.expiryDate);
    const newDaysLeft = getDaysRemaining(calculatedExpiry);

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectItem(null)}
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

          <div className={`text-xs ${theme.textMuted} tabular-nums`}>
            <span>{selectedItem.code}</span>
            <span className="mx-2">·</span>
            <span>{t.navBuilding}</span>
          </div>
        </div>

        {/* Subcategory Header & Current Status */}
        <div
          className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} space-y-6`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5 border-slate-200/60 dark:border-slate-800">
            <div className="space-y-1">
              <div className={`text-xs font-medium ${theme.textMuted}`}>
                {t.navBuilding} · Subcategorie
              </div>
              <h2 className={`text-2xl font-bold ${theme.textPrimary}`}>
                {selectedItem.name}
              </h2>
            </div>

            {/* Current Expiration Box */}
            <div
              className={`flex items-center gap-4 px-5 py-3.5 rounded-xl border ${
                status === 'overdue'
                  ? 'bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400'
                  : status === 'due_soon'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {status === 'overdue' ? (
                <AlertTriangle className="w-7 h-7 shrink-0" />
              ) : status === 'due_soon' ? (
                <Clock className="w-7 h-7 shrink-0" />
              ) : (
                <CheckCircle2 className="w-7 h-7 shrink-0" />
              )}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider">
                  {status === 'overdue'
                    ? t.overdue
                    : status === 'due_soon'
                    ? t.dueSoon
                    : t.ok}{' '}
                  · {t.expiryDate}
                </div>
                <div className="text-xl font-bold font-mono tabular-nums">
                  {selectedItem.expiryDate} ({formatDateDisplay(selectedItem.expiryDate, lang)})
                </div>
                <div className="text-xs font-mono tabular-nums mt-0.5">
                  {daysLeft < 0
                    ? `${Math.abs(daysLeft)} ${t.daysOverdue}`
                    : daysLeft === 0
                    ? t.expiresToday
                    : `${daysLeft} ${t.daysRemaining}`}
                </div>
              </div>
            </div>
          </div>

          {/* Calendar & Combinable Period Renewal Calculator */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-5">
              <h3 className={`text-base font-semibold ${theme.textPrimary} flex items-center gap-2`}>
                <Calendar className="w-4 h-4 text-sky-500" />
                <span>{t.selectRenewalDate}</span>
              </h3>

              <div>
                <label className={`block text-xs font-medium ${theme.textSecondary} mb-1.5`}>
                  Dată Calendar (Start / Reînnoire)
                </label>
                <input
                  type="date"
                  value={baseDate}
                  onChange={(e) => setBaseDate(e.target.value)}
                  className={`w-full sm:max-w-xs px-3.5 py-2.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500`}
                />
              </div>

              {/* Combinable Period Selectors: Years + Months + Weeks + Days */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className={`text-xs font-semibold ${theme.textSecondary}`}>
                    {t.combinePeriods}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setYears(0);
                      setMonths(0);
                      setWeeks(0);
                      setDays(0);
                    }}
                    className={`inline-flex items-center gap-1 text-xs ${theme.textMuted} hover:underline`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset (0)
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Years */}
                  <div className={`p-3 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated}`}>
                    <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                      {t.years} (0–10)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={years}
                      onChange={(e) => setYears(Math.max(0, parseInt(e.target.value || '0', 10)))}
                      className={`w-full px-2.5 py-1.5 rounded border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} font-mono text-base font-bold tabular-nums`}
                    />
                  </div>

                  {/* Months */}
                  <div className={`p-3 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated}`}>
                    <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                      {t.months} (0–24)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={months}
                      onChange={(e) => setMonths(Math.max(0, parseInt(e.target.value || '0', 10)))}
                      className={`w-full px-2.5 py-1.5 rounded border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} font-mono text-base font-bold tabular-nums`}
                    />
                  </div>

                  {/* Weeks */}
                  <div className={`p-3 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated}`}>
                    <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                      {t.weeks} (0–52)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={52}
                      value={weeks}
                      onChange={(e) => setWeeks(Math.max(0, parseInt(e.target.value || '0', 10)))}
                      className={`w-full px-2.5 py-1.5 rounded border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} font-mono text-base font-bold tabular-nums`}
                    />
                  </div>

                  {/* Days */}
                  <div className={`p-3 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated}`}>
                    <label className={`block text-xs font-medium ${theme.textMuted} mb-1`}>
                      {t.days} (0–365)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={days}
                      onChange={(e) => setDays(Math.max(0, parseInt(e.target.value || '0', 10)))}
                      className={`w-full px-2.5 py-1.5 rounded border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} font-mono text-base font-bold tabular-nums`}
                    />
                  </div>
                </div>

                {/* Quick Preset Combinations */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className={`text-xs ${theme.textMuted}`}>Presetări rapide:</span>
                  {[
                    { label: '1 Lună', y: 0, m: 1, w: 0, d: 0 },
                    { label: '3 Luni', y: 0, m: 3, w: 0, d: 0 },
                    { label: '6 Luni', y: 0, m: 6, w: 0, d: 0 },
                    { label: '1 An', y: 1, m: 0, w: 0, d: 0 },
                    { label: '1 An + 6 Luni', y: 1, m: 6, w: 0, d: 0 },
                    { label: '2 Ani + 2 Săpt.', y: 2, m: 0, w: 2, d: 0 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setYears(preset.y);
                        setMonths(preset.m);
                        setWeeks(preset.w);
                        setDays(preset.d);
                      }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textSecondary} hover:opacity-80 transition`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${theme.textSecondary} mb-1.5`}>
                  Observații / Detalii Intervenție
                </label>
                <input
                  type="text"
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  className={`w-full px-3.5 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm`}
                />
              </div>
            </div>

            {/* Automatic Calculation Result & Save Box */}
            <div className="lg:col-span-5 flex flex-col justify-between p-5 rounded-xl border border-sky-500/30 bg-sky-500/5 space-y-4">
              <div className="space-y-3">
                <div className="text-xs font-semibold uppercase tracking-wider text-sky-500">
                  {t.calculatedNewExpiry}
                </div>
                <div className={`text-3xl font-bold font-mono tabular-nums ${theme.textPrimary}`}>
                  {calculatedExpiry}
                </div>
                <div className={`text-sm ${theme.textSecondary}`}>
                  {formatDateDisplay(calculatedExpiry, lang)} ·{' '}
                  <span className="font-mono font-semibold text-emerald-500">
                    +{newDaysLeft} {t.daysRemaining}
                  </span>
                </div>

                <div className={`pt-3 border-t ${theme.borderSubtle} text-xs space-y-1.5 ${theme.textSecondary}`}>
                  <div className="flex justify-between">
                    <span>Dată de bază selectată:</span>
                    <span className="font-mono font-semibold">{baseDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Perioadă combinată:</span>
                    <span className="font-mono font-semibold">{combinedPeriodSummary}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    onRenewItem(
                      selectedItem.id,
                      baseDate,
                      calculatedExpiry,
                      combinedPeriodSummary,
                      undefined,
                      notesInput
                    );
                    setSavedBanner(true);
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-sm text-white ${theme.accentBg} shadow-sm transition flex items-center justify-center gap-2`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t.saveRenewal}</span>
                </button>

                {savedBanner && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 text-xs font-medium text-center">
                    Termenul de expirare a fost actualizat la {calculatedExpiry}!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Renewal History */}
          {selectedItem.history && selectedItem.history.length > 0 && (
            <div className={`pt-5 border-t ${theme.borderSubtle} space-y-3`}>
              <h4 className={`text-xs font-semibold uppercase tracking-wider ${theme.textMuted}`}>
                Istoric Reînnoiri Subcategorie
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className={`border-b ${theme.borderSubtle} ${theme.textMuted}`}>
                      <th className="py-2 pr-4">Dată Operare</th>
                      <th className="py-2 pr-4">Dată Calendar Aleasă</th>
                      <th className="py-2 pr-4">Perioadă Combinată</th>
                      <th className="py-2">Noua Dată de Expirare</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/60 font-mono tabular-nums">
                    {selectedItem.history.map((h) => (
                      <tr key={h.id} className={theme.textSecondary}>
                        <td className="py-2 pr-4">{h.renewedAt}</td>
                        <td className="py-2 pr-4">{h.baseDate}</td>
                        <td className="py-2 pr-4 font-sans">{h.periodLabel}</td>
                        <td className="py-2 font-semibold text-emerald-500">{h.newExpiryDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Overview Grid of all 27+ Building Maintenance Subcategories
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${theme.textPrimary} flex items-center gap-2.5`}>
            <Building2 className="w-6 h-6 text-sky-500" />
            <span>{t.navBuilding} ({items.length} Subcategorii)</span>
          </h2>
          <p className={`text-xs ${theme.textMuted} mt-0.5`}>
            Selectați orice subcategorie pentru a deschide pagina proprie cu calculatorul de reînnoire (Ani + Luni + Săptămâni + Zile).
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddModal}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white ${theme.accentBg} shadow-sm transition whitespace-nowrap`}
        >
          <Plus className="w-4 h-4" />
          <span>{t.addBuildingItem}</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className={`w-full pl-10 pr-4 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} text-sm focus:outline-none focus:ring-2 focus:ring-sky-500`}
          />
        </div>

        <div className={`flex items-center gap-1 p-1 rounded-lg border ${theme.borderSubtle} ${theme.bgSurface}`}>
          {(
            [
              { id: 'all', label: `${t.statusFilterAll} (${items.length})` },
              {
                id: 'overdue',
                label: `${t.overdue} (${items.filter((i) => getInspectionStatus(i.expiryDate) === 'overdue').length})`,
              },
              {
                id: 'due_soon',
                label: `${t.dueSoon} (${items.filter((i) => getInspectionStatus(i.expiryDate) === 'due_soon').length})`,
              },
              {
                id: 'ok',
                label: `${t.ok} (${items.filter((i) => getInspectionStatus(i.expiryDate) === 'ok').length})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? `${theme.accentBg} text-white`
                  : `${theme.textSecondary} hover:opacity-80`
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Subcategories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const daysLeft = getDaysRemaining(item.expiryDate);
          const status = getInspectionStatus(item.expiryDate);

          const borderAccent =
            status === 'overdue'
              ? 'border-l-4 border-l-red-600'
              : status === 'due_soon'
              ? 'border-l-4 border-l-amber-500'
              : 'border-l-4 border-l-emerald-600';

          const statusColorText =
            status === 'overdue'
              ? 'text-red-600 dark:text-red-400'
              : status === 'due_soon'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400';

          return (
            <div
              key={item.id}
              onClick={() => onSelectItem(item.id)}
              className={`cursor-pointer p-4 rounded-xl border ${theme.borderSubtle} ${borderAccent} ${theme.bgSurface} hover:border-sky-500/50 transition flex flex-col justify-between gap-3`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs font-mono tabular-nums">
                  <span className={theme.textMuted}>
                    {item.code} · {item.lastPeriodLabel}
                  </span>
                  <span className={`font-bold ${statusColorText}`}>
                    {status === 'overdue'
                      ? `● ${t.overdue}`
                      : status === 'due_soon'
                      ? `● ${t.dueSoon}`
                      : `● ${t.ok}`}
                  </span>
                </div>

                <h3 className={`text-base font-bold ${theme.textPrimary} flex items-center gap-2`}>
                  <Wrench className="w-4 h-4 text-sky-500 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </h3>

                <div className={`text-xs ${theme.textMuted} truncate`}>
                  Furnizor: {item.assignedProvider || 'Standard'}
                </div>
              </div>

              <div className={`pt-3 border-t ${theme.borderSubtle} flex items-center justify-between`}>
                <div>
                  <div className={`text-[11px] ${theme.textMuted}`}>{t.expiryDate}</div>
                  <div className={`text-sm font-bold font-mono tabular-nums ${theme.textPrimary}`}>
                    {item.expiryDate}
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-xs font-mono font-semibold tabular-nums ${statusColorText}`}>
                    {daysLeft < 0
                      ? `${Math.abs(daysLeft)} ${t.daysOverdue}`
                      : daysLeft === 0
                      ? t.expiresToday
                      : `${daysLeft} ${t.daysRemaining}`}
                  </div>
                  <span className="text-xs font-semibold text-sky-500 hover:underline">
                    {t.viewDetails} →
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
