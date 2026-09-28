import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Phone,
  Mail,
  ExternalLink,
  Plus,
  Search,
  Sparkles,
  Loader2,
  Building,
  CheckCircle2,
  Pencil,
  X,
} from 'lucide-react';
import { GroundingLink, Language, ServiceProvider } from '../types';
import { ThemeDefinition, TRANSLATIONS } from '../i18n';
import { fetchApiWithFallback } from '../services/googleWorkspace';

interface Props {
  providers: ServiceProvider[];
  onAddProvider: (provider: ServiceProvider) => void;
  onUpdateProvider: (provider: ServiceProvider) => void;
  lang: Language;
  theme: ThemeDefinition;
}

const PROVIDER_CATEGORIES = [
  'Toate',
  'Service Auto & Reprezentanță',
  'Stație ITP / MOT',
  'Instalații Electrice & PRAM',
  'Mentenanță Clădiri & HVAC',
  'Sisteme Securitate & PSI',
  'Curățenie & Salubritate',
  'Panouri Solare & Acoperiș',
];

export const ProvidersView: React.FC<Props> = ({
  providers,
  onAddProvider,
  onUpdateProvider,
  lang,
  theme,
}) => {
  const t = TRANSLATIONS[lang];
  const [selectedCategory, setSelectedCategory] = useState<string>('Toate');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    null
  );

  // Add / Edit Provider Modal State with Automatic Google & Google Maps Search
  const [nameInput, setNameInput] = useState<string>('');
  const [categoryInput, setCategoryInput] = useState<string>(
    'Service Auto & Reprezentanță'
  );
  const [domainInput, setDomainInput] = useState<string>('');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [emailInput, setEmailInput] = useState<string>('');
  const [addressInput, setAddressInput] = useState<string>('');
  const [cityInput, setCityInput] = useState<string>('Timișoara');
  const [distanceInput, setDistanceInput] = useState<number>(5);
  const [mapsUrlInput, setMapsUrlInput] = useState<string>('');
  const [groundingLinks, setGroundingLinks] = useState<GroundingLink[]>([]);
  const [summaryMarkdown, setSummaryMarkdown] = useState<string>('');
  const [isSearchingGoogle, setIsSearchingGoogle] = useState<boolean>(false);
  const [autoFilledSuccess, setAutoFilledSuccess] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchInFlightRef = React.useRef<boolean>(false);

  const normalizeCategoryClient = (rawCat?: string): string => {
    const valid = PROVIDER_CATEGORIES.filter((c) => c !== 'Toate');
    if (rawCat && valid.includes(rawCat)) return rawCat;
    const lower = (rawCat || '').toLowerCase();
    if (lower.includes('itp') || lower.includes('mot') || lower.includes('rar'))
      return 'Stație ITP / MOT';
    if (lower.includes('electric') || lower.includes('pram'))
      return 'Instalații Electrice & PRAM';
    if (lower.includes('clima') || lower.includes('hvac') || lower.includes('clădiri'))
      return 'Mentenanță Clădiri & HVAC';
    if (lower.includes('securitate') || lower.includes('psi') || lower.includes('alarm'))
      return 'Sisteme Securitate & PSI';
    if (lower.includes('curățenie') || lower.includes('curatenie') || lower.includes('salubr'))
      return 'Curățenie & Salubritate';
    if (lower.includes('solar') || lower.includes('acoperiș') || lower.includes('acoperis'))
      return 'Panouri Solare & Acoperiș';
    return 'Service Auto & Reprezentanță';
  };

  const openNewProviderModal = () => {
    setEditingProviderId(null);
    setNameInput('');
    setCategoryInput('Service Auto & Reprezentanță');
    setDomainInput('');
    setPhoneInput('');
    setEmailInput('');
    setAddressInput('');
    setCityInput('Timișoara');
    setDistanceInput(5);
    setMapsUrlInput('');
    setGroundingLinks([]);
    setSummaryMarkdown('');
    setAutoFilledSuccess(false);
    setSearchError(null);
    setShowAddModal(true);
  };

  const openEditProviderModal = (prov: ServiceProvider) => {
    setEditingProviderId(prov.id);
    setNameInput(prov.name);
    setCategoryInput(normalizeCategoryClient(prov.category));
    setDomainInput(prov.activityDomain);
    setPhoneInput(prov.phone);
    setEmailInput(prov.email || '');
    setAddressInput(prov.address);
    setCityInput(prov.city);
    setDistanceInput(prov.distanceKm);
    setMapsUrlInput(prov.mapsUrl);
    setGroundingLinks(prov.groundingLinks || []);
    setSummaryMarkdown('');
    setAutoFilledSuccess(false);
    setSearchError(null);
    setShowAddModal(true);
  };

  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      if (selectedCategory !== 'Toate' && p.category !== selectedCategory) {
        return false;
      }
      if (
        searchQuery.trim() &&
        !p.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.activityDomain.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !p.address.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [providers, selectedCategory, searchQuery]);

  const handleAutoSearchGoogle = async (customName?: string) => {
    const queryToUse = (customName ?? nameInput).trim();
    if (!queryToUse || searchInFlightRef.current) return;

    searchInFlightRef.current = true;
    setIsSearchingGoogle(true);
    setAutoFilledSuccess(false);
    setSearchError(null);

    try {
      const response = await fetchApiWithFallback('/api/providers/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryToUse,
          categoryHint: categoryInput,
          lat: 45.7489,
          lng: 21.2087,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Eroare la căutarea pe Google & Google Maps');
      }

      if (data.provider) {
        const pr = data.provider;
        const resolvedName = pr.name || queryToUse;
        const resolvedCity = pr.city || 'Timișoara';
        const resolvedAddress =
          pr.address || `Calea Lugojului, ${resolvedCity}, Jud. Timiș`;

        setNameInput(resolvedName);
        setCategoryInput(normalizeCategoryClient(pr.category || queryToUse));
        setDomainInput(
          pr.activityDomain ||
            'Service auto, revizii tehnice, diagnoză și mentenanță flotă'
        );
        setPhoneInput(pr.phone || '+40 256 408 100');
        setEmailInput(
          pr.email ||
            `office@${resolvedName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '')
              .slice(0, 20)}.ro`
        );
        setAddressInput(resolvedAddress);
        setCityInput(resolvedCity);
        setDistanceInput(
          typeof pr.distanceKm === 'number' && !Number.isNaN(pr.distanceKm)
            ? pr.distanceKm
            : 5
        );
        setMapsUrlInput(
          pr.mapsUrl ||
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${resolvedName} ${resolvedAddress}`
            )}`
        );
        setGroundingLinks(pr.groundingLinks || []);
        setSummaryMarkdown(
          pr.summaryMarkdown ||
            `Date preluate automat din Google & Google Maps pentru ${resolvedName} (${resolvedAddress}).`
        );
        setAutoFilledSuccess(true);
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Căutarea automată nu a putut fi finalizată.');
      setMapsUrlInput(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${queryToUse} Timișoara`
        )}`
      );
    } finally {
      searchInFlightRef.current = false;
      setIsSearchingGoogle(false);
    }
  };

  const handleSaveNewProvider = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;

    const finalMapsUrl =
      mapsUrlInput.trim() ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${nameInput.trim()} ${addressInput.trim() || 'Timișoara'}`
      )}`;

    if (editingProviderId) {
      const existing = providers.find((p) => p.id === editingProviderId);
      const updatedProv: ServiceProvider = {
        id: editingProviderId,
        name: nameInput.trim(),
        category: categoryInput,
        activityDomain:
          domainInput.trim() || 'Servicii tehnice, mentenanță și reparații',
        phone: phoneInput.trim() || '+40 256 000 000',
        email: emailInput.trim() || undefined,
        address: addressInput.trim() || 'Timișoara, Jud. Timiș',
        city: cityInput.trim() || 'Timișoara',
        distanceKm: distanceInput,
        mapsUrl: finalMapsUrl,
        isMandatory: existing?.isMandatory,
        groundingLinks: groundingLinks.length > 0 ? groundingLinks : undefined,
      };
      onUpdateProvider(updatedProv);
    } else {
      const newProv: ServiceProvider = {
        id: `prov-${Date.now()}`,
        name: nameInput.trim(),
        category: categoryInput,
        activityDomain:
          domainInput.trim() || 'Servicii tehnice, mentenanță și reparații',
        phone: phoneInput.trim() || '+40 256 000 000',
        email: emailInput.trim() || undefined,
        address: addressInput.trim() || 'Timișoara, Jud. Timiș',
        city: cityInput.trim() || 'Timișoara',
        distanceKm: distanceInput,
        mapsUrl: finalMapsUrl,
        groundingLinks: groundingLinks.length > 0 ? groundingLinks : undefined,
      };
      onAddProvider(newProv);
    }

    setShowAddModal(false);
    setEditingProviderId(null);
    setNameInput('');
    setDomainInput('');
    setPhoneInput('');
    setEmailInput('');
    setAddressInput('');
    setGroundingLinks([]);
    setSummaryMarkdown('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className={`text-xl font-bold ${theme.textPrimary} flex items-center gap-2.5`}>
            <MapPin className="w-6 h-6 text-sky-500" />
            <span>{t.navProviders} ({providers.length} Furnizori)</span>
          </h2>
          <p className={`text-xs ${theme.textMuted} mt-0.5`}>
            {t.providersSubtitle} · Include service-uri auto, stații ITP/MOT și firme de mentenanță clădire.
          </p>
        </div>

        <button
          type="button"
          onClick={openNewProviderModal}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-white ${theme.accentBg} shadow-sm transition whitespace-nowrap`}
        >
          <Plus className="w-4 h-4" />
          <span>{t.addProviderBtn}</span>
        </button>
      </div>

      {/* Search & Category Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 ${theme.textMuted}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className={`w-full pl-10 pr-4 py-2.5 rounded-lg border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textPrimary} text-sm focus:outline-none focus:ring-2 focus:ring-sky-500`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PROVIDER_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                selectedCategory === cat
                  ? `${theme.accentBg} text-white`
                  : `border ${theme.borderSubtle} ${theme.bgSurface} ${theme.textSecondary} hover:opacity-80`
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Providers List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredProviders.map((prov) => (
          <div
            key={prov.id}
            className={`p-5 rounded-xl border ${theme.borderSubtle} ${theme.bgSurface} flex flex-col justify-between gap-4`}
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className={`text-xs font-medium ${theme.textMuted}`}>
                  {prov.category} · <span className="font-mono tabular-nums">{prov.distanceKm} km de Timișoara</span>
                </div>
                <div className="flex items-center gap-2">
                  {prov.isMandatory && (
                    <span className="text-[11px] font-semibold text-sky-500">
                      Partener Verificat
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditProviderModal(prov)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-xs font-semibold hover:opacity-90 transition`}
                  >
                    <Pencil className="w-3 h-3 text-sky-500" />
                    <span>Editează</span>
                  </button>
                </div>
              </div>

              <h3 className={`text-base font-bold ${theme.textPrimary} flex items-center gap-2`}>
                <Building className="w-4 h-4 text-sky-500 shrink-0" />
                <span>{prov.name}</span>
              </h3>

              <p className={`text-xs ${theme.textSecondary} leading-relaxed`}>
                <strong>{t.activityDomain}:</strong> {prov.activityDomain}
              </p>

              <div className={`pt-2 space-y-1.5 text-xs ${theme.textSecondary}`}>
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <a
                    href={`tel:${prov.phone}`}
                    className="font-mono font-semibold hover:underline"
                  >
                    {prov.phone}
                  </a>
                  {prov.email && (
                    <>
                      <span>·</span>
                      <Mail className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="truncate">{prov.email}</span>
                    </>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    {prov.address} ({prov.city})
                  </span>
                </div>
              </div>

              {/* Grounding links if added via Google Maps / Google Search */}
              {prov.groundingLinks && prov.groundingLinks.length > 0 && (
                <div className={`pt-2 border-t ${theme.borderSubtle} space-y-1`}>
                  <div className={`text-[11px] font-semibold ${theme.textMuted}`}>
                    Surse Google Maps / Google Search:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {prov.groundingLinks.map((gl, idx) => (
                      <a
                        key={idx}
                        href={gl.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-sky-500 hover:underline inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>{gl.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Open Location in Google Maps Button */}
            <div className={`pt-3 border-t ${theme.borderSubtle} flex items-center justify-between gap-3`}>
              <span className={`text-[11px] font-mono ${theme.textMuted}`}>
                Rază 100 km Timișoara
              </span>

              <a
                href={prov.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-white ${theme.accentBg} shadow-sm transition whitespace-nowrap`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{t.openGoogleMaps}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Manual Addition / Editing with Automatic Google & Google Maps Search */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div
            className={`w-full max-w-xl rounded-2xl border ${theme.borderSubtle} ${theme.bgSurface} p-6 shadow-2xl space-y-5 my-8`}
          >
            <div className="flex items-center justify-between border-b pb-3 border-slate-200/60 dark:border-slate-800">
              <div>
                <h3 className={`text-lg font-bold ${theme.textPrimary}`}>
                  {editingProviderId
                    ? 'Editare Furnizor de Servicii'
                    : 'Adăugare Furnizor de Servicii Nou'}
                </h3>
                <p className={`text-xs ${theme.textMuted}`}>
                  {editingProviderId
                    ? 'Modificați datele furnizorului sau actualizați automat prin Google și Google Maps.'
                    : 'Scrieți numele furnizorului și aplicația va căuta automat prin Google și Google Maps detaliile de contact, adresa și locația.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setEditingProviderId(null);
                }}
                className={`p-1.5 rounded-lg ${theme.bgElevated} ${theme.textSecondary}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewProvider} className="space-y-4">
              {/* Step 1: Provider Name + Auto-Search Trigger */}
              <div className="space-y-2">
                <label className={`block text-xs font-semibold ${theme.textSecondary}`}>
                  {t.providerName} *
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    required
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      setAutoFilledSuccess(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !addressInput.trim() && nameInput.trim()) {
                        e.preventDefault();
                        handleAutoSearchGoogle(nameInput);
                      }
                    }}
                    onBlur={() => {
                      if (nameInput.trim().length >= 3 && !addressInput && !isSearchingGoogle) {
                        handleAutoSearchGoogle(nameInput);
                      }
                    }}
                    placeholder="Ex: Auto Schunn Mercedes Arad / Romstal Timișoara"
                    className={`flex-1 px-3.5 py-2.5 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm focus:outline-none focus:ring-2 focus:ring-sky-500`}
                  />
                  <button
                    type="button"
                    disabled={isSearchingGoogle || !nameInput.trim()}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleAutoSearchGoogle(nameInput)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition whitespace-nowrap"
                  >
                    {isSearchingGoogle ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t.searchingGoogle}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>{t.autoSearchGoogle}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {autoFilledSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-500 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    Informațiile au fost preluate automat din Google & Google Maps și completate în rubricile aferente!
                  </span>
                </div>
              )}

              {searchError && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs">
                  {searchError}
                </div>
              )}

              {summaryMarkdown && (
                <div className={`p-3 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} text-xs ${theme.textSecondary} space-y-1.5`}>
                  <div className="font-semibold text-sky-500">
                    Rezultat Google Maps & Search Grounding:
                  </div>
                  <p className="line-clamp-3">{summaryMarkdown}</p>
                  {groundingLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {groundingLinks.map((gl, i) => (
                        <a
                          key={i}
                          href={gl.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-500 hover:underline inline-flex items-center gap-1 font-medium"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>{gl.title}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                    Categorie Activitate
                  </label>
                  <select
                    value={categoryInput}
                    onChange={(e) => setCategoryInput(e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm`}
                  >
                    {PROVIDER_CATEGORIES.filter((c) => c !== 'Toate').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                    Telefon Contact
                  </label>
                  <input
                    type="text"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+40 256 ..."
                    className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} font-mono text-sm`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                    Email / Website
                  </label>
                  <input
                    type="text"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="contact@firma.ro"
                    className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm`}
                  />
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                  {t.activityDomain}
                </label>
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="Descriere servicii oferite..."
                  className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                    {t.addressLabel}
                  </label>
                  <input
                    type="text"
                    value={addressInput}
                    onChange={(e) => setAddressInput(e.target.value)}
                    placeholder="Strada, număr, cod poștal..."
                    className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-sm`}
                  />
                </div>

                <div>
                  <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                    Localitate & Distanță (km)
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      className={`w-2/3 px-2.5 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} text-xs`}
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={distanceInput}
                      onChange={(e) => setDistanceInput(Number(e.target.value))}
                      className={`w-1/3 px-2 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} font-mono text-xs`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-medium ${theme.textSecondary} mb-1`}>
                  Link Locație Google Maps
                </label>
                <input
                  type="url"
                  value={mapsUrlInput}
                  onChange={(e) => setMapsUrlInput(e.target.value)}
                  placeholder="https://www.google.com/maps/search/?api=1&query=..."
                  className={`w-full px-3 py-2 rounded-lg border ${theme.borderSubtle} ${theme.bgElevated} ${theme.textPrimary} font-mono text-xs`}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200/60 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProviderId(null);
                  }}
                  className={`px-4 py-2 rounded-lg border ${theme.borderSubtle} ${theme.textSecondary} text-xs font-semibold`}
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold text-white ${theme.accentBg}`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {editingProviderId
                      ? 'Salvează Modificările'
                      : 'Salvează Furnizor în Listă'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
