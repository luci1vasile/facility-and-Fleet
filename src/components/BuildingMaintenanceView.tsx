import React, { useState, useMemo } from 'react';
import {
  Building2,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Plus,
  Wrench,
  RotateCcw,
  Search,
  History,
  FileText,
  Copy,
  Check,
  LayoutList,
  Table as TableIcon,
  ShieldCheck,
  Filter,
  X,
} from 'lucide-react';
import { BuildingMaintenanceItem, Language, ServiceProvider } from '../types';
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
  providers?: ServiceProvider[];
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
  providers = [],
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

  // State for the dedicated subcategory page renewal calculator & direct manual expiry input
  const [baseDate, setBaseDate] = useState<string>(formatTodayISO());
  const [years, setYears] = useState<number>(0);
  const [months, setMonths] = useState<number>(6);
  const [weeks, setWeeks] = useState<number>(0);
  const [days, setDays] = useState<number>(0);
  const [manualExpiryOverride, setManualExpiryOverride] = useState<string | null>(
    null
  );
  const [providerInput, setProviderInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [savedBanner, setSavedBanner] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [historyViewMode, setHistoryViewMode] = useState<'timeline' | 'table'>('timeline');
  const [copiedRecordId, setCopiedRecordId] = useState<string | null>(null);
  const [copiedAllHistory, setCopiedAllHistory] = useState<boolean>(false);

  React.useEffect(() => {
    if (selectedItem) {
      setBaseDate(formatTodayISO());
      setYears(0);
      setMonths(6);
      setWeeks(0);
      setDays(0);
      setManualExpiryOverride(null);
      setNotesInput(selectedItem.notes || '');
      setProviderInput(selectedItem.assignedProvider || '');
      setSavedBanner(false);
      setHistorySearchQuery('');
      setCopiedRecordId(null);
      setCopiedAllHistory(false);
    }
  }, [selectedItem]);

  const calculatedExpiry = useMemo(() => {
    if (manualExpiryOverride) return manualExpiryOverride;
    return calculateCombinedExpiryDate(baseDate, years, months, weeks, days);
  }, [baseDate, years, months, weeks, days, manualExpiryOverride]);

  const combinedPeriodSummary = useMemo(() => {
    if (manualExpiryOverride) return 'Setat Manual';
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} ${t.years.toLowerCase()}`);
    if (months > 0) parts.push(`${months} ${t.months.toLowerCase()}`);
    if (weeks > 0) parts.push(`${weeks} ${t.weeks.toLowerCase()}`);
    if (days > 0) parts.push(`${days} ${t.days.toLowerCase()}`);
    return parts.length > 0 ? parts.join(' + ') : `0 ${t.days.toLowerCase()}`;
  }, [years, months, weeks, days, t, manualExpiryOverride]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const hasDate = Boolean(item.expiryDate && item.expiryDate.trim());
      if (statusFilter !== 'all') {
        if (!hasDate) return false;
        const st = getInspectionStatus(item.expiryDate);
        if (st !== statusFilter) return false;
      }
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
    const hasExpiryDate = Boolean(
      selectedItem.expiryDate && selectedItem.expiryDate.trim()
    );
    const daysLeft = hasExpiryDate ? getDaysRemaining(selectedItem.expiryDate) : 0;
    const status = hasExpiryDate
      ? getInspectionStatus(selectedItem.expiryDate)
      : null;
    const newDaysLeft = getDaysRemaining(calculatedExpiry);

    const historyList = selectedItem.history || [];
    const filteredHistory = historyList.filter((h) => {
      if (!historySearchQuery.trim()) return true;
      const q = historySearchQuery.toLowerCase();
      return (
        (h.renewedAt && h.renewedAt.toLowerCase().includes(q)) ||
        (h.baseDate && h.baseDate.toLowerCase().includes(q)) ||
        (h.periodLabel && h.periodLabel.toLowerCase().includes(q)) ||
        (h.newExpiryDate && h.newExpiryDate.toLowerCase().includes(q)) ||
        (h.previousExpiryDate && h.previousExpiryDate.toLowerCase().includes(q)) ||
        (h.assignedProvider && h.assignedProvider.toLowerCase().includes(q)) ||
        (h.notes && h.notes.toLowerCase().includes(q))
      );
    });

    const handleCopyHistory = () => {
      if (!historyList || historyList.length === 0) return;
      const text = [
        `=== ISTORIC REÎNNOIRI MENTENANȚĂ: ${selectedItem.name} (${selectedItem.code}) ===`,
        `Termen curent expirare: ${selectedItem.expiryDate || 'Nesetat'}`,
        `Furnizor curent: ${selectedItem.assignedProvider || 'Nespecificat'}`,
        `Total înregistrări: ${historyList.length}`,
        '',
        ...historyList.map((h, i) => {
          return [
            `#${historyList.length - i} [Operat: ${h.renewedAt}]`,
            `  - Dată referință calendar: ${h.baseDate}`,
            `  - Perioadă adăugată: ${h.periodLabel}`,
            `  - Termen anterior: ${h.previousExpiryDate || 'Nesetat / Inițial'}`,
            `  - Noua dată de expirare: ${h.newExpiryDate}`,
            `  - Furnizor asociat: ${h.assignedProvider || selectedItem.assignedProvider || '-'}`,
            `  - Observații: ${h.notes || '-'}`,
          ].join('\n');
        }),
      ].join('\n');

      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        setCopiedAllHistory(true);
        setTimeout(() => setCopiedAllHistory(false), 2000);
      }
    };

    const handleCopyRecord = (record: any, index: number) => {
      const text = [
        `Reînnoire #${historyList.length - index} [${record.renewedAt}] - ${selectedItem.name}`,
        `Dată bază calendar: ${record.baseDate}`,
        `Perioadă: ${record.periodLabel}`,
        `Termen anterior: ${record.previousExpiryDate || 'Nesetat / Inițial'} -> Expirare nouă: ${record.newExpiryDate}`,
        `Furnizor: ${record.assignedProvider || selectedItem.assignedProvider || '-'}`,
        `Observații: ${record.notes || '-'}`,
      ].join('\n');

      if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
        setCopiedRecordId(record.id);
        setTimeout(() => setCopiedRecordId(null), 2000);
      }
    };

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
                !hasExpiryDate
                  ? `${theme.borderSubtle} ${theme.bgElevated} ${theme.textSecondary}`
                  : status === 'overdue'
                  ? 'bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400'
                  : status === 'due_soon'
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                  : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {!hasExpiryDate ? (
                <Calendar className="w-7 h-7 shrink-0 text-sky-500" />
              ) : status === 'overdue' ? (
                <AlertTriangle className="w-7 h-7 shrink-0" />
              ) : status === 'due_soon' ? (
                <Clock className="w-7 h-7 shrink-0" />
              ) : (
                <CheckCircle2 className="w-7 h-7 shrink-0" />
              )}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider">
                  {!hasExpiryDate
                    ? 'NESETAT'
                    : status === 'overdue'
                    ? t.overdue
                    : status === 'due_soon'
                    ? t.dueSoon
                    : t.ok}{' '}
                  · {t.expiryDate}
                </div>
                <div className="text-xl font-bold font-mono tabular-nums">
                  {hasExpiryDate
                    ? `${selectedItem.expiryDate} (${formatDateDisplay(selectedItem.expiryDate, lang)})`
                    : 'Nesetat — Adăugați manual data mai jos'}
                </div>
                {hasExpiryDate && (
                  <div className="text-xs font-mono tabular-nums mt-0.5">
                    {daysLeft < 0
                      ? `${Math.abs(daysLeft)} ${t.daysOverdue}`
                      : daysLeft === 0
                      ? t.expiresToday
                      : `${daysLeft} ${t.daysRemaining}`}
                  </div>
                )}
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={`block text-xs font-medium ${theme.textSecondary} mb-1.5`}>
                    Dată Calendar (Start / Reînnoire)
                  </label>
                  <input
                    type="date"
                    value={baseDate}
                    onChange={(e) => {
                      setBaseDate(e.target.value);
                      setManualExpiryOverride(null);
                    }}
                    className={`w-full px-3.5 py-2.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} font-mono text-sm focus:outline-none focus:ring-2 focus:ring-sky-500`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium text-sky-500 mb-1.5`}>
                    Setare Directă Dată Expirare (Manual)
                  </label>
                  <input
                    type="date"
                    value={calculatedExpiry}
                    onChange={(e) => setManualExpiryOverride(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-lg border border-sky-500/50 ${theme.bgElevated} ${theme.textPrimary} font-mono text-sm font-bold focus:outline-none focus:ring-2 focus:ring-sky-500`}
                  />
                </div>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={`text-xs font-semibold ${theme.textSecondary} flex items-center gap-1.5`}>
                      <Wrench className="w-3.5 h-3.5 text-sky-500" />
                      <span>Prestator / Furnizor Asociat</span>
                    </label>
                    {providerInput && (
                      <button
                        type="button"
                        onClick={() => setProviderInput('')}
                        className="text-[11px] text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Lasă rubrica complet goală"
                      >
                        <X className="w-3 h-3" />
                        <span>Lasă complet gol</span>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {/* Selectare din lista de furnizori */}
                    <div className="relative">
                      <select
                        value={
                          providers.some((p) => p.name === providerInput)
                            ? providerInput
                            : providerInput.trim() === ''
                            ? ''
                            : '__manual__'
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__manual__') {
                            // User keeps manual text
                          } else {
                            setProviderInput(val);
                          }
                        }}
                        className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-xs focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer`}
                      >
                        <option value="">— Fără prestator (Rubrică lăsată goală) —</option>
                        {providers.length > 0 && (
                          <optgroup label="Selectează din lista furnizorilor înregistrați:">
                            {providers.map((p) => (
                              <option key={p.id} value={p.name}>
                                {p.name} ({p.category})
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {providerInput && !providers.some((p) => p.name === providerInput) && (
                          <option value="__manual__">Manual: {providerInput}</option>
                        )}
                      </select>
                    </div>

                    {/* Introducere manuală sau posibilitate golire */}
                    <div className="relative">
                      <input
                        type="text"
                        value={providerInput}
                        onChange={(e) => setProviderInput(e.target.value)}
                        placeholder="Sau introduceți manual prestatorul (opțional)..."
                        className={`w-full pl-3 pr-8 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-xs focus:outline-none focus:ring-2 focus:ring-sky-500`}
                      />
                      {providerInput && (
                        <button
                          type="button"
                          onClick={() => setProviderInput('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 p-0.5 cursor-pointer"
                          title="Golește rubrica"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-medium ${theme.textSecondary} mb-1.5 flex items-center gap-1.5`}>
                    <FileText className="w-3.5 h-3.5 text-sky-500" />
                    <span>Observații / Detalii Intervenție</span>
                  </label>
                  <input
                    type="text"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="ex: Revizie completă, verificare filtre, buletin măsurare..."
                    className={`w-full px-3.5 py-2.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm focus:outline-none focus:ring-2 focus:ring-sky-500`}
                  />
                </div>
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
                  <div className="flex justify-between">
                    <span>Furnizor înregistrat:</span>
                    <span className="font-mono font-semibold truncate max-w-[170px]">
                      {providerInput.trim() ? providerInput.trim() : 'Fără furnizor (Gol)'}
                    </span>
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
                      providerInput.trim(),
                      notesInput
                    );
                    setSavedBanner(true);
                  }}
                  className={`w-full py-3 px-4 rounded-xl font-semibold text-sm text-white ${theme.accentBg} shadow-sm transition flex items-center justify-center gap-2 cursor-pointer`}
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

          {/* Detailed Renewal History */}
          <div className={`pt-6 border-t ${theme.borderSubtle} space-y-5`}>
            {/* Header with Title, Badges, and Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
                    <History className="w-5 h-5" />
                  </div>
                  <h3 className={`text-base font-bold ${theme.textPrimary}`}>
                    Istoric Detaliat al Reînnoirilor
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/15 text-sky-500 font-mono">
                    {historyList.length} {historyList.length === 1 ? 'înregistrare' : 'înregistrări'}
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Search in History */}
                {historyList.length > 0 && (
                  <div className="relative">
                    <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
                    <input
                      type="text"
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      placeholder="Filtrează în istoric..."
                      className={`pl-8 pr-3 py-1.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-xs focus:outline-none focus:ring-1 focus:ring-sky-500 w-44`}
                    />
                  </div>
                )}

                {/* View Switcher: Timeline vs Table */}
                {historyList.length > 0 && (
                  <div className={`flex items-center p-0.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated}`}>
                    <button
                      type="button"
                      onClick={() => setHistoryViewMode('timeline')}
                      title="Vedere Cronologică (Carduri Timeline)"
                      className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                        historyViewMode === 'timeline'
                          ? `${theme.accentBg} text-white shadow-xs`
                          : `${theme.textSecondary} hover:opacity-80`
                      }`}
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                      <span>Cronologic</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryViewMode('table')}
                      title="Vedere Tabelară Tehnică"
                      className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                        historyViewMode === 'table'
                          ? `${theme.accentBg} text-white shadow-xs`
                          : `${theme.textSecondary} hover:opacity-80`
                      }`}
                    >
                      <TableIcon className="w-3.5 h-3.5" />
                      <span>Tabel</span>
                    </button>
                  </div>
                )}

                {/* Copy All History */}
                {historyList.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyHistory}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textSecondary} text-xs font-medium hover:opacity-80 transition`}
                  >
                    {copiedAllHistory ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-emerald-500 font-semibold">Copiat!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-sky-500" />
                        <span>Copiază Rezumat</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar if History Exists */}
            {historyList.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-3 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated}`}>
                  <div className={`text-[11px] font-medium ${theme.textMuted}`}>Total Reînnoiri</div>
                  <div className={`text-lg font-bold font-mono ${theme.textPrimary}`}>
                    {historyList.length}
                  </div>
                  <div className={`text-[11px] ${theme.textSecondary}`}>
                    intervenții consemnate
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated}`}>
                  <div className={`text-[11px] font-medium ${theme.textMuted}`}>Ultima Operare</div>
                  <div className={`text-sm font-bold font-mono ${theme.textPrimary} truncate`}>
                    {historyList[0]?.renewedAt || selectedItem.lastRenewedDate || '-'}
                  </div>
                  <div className={`text-[11px] ${theme.textSecondary}`}>
                    {historyList[0]?.renewedAt ? formatDateDisplay(historyList[0].renewedAt, lang) : '-'}
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated}`}>
                  <div className={`text-[11px] font-medium ${theme.textMuted}`}>Expirare Generată</div>
                  <div className="text-sm font-bold font-mono text-emerald-500 truncate">
                    {historyList[0]?.newExpiryDate || selectedItem.expiryDate || 'Nesetat'}
                  </div>
                  <div className={`text-[11px] ${theme.textSecondary}`}>
                    termen actual în vigoare
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated}`}>
                  <div className={`text-[11px] font-medium ${theme.textMuted}`}>Prestator Responsabil</div>
                  <div className={`text-sm font-bold truncate ${theme.textPrimary}`}>
                    {historyList[0]?.assignedProvider || selectedItem.assignedProvider || 'Fără prestator'}
                  </div>
                  <div className={`text-[11px] ${theme.textSecondary}`}>
                    furnizor asociat
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {historyList.length === 0 && (
              <div className={`p-8 rounded-xl border border-dashed ${theme.borderSubtle} ${theme.bgElevated} text-center space-y-3`}>
                <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-500 mx-auto flex items-center justify-center">
                  <History className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-md mx-auto">
                  <h4 className={`text-sm font-bold ${theme.textPrimary}`}>
                    Nu există încă reînnoiri consemnate în istoric
                  </h4>
                </div>
              </div>
            )}

            {/* No matches for search */}
            {historyList.length > 0 && filteredHistory.length === 0 && (
              <div className={`p-6 rounded-xl border ${theme.borderSubtle} ${theme.bgElevated} text-center space-y-2`}>
                <div className={`text-sm font-semibold ${theme.textPrimary}`}>
                  Nicio înregistrare nu corespunde termenului „{historySearchQuery}”
                </div>
                <button
                  type="button"
                  onClick={() => setHistorySearchQuery('')}
                  className="text-xs text-sky-500 hover:underline font-medium"
                >
                  Șterge filtrul de căutare
                </button>
              </div>
            )}

            {/* Timeline View */}
            {historyList.length > 0 && filteredHistory.length > 0 && historyViewMode === 'timeline' && (
              <div className="relative pl-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-300 dark:before:bg-slate-800 space-y-4">
                {filteredHistory.map((h, idx) => {
                  const isLatest = idx === 0 && !historySearchQuery.trim();
                  const recordNumber = historyList.length - idx;
                  const isCopied = copiedRecordId === h.id;

                  return (
                    <div key={h.id || idx} className="relative group">
                      {/* Timeline Node Icon */}
                      <div
                        className={`absolute -left-6 top-4 w-5 h-5 rounded-full border-2 flex items-center justify-center shadow-xs ${
                          isLatest
                            ? 'bg-sky-500 border-white dark:border-slate-900 text-white ring-4 ring-sky-500/20'
                            : `bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-500`
                        }`}
                      >
                        <div className={`w-2 h-2 rounded-full ${isLatest ? 'bg-white' : 'bg-slate-400'}`} />
                      </div>

                      {/* Card Content */}
                      <div
                        className={`p-4 rounded-xl border transition ${
                          isLatest
                            ? `border-sky-500/40 bg-sky-500/5 shadow-xs`
                            : `${theme.borderSubtle} ${theme.bgElevated}`
                        }`}
                      >
                        {/* Top Header of Card */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 border-slate-200/60 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              #{recordNumber}
                            </span>
                            {isLatest && (
                              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                Reînnoire Activă / Curentă
                              </span>
                            )}
                            <span className={`text-xs font-mono tabular-nums ${theme.textSecondary} flex items-center gap-1.5`}>
                              <CalendarCheck className="w-3.5 h-3.5 text-sky-500" />
                              <strong className={theme.textPrimary}>{h.renewedAt}</strong>
                              <span className="text-slate-400">({formatDateDisplay(h.renewedAt, lang)})</span>
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyRecord(h, idx)}
                            title="Copiază detaliile acestei intervenții"
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium ${theme.textMuted} hover:${theme.textPrimary} hover:bg-slate-500/10 transition`}
                          >
                            {isCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="text-emerald-500">Copiat</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copiază</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Expiration Transition Strip */}
                        <div className="py-3 flex flex-wrap items-center gap-3">
                          <span className={`text-xs font-medium ${theme.textMuted}`}>
                            Evoluție Termen Expirare:
                          </span>
                          {h.previousExpiryDate ? (
                            <div className="inline-flex items-center gap-2 font-mono tabular-nums text-xs">
                              <span className="px-2 py-1 rounded bg-slate-200/50 dark:bg-slate-800/80 text-slate-500 line-through">
                                {h.previousExpiryDate}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-sky-500" />
                              <span className="px-2.5 py-1 rounded font-bold bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                                {h.newExpiryDate}
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 font-mono tabular-nums text-xs font-bold px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-500 border border-emerald-500/30">
                              <span>Termen Inițial / Stabilit:</span>
                              <span>{h.newExpiryDate}</span>
                            </div>
                          )}
                        </div>

                        {/* Attributes Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                          {/* Base Date */}
                          <div className={`p-2.5 rounded-lg border ${theme.borderSubtle} bg-slate-500/5 space-y-0.5`}>
                            <div className={`text-[11px] font-medium ${theme.textMuted}`}>
                              Dată Referință (Calendar)
                            </div>
                            <div className={`font-mono font-semibold tabular-nums ${theme.textPrimary}`}>
                              {h.baseDate}
                            </div>
                          </div>

                          {/* Period */}
                          <div className={`p-2.5 rounded-lg border ${theme.borderSubtle} bg-slate-500/5 space-y-0.5`}>
                            <div className={`text-[11px] font-medium ${theme.textMuted}`}>
                              Perioadă Prelungită
                            </div>
                            <div className="font-semibold text-sky-500">
                              {h.periodLabel}
                            </div>
                          </div>

                          {/* Provider */}
                          <div className={`p-2.5 rounded-lg border ${theme.borderSubtle} bg-slate-500/5 space-y-0.5`}>
                            <div className={`text-[11px] font-medium ${theme.textMuted}`}>
                              Furnizor / Prestator
                            </div>
                            <div className={`font-semibold flex items-center gap-1 truncate ${theme.textPrimary}`}>
                              <Wrench className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                              <span className="truncate">
                                {h.assignedProvider || selectedItem.assignedProvider || 'Fără prestator'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Notes if available */}
                        {h.notes && (
                          <div className="mt-3 p-3 rounded-lg bg-slate-500/10 border border-slate-500/20 text-xs space-y-1">
                            <div className={`font-semibold ${theme.textSecondary} flex items-center gap-1.5`}>
                              <FileText className="w-3.5 h-3.5 text-sky-500" />
                              <span>Observații & Detalii Consemnate la Intervenție:</span>
                            </div>
                            <p className={`${theme.textPrimary} italic pl-5`}>
                              „{h.notes}”
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Table View */}
            {historyList.length > 0 && filteredHistory.length > 0 && historyViewMode === 'table' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className={`border-b ${theme.borderSubtle} ${theme.bgElevated} ${theme.textMuted}`}>
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">#</th>
                      <th className="py-2.5 px-3 font-semibold">Dată Operare</th>
                      <th className="py-2.5 px-3 font-semibold">Dată Referință</th>
                      <th className="py-2.5 px-3 font-semibold">Perioadă</th>
                      <th className="py-2.5 px-3 font-semibold">Termen Anterior</th>
                      <th className="py-2.5 px-3 font-semibold">Noua Expirare</th>
                      <th className="py-2.5 px-3 font-semibold">Prestator / Furnizor</th>
                      <th className="py-2.5 px-3 font-semibold">Observații</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Copiază</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/60 font-mono tabular-nums">
                    {filteredHistory.map((h, idx) => {
                      const recordNumber = historyList.length - idx;
                      const isCopied = copiedRecordId === h.id;

                      return (
                        <tr
                          key={h.id || idx}
                          className={`${theme.textSecondary} hover:bg-slate-500/5 transition`}
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-500">#{recordNumber}</td>
                          <td className="py-2.5 px-3 font-semibold text-sky-500">{h.renewedAt}</td>
                          <td className="py-2.5 px-3">{h.baseDate}</td>
                          <td className="py-2.5 px-3 font-sans font-medium text-amber-500">{h.periodLabel}</td>
                          <td className="py-2.5 px-3 text-slate-400 line-through">
                            {h.previousExpiryDate || '-'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-emerald-500 bg-emerald-500/5">
                            {h.newExpiryDate}
                          </td>
                          <td className="py-2.5 px-3 font-sans truncate max-w-[150px]">
                            {h.assignedProvider || selectedItem.assignedProvider || '-'}
                          </td>
                          <td className="py-2.5 px-3 font-sans truncate max-w-[200px]" title={h.notes || ''}>
                            {h.notes || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleCopyRecord(h, idx)}
                              className={`p-1 rounded hover:bg-slate-500/10 ${theme.textMuted} hover:${theme.textPrimary}`}
                              title="Copiază înregistrare"
                            >
                              {isCopied ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
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
                label: `${t.overdue} (${items.filter((i) => i.expiryDate && getInspectionStatus(i.expiryDate) === 'overdue').length})`,
              },
              {
                id: 'due_soon',
                label: `${t.dueSoon} (${items.filter((i) => i.expiryDate && getInspectionStatus(i.expiryDate) === 'due_soon').length})`,
              },
              {
                id: 'ok',
                label: `${t.ok} (${items.filter((i) => i.expiryDate && getInspectionStatus(i.expiryDate) === 'ok').length})`,
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
          const hasDate = Boolean(item.expiryDate && item.expiryDate.trim());
          const daysLeft = hasDate ? getDaysRemaining(item.expiryDate) : 0;
          const status = hasDate ? getInspectionStatus(item.expiryDate) : null;

          const borderAccent = !hasDate
            ? 'border-l-4 border-l-slate-400 dark:border-l-slate-600'
            : status === 'overdue'
            ? 'border-l-4 border-l-red-600'
            : status === 'due_soon'
            ? 'border-l-4 border-l-amber-500'
            : 'border-l-4 border-l-emerald-600';

          const statusColorText = !hasDate
            ? theme.textMuted
            : status === 'overdue'
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
                    {item.code} · {item.lastPeriodLabel || 'Nesetat'}
                  </span>
                  <span className={`font-bold ${statusColorText}`}>
                    {!hasDate
                      ? '○ Nesetat'
                      : status === 'overdue'
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

                <div className={`text-xs ${theme.textMuted} flex items-center justify-between gap-2`}>
                  <span className="truncate">
                    {item.assignedProvider ? `Furnizor: ${item.assignedProvider}` : 'Fără furnizor asociat'}
                  </span>
                  {item.history && item.history.length > 0 && (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold font-mono bg-sky-500/10 text-sky-500 border border-sky-500/20">
                      {item.history.length} {item.history.length === 1 ? 'reînnoire' : 'reînnoiri'}
                    </span>
                  )}
                </div>
              </div>

              <div className={`pt-3 border-t ${theme.borderSubtle} flex items-center justify-between`}>
                <div>
                  <div className={`text-[11px] ${theme.textMuted}`}>{t.expiryDate}</div>
                  <div className={`text-sm font-bold font-mono tabular-nums ${hasDate ? theme.textPrimary : theme.textMuted}`}>
                    {hasDate ? item.expiryDate : 'Nesetat (Adaugă manual)'}
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-xs font-mono font-semibold tabular-nums ${statusColorText}`}>
                    {!hasDate
                      ? 'Adaugă dată'
                      : daysLeft < 0
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
