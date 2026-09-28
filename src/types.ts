export type Language = 'ro' | 'en' | 'nl' | 'de' | 'fr';

export type ThemeId =
  | 'light'
  | 'dark'
  | 'arctic-azure'
  | 'lavender-mist'
  | 'midnight-cobalt'
  | 'obsidian-violet';

export type InspectionStatus = 'overdue' | 'due_soon' | 'ok';

export type MainPage =
  | 'dashboard'
  | 'building'
  | 'vehicles'
  | 'providers'
  | 'reports'
  | 'settings';

export interface RenewalRecord {
  id: string;
  renewedAt: string;
  baseDate: string;
  periodLabel: string;
  newExpiryDate: string;
}

export interface BuildingMaintenanceItem {
  id: string;
  code: string;
  name: string;
  expiryDate: string; // YYYY-MM-DD
  lastRenewedDate: string; // YYYY-MM-DD
  lastPeriodLabel: string;
  assignedProvider?: string;
  notes?: string;
  isCustom?: boolean;
  history: RenewalRecord[];
}

export type VignetteCountry =
  | 'Romania'
  | 'Ungaria'
  | 'Slovacia'
  | 'Cehia'
  | 'Austria';

export type VignetteDurationCode = '1d' | '7d' | '10d' | '3m' | '6m' | '12m';

export interface VignetteItem {
  country: VignetteCountry;
  active?: boolean;
  expiryDate: string; // YYYY-MM-DD
  lastRenewedDate: string; // YYYY-MM-DD
  lastDurationCode: VignetteDurationCode;
}

export interface VehicleItem {
  id: string;
  plateNumber: string;
  vinNumber?: string;
  userName: string;
  makeModel: string;
  itpExpiryDate: string; // YYYY-MM-DD
  itpLastRenewedDate: string; // YYYY-MM-DD
  itpPeriodYears: 1 | 2 | 3;
  vignettes: VignetteItem[];
  notes?: string;
}

export interface GroundingLink {
  title: string;
  uri: string;
  snippet?: string;
}

export interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  activityDomain: string;
  phone: string;
  email?: string;
  address: string;
  city: string;
  distanceKm: number;
  mapsUrl: string;
  isMandatory?: boolean;
  groundingLinks?: GroundingLink[];
}

export interface NotificationSettings {
  pushEnabled: boolean;
  emailEnabled: boolean;
  autoEmailEnabled: boolean;
  autoDailyBackup?: boolean;
  emailClientConnected?: boolean;
  emailClientConnectedAt?: string;
  backgroundDaemonActive?: boolean;
  notificationTimeCET?: string;
  lastAutoNotifyDateCET?: string;
  lastDailyBackupDate?: string;
  leadValue: number;
  leadUnit: 'days' | 'weeks';
  senderEmail: string;
  recipientEmail: string;
  backupDriveEmail: string;
  lastEmailSentAt?: string;
  lastBackupAt?: string;
}

export interface UnifiedInspectionEntry {
  id: string;
  sourceType: 'building' | 'vehicle_itp' | 'vehicle_vignette';
  targetId: string;
  title: string;
  subtitle: string;
  categoryLabel: string;
  expiryDate: string;
  daysRemaining: number;
  status: InspectionStatus;
  country?: VignetteCountry;
}
