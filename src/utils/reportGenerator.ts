import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BuildingMaintenanceItem,
  Language,
  ServiceProvider,
  UnifiedInspectionEntry,
  VehicleItem,
} from '../types';
import { TRANSLATIONS } from '../i18n';
import {
  formatDateDisplay,
  formatTodayISO,
  getDaysRemaining,
  getInspectionStatus,
} from './dateUtils';

function statusText(status: 'overdue' | 'due_soon' | 'ok'): string {
  if (status === 'overdue') return 'OVERDUE (<= 3 zile)';
  if (status === 'due_soon') return 'DUE SOON (4-15 zile)';
  return 'OK (> 15 zile)';
}

const EXCEL_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function styleWorksheetForFullEditMode(
  ws: ExcelJS.Worksheet,
  columnWidths: number[],
  headerRowNumbers: number[]
) {
  ws.columns = columnWidths.map((wch) => ({ width: wch }));

  ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    const isTitleRow = rowNumber === 1;
    const isHeaderRow = headerRowNumbers.includes(rowNumber);

    if (isTitleRow) {
      row.height = 24;
    } else if (isHeaderRow) {
      row.height = 20;
    } else {
      row.height = 18;
    }

    row.eachCell({ includeEmpty: true }, (cell) => {
      // Explicitly unlock every cell so Microsoft Excel (Desktop & Mobile) opens in full Edit Mode
      cell.protection = { locked: false };

      if (isTitleRow) {
        cell.font = {
          name: 'Calibri',
          size: 13,
          bold: true,
          color: { argb: 'FFFFFFFF' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF0F172A' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else if (isHeaderRow) {
        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: true,
          color: { argb: 'FFFFFFFF' },
        };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF1E3A8A' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
          right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        };
      } else {
        const val = String(cell.value ?? '');
        let textArgb = 'FF0F172A';
        let isBold = false;
        if (val.includes('OVERDUE')) {
          textArgb = 'FFDC2626';
          isBold = true;
        } else if (val.includes('DUE SOON')) {
          textArgb = 'FFD97706';
          isBold = true;
        } else if (val.includes('OK (> 15 zile)') || val === 'OK (Verde)') {
          textArgb = 'FF16A34A';
          isBold = true;
        }

        cell.font = {
          name: 'Calibri',
          size: 10,
          bold: isBold,
          color: { argb: textArgb },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }
    });
  });
}

/**
 * Generates a genuine, ECMA-376 standard Microsoft Excel (.xlsx) workbook using ExcelJS:
 * - Sheet 1: "General" (detailed overview & all items across all categories)
 * - Sheet 2: "Mentenanta Cladire"
 * - Sheet 3: "Autovehicule ITP"
 * - Sheet 4: "Viniete Flota"
 * - Sheet 5: "Furnizori Servicii"
 * All cells are unlocked (`locked: false`), `DocSecurity = 0`, `<bookViews>` is present,
 * and `[Content_Types].xml` is first in the ZIP container so Excel opens directly in Edit Mode
 * without any file format or corruption errors.
 */
export async function createExcelWorkbookBuffer(params: {
  buildingItems: BuildingMaintenanceItem[];
  vehicles: VehicleItem[];
  providers: ServiceProvider[];
  allInspections: UnifiedInspectionEntry[];
  lang: Language;
}): Promise<{ blob: Blob; fileName: string }> {
  const { buildingItems, vehicles, providers, allInspections, lang } = params;
  const t = TRANSLATIONS[lang];
  const fileName = `Facility_and_Fleet_Maintenance_${formatTodayISO()}.xlsx`;

  const overdueCount = allInspections.filter((i) => i.status === 'overdue').length;
  const dueSoonCount = allInspections.filter((i) => i.status === 'due_soon').length;
  const okCount = allInspections.filter((i) => i.status === 'ok').length;

  // 1. First Sheet: "General"
  const generalRows: any[][] = [
    ['FACILITY AND FLEET MAINTENANCE - RAPORT DETALIAT GENERAL'],
    [
      'App by Lucian Pop',
      `Data Generării: ${formatTodayISO()}`,
      `Limba: ${lang.toUpperCase()}`,
      'Mod Editare Activ (Read / Write / Print)',
    ],
    [],
    ['SUMAR STARE INSPECȚII', 'NUMĂR ELEMENTE', 'REGULĂ MONITORIZARE'],
    ['OVERDUE (Roșu)', overdueCount, t.overdueDesc],
    ['DUE SOON (Galben)', dueSoonCount, t.dueSoonDesc],
    ['OK (Verde)', okCount, t.okDesc],
    ['TOTAL MONITORIZAT', allInspections.length, 'Clădire + Flotă ITP + Viniete (RO, HU, SK, CZ, AT)'],
    [],
    [
      'NR.',
      'CATEGORIE',
      'ELEMENT / AUTOVEHICUL',
      'DETALII / UTILIZATOR / ȚARĂ',
      'DATA EXPIRĂRII',
      'ZILE RĂMASE',
      'STATUS INSPECȚIE',
    ],
  ];

  allInspections.forEach((item, index) => {
    generalRows.push([
      index + 1,
      item.categoryLabel,
      item.title,
      item.subtitle,
      item.expiryDate,
      item.daysRemaining,
      statusText(item.status),
    ]);
  });

  // 2. Second Sheet: "Mentenanta Cladire"
  const buildingRows: any[][] = [
    ['MENTENANȚĂ CLĂDIRE - TOATE SUBCATEGORIILE (Facility and Fleet Maintenance - App by Lucian Pop)'],
    [],
    [
      'COD',
      'SUBCATEGORIE MENTENANȚĂ CLĂDIRE',
      'DATA EXPIRĂRII',
      'ZILE RĂMASE',
      'STATUS',
      'ULTIMA REÎNNOIRE',
      'PERIOADĂ APLICATĂ',
      'FURNIZOR ALOCAT',
      'OBSERVAȚII',
    ],
  ];

  buildingItems.forEach((b) => {
    const hasDate = Boolean(b.expiryDate && b.expiryDate.trim());
    const days = hasDate ? getDaysRemaining(b.expiryDate) : '-';
    const st = hasDate ? statusText(getInspectionStatus(b.expiryDate)) : 'NESETAT';
    buildingRows.push([
      b.code,
      b.name,
      hasDate ? b.expiryDate : 'Nesetat',
      days,
      st,
      b.lastRenewedDate || '-',
      b.lastPeriodLabel || '-',
      b.assignedProvider || '-',
      b.notes || '-',
    ]);
  });

  // 3. Third Sheet: "Autovehicule ITP"
  const vehicleRows: any[][] = [
    ['AUTOVEHICULE FLOTĂ - MONITORIZARE ITP / MOT (App by Lucian Pop)'],
    [],
    [
      'NR. ÎNMATRICULARE',
      'NUMĂR VIN (SERIE ȘASIU)',
      'UTILIZATOR (NUME)',
      'MARCĂ / MODEL',
      'DATA PRIMEI ÎNMATRICULĂRI',
      'DATA EXPIRARE ITP/MOT',
      'ZILE RĂMASE ITP',
      'STATUS ITP/MOT',
      'PERIOADĂ ITP (ANI)',
      'ULTIMA REÎNNOIRE ITP',
    ],
  ];

  vehicles.forEach((v) => {
    const hasDate = Boolean(v.itpExpiryDate && v.itpExpiryDate.trim());
    const days = hasDate ? getDaysRemaining(v.itpExpiryDate) : '-';
    const st = hasDate ? statusText(getInspectionStatus(v.itpExpiryDate)) : 'NESETAT';
    vehicleRows.push([
      v.plateNumber,
      v.vinNumber || '-',
      v.userName,
      v.makeModel,
      v.firstRegistrationDate || '-',
      hasDate ? v.itpExpiryDate : 'Nesetat',
      days,
      st,
      v.itpPeriodYears === 3 ? '3 Ani (Mașină Nouă)' : `${v.itpPeriodYears} Ani`,
      v.itpLastRenewedDate || '-',
    ]);
  });

  // 4. Fourth Sheet: "Viniete Flota"
  const vignetteRows: any[][] = [
    ['VALABILITATE VINIETE (ROMÂNIA, UNGARIA, SLOVACIA, CEHIA, AUSTRIA) - App by Lucian Pop'],
    [],
    [
      'NR. ÎNMATRICULARE',
      'UTILIZATOR',
      'ȚARA VINIETEI',
      'DATA EXPIRĂRII VINIETĂ',
      'ZILE RĂMASE',
      'STATUS VINIETĂ',
      'ULTIMA DURATĂ SELECTATĂ',
      'DATA REÎNNOIRII',
    ],
  ];

  vehicles.forEach((v) => {
    v.vignettes.forEach((vig) => {
      if (vig.active === false) return;
      const hasDate = Boolean(vig.expiryDate && vig.expiryDate.trim());
      const days = hasDate ? getDaysRemaining(vig.expiryDate) : '-';
      const st = hasDate ? statusText(getInspectionStatus(vig.expiryDate)) : 'NESETAT';
      vignetteRows.push([
        v.plateNumber,
        v.userName,
        vig.country,
        hasDate ? vig.expiryDate : 'Nesetat',
        days,
        st,
        vig.lastDurationCode,
        vig.lastRenewedDate || '-',
      ]);
    });
  });

  // 5. Fifth Sheet: "Furnizori Servicii"
  const providerRows: any[][] = [
    ['FURNIZORI SERVICII (RAZA 100 KM TIMIȘOARA) - App by Lucian Pop'],
    [],
    [
      'NUMELE FIRMEI',
      'CATEGORIE',
      'DOMENIUL DE ACTIVITATE',
      'TELEFON CONTACT',
      'EMAIL / WEB',
      'ADRESĂ',
      'LOCALITATE',
      'DISTANȚĂ TIMIȘOARA (KM)',
      'LINK GOOGLE MAPS',
    ],
  ];

  providers.forEach((p) => {
    providerRows.push([
      p.name,
      p.category,
      p.activityDomain,
      p.phone,
      p.email || '-',
      p.address,
      p.city,
      p.distanceKm,
      p.mapsUrl,
    ]);
  });

  try {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Lucian Pop';
    wb.lastModifiedBy = 'Lucian Pop';
    wb.created = new Date();
    wb.modified = new Date();
    wb.views = [
      {
        x: 0,
        y: 0,
        width: 24000,
        height: 14400,
        firstSheet: 0,
        activeTab: 0,
        visibility: 'visible',
      },
    ];

    const wsGeneral = wb.addWorksheet('General', {
      views: [{ state: 'normal' }],
    });
    wsGeneral.addRows(generalRows);
    styleWorksheetForFullEditMode(
      wsGeneral,
      [8, 26, 36, 36, 18, 16, 24],
      [4, 10]
    );

    const wsBuilding = wb.addWorksheet('Mentenanta Cladire', {
      views: [{ state: 'normal' }],
    });
    wsBuilding.addRows(buildingRows);
    styleWorksheetForFullEditMode(
      wsBuilding,
      [10, 38, 18, 15, 22, 18, 20, 28, 42],
      [3]
    );

    const wsVehicles = wb.addWorksheet('Autovehicule ITP', {
      views: [{ state: 'normal' }],
    });
    wsVehicles.addRows(vehicleRows);
    styleWorksheetForFullEditMode(
      wsVehicles,
      [20, 24, 26, 32, 22, 16, 22, 22, 22],
      [3]
    );

    const wsVignettes = wb.addWorksheet('Viniete Flota', {
      views: [{ state: 'normal' }],
    });
    wsVignettes.addRows(vignetteRows);
    styleWorksheetForFullEditMode(
      wsVignettes,
      [20, 24, 18, 22, 15, 22, 24, 18],
      [3]
    );

    const wsProviders = wb.addWorksheet('Furnizori Servicii', {
      views: [{ state: 'normal' }],
    });
    wsProviders.addRows(providerRows);
    styleWorksheetForFullEditMode(
      wsProviders,
      [32, 26, 42, 18, 26, 38, 18, 24, 48],
      [3]
    );

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: EXCEL_MIME_TYPE });
    return { blob, fileName };
  } catch {
    // Fallback using standard SheetJS array output
    const wbFallback = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wbFallback,
      XLSX.utils.aoa_to_sheet(generalRows),
      'General'
    );
    XLSX.utils.book_append_sheet(
      wbFallback,
      XLSX.utils.aoa_to_sheet(buildingRows),
      'Mentenanta Cladire'
    );
    XLSX.utils.book_append_sheet(
      wbFallback,
      XLSX.utils.aoa_to_sheet(vehicleRows),
      'Autovehicule ITP'
    );
    XLSX.utils.book_append_sheet(
      wbFallback,
      XLSX.utils.aoa_to_sheet(vignetteRows),
      'Viniete Flota'
    );
    XLSX.utils.book_append_sheet(
      wbFallback,
      XLSX.utils.aoa_to_sheet(providerRows),
      'Furnizori Servicii'
    );
    const out = XLSX.write(wbFallback, {
      bookType: 'xlsx',
      type: 'array',
    });
    const blob = new Blob([out], { type: EXCEL_MIME_TYPE });
    return { blob, fileName };
  }
}

export function createPdfReportBlob(params: {
  buildingItems: BuildingMaintenanceItem[];
  vehicles: VehicleItem[];
  providers: ServiceProvider[];
  allInspections: UnifiedInspectionEntry[];
  lang: Language;
}): { blob: Blob; fileName: string } {
  const { buildingItems, vehicles, providers, allInspections, lang } = params;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  const overdueCount = allInspections.filter((i) => i.status === 'overdue').length;
  const dueSoonCount = allInspections.filter((i) => i.status === 'due_soon').length;
  const okCount = allInspections.filter((i) => i.status === 'ok').length;

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.text('FACILITY AND FLEET MAINTENANCE - RAPORT GENERAL', 14, 11);
  doc.setFontSize(9);
  doc.text(
    `App by Lucian Pop   |   Data: ${formatDateDisplay(formatTodayISO(), lang)}   |   Limba: ${lang.toUpperCase()}   |   Overdue: ${overdueCount}   |   Due soon: ${dueSoonCount}   |   OK: ${okCount}`,
    14,
    19
  );

  // Section 1: General Summary & Urgent/Due Soon Inspections
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text('1. Raport General - Mentenanta Cladire (27+ Subcategorii)', 14, 32);

  autoTable(doc, {
    startY: 35,
    head: [['Cod', 'Subcategorie Mentenanta', 'Data Expirarii', 'Zile Ramase', 'Status', 'Perioada', 'Furnizor']],
    body: buildingItems.map((b) => {
      const hasDate = Boolean(b.expiryDate && b.expiryDate.trim());
      const days = hasDate ? String(getDaysRemaining(b.expiryDate)) : '-';
      const st = hasDate ? statusText(getInspectionStatus(b.expiryDate)) : 'NESETAT';
      return [
        b.code,
        b.name,
        hasDate ? b.expiryDate : 'Nesetat',
        days,
        st,
        b.lastPeriodLabel || '-',
        b.assignedProvider || '-',
      ];
    }),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 58, 138], textColor: 255 },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const val = String(data.cell.raw || '');
        if (val.includes('OVERDUE')) {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        } else if (val.includes('DUE SOON')) {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [22, 163, 74];
        }
      }
    },
  });

  doc.addPage();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 297, 18, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text('2. Autovehicule Flota - ITP/MOT si Viniete (RO, HU, SK, CZ, AT) - App by Lucian Pop', 14, 12);

  const vehicleAndVignetteRows: string[][] = [];
  vehicles.forEach((v) => {
    const hasItp = Boolean(v.itpExpiryDate && v.itpExpiryDate.trim());
    const itpDays = hasItp ? getDaysRemaining(v.itpExpiryDate) : 0;
    const itpSt = hasItp ? statusText(getInspectionStatus(v.itpExpiryDate)) : 'NESETAT';
    const activeVignettes = v.vignettes.filter((vg) => vg.active !== false);
    const vigSummary =
      activeVignettes.length > 0
        ? activeVignettes
            .map((vg) =>
              vg.expiryDate
                ? `${vg.country}: ${vg.expiryDate} (${getDaysRemaining(vg.expiryDate)}z)`
                : `${vg.country}: Nesetat`
            )
            .join(' | ')
        : '-';
    vehicleAndVignetteRows.push([
      v.plateNumber,
      v.userName,
      v.makeModel,
      v.firstRegistrationDate || '-',
      hasItp ? `${v.itpExpiryDate} (${itpDays}z)` : 'Nesetat',
      itpSt,
      vigSummary,
    ]);
  });

  autoTable(doc, {
    startY: 24,
    head: [['Nr. Auto', 'Utilizator', 'Model', 'Data Înmatriculării', 'Expirare ITP/MOT', 'Status ITP', 'Viniete (RO, HU, SK, CZ, AT)']],
    body: vehicleAndVignetteRows,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [2, 132, 199], textColor: 255 },
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 95;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.text('3. Furnizori Servicii (Raza 100 km Municipiul Timisoara)', 14, finalY + 10);

  autoTable(doc, {
    startY: finalY + 14,
    head: [['Nume Firma', 'Categorie', 'Domeniu Activitate', 'Telefon', 'Adresa', 'Distanta']],
    body: providers.map((p) => [
      p.name,
      p.category,
      p.activityDomain,
      p.phone,
      `${p.address} (${p.city})`,
      `${p.distanceKm} km`,
    ]),
    styles: { fontSize: 7.5, cellPadding: 1.8 },
    headStyles: { fillColor: [15, 23, 42], textColor: 255 },
  });

  const blob = doc.output('blob');
  const fileName = `Facility_and_Fleet_Maintenance_${formatTodayISO()}.pdf`;
  return { blob, fileName };
}

/**
 * Generates a complete, downloadable CSV file for all inspections
 * (Building Maintenance, Fleet Vehicle ITP/MOT, and Road Vignettes) using the 'xlsx' library.
 */
export function createInspectionsCsvBlob(params: {
  buildingItems: BuildingMaintenanceItem[];
  vehicles: VehicleItem[];
  allInspections?: UnifiedInspectionEntry[];
  lang?: Language;
}): { blob: Blob; fileName: string; totalRecords: number } {
  const { buildingItems, vehicles, lang = 'ro' } = params;
  const fileName = `Facility_and_Fleet_Inspections_${formatTodayISO()}.csv`;

  const rows: (string | number)[][] = [
    [
      'Nr. Crt.',
      'Categorie / Tip Inspecție',
      'Cod / Identificator',
      'Denumire Element / Nr. Înmatriculare',
      'Responsabil / Utilizator / Model',
      'Data Primei Înmatriculări',
      'Furnizor / Prestator Servicii',
      'Data Expirării',
      'Zile Rămase',
      'Status Termen',
      'Ultima Reînnoire',
      'Detalii / Perioadă / Observații',
    ],
  ];

  let counter = 1;

  // 1. Mentenanță Clădire (Building Maintenance)
  buildingItems.forEach((b) => {
    const hasDate = Boolean(b.expiryDate && b.expiryDate.trim());
    const days = hasDate ? getDaysRemaining(b.expiryDate) : '';
    const st = hasDate ? statusText(getInspectionStatus(b.expiryDate)) : 'NESETAT';
    rows.push([
      counter++,
      'Mentenanță Clădire',
      b.code,
      b.name,
      'Administrator / Tehnic',
      '-',
      b.assignedProvider || '-',
      hasDate ? b.expiryDate : 'Nesetat',
      hasDate ? days : '',
      st,
      b.lastRenewedDate || '-',
      b.notes || (b.lastPeriodLabel ? `Perioadă: ${b.lastPeriodLabel}` : '-'),
    ]);
  });

  // 2. Autovehicule ITP / MOT (Fleet Vehicles ITP)
  vehicles.forEach((v) => {
    const hasItp = Boolean(v.itpExpiryDate && v.itpExpiryDate.trim());
    const days = hasItp ? getDaysRemaining(v.itpExpiryDate) : '';
    const st = hasItp ? statusText(getInspectionStatus(v.itpExpiryDate)) : 'NESETAT';
    rows.push([
      counter++,
      'Autovehicule · ITP / MOT',
      v.vinNumber || '-',
      v.plateNumber,
      `${v.userName} (${v.makeModel})`,
      v.firstRegistrationDate || '-',
      'Stație ITP Autorizată RAR',
      hasItp ? v.itpExpiryDate : 'Nesetat',
      hasItp ? days : '',
      st,
      v.itpLastRenewedDate || '-',
      v.itpPeriodYears ? `Valabilitate: ${v.itpPeriodYears} ani` : '-',
    ]);
  });

  // 3. Viniete de Drum (Fleet Vehicle Vignettes)
  vehicles.forEach((v) => {
    v.vignettes.forEach((vg) => {
      const hasVig = Boolean(vg.expiryDate && vg.expiryDate.trim());
      const days = hasVig ? getDaysRemaining(vg.expiryDate) : '';
      const st = hasVig ? statusText(getInspectionStatus(vg.expiryDate)) : 'NESETAT';
      rows.push([
        counter++,
        `Vinietă Drum (${vg.country})`,
        vg.country,
        `${v.plateNumber} [${vg.country}]`,
        `${v.userName} (${v.makeModel})`,
        v.firstRegistrationDate || '-',
        `Operator Drumuri / Taxare ${vg.country}`,
        hasVig ? vg.expiryDate : 'Nesetat',
        hasVig ? days : '',
        st,
        vg.lastRenewedDate || '-',
        vg.active === false ? 'Inactivă' : `Durată: ${vg.lastDurationCode || '12m'}`,
      ]);
    });
  });

  // Convert array of arrays to sheet and then to CSV string via SheetJS XLSX
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const csvString = XLSX.utils.sheet_to_csv(worksheet);

  // Add UTF-8 BOM so Excel opens Romanian diacritics (ă, î, ș, ț, â) cleanly
  const blob = new Blob(['\uFEFF' + csvString], {
    type: 'text/csv;charset=utf-8;',
  });

  return { blob, fileName, totalRecords: counter - 1 };
}

/**
 * Downloads a binary Blob directly from browser memory via URL.createObjectURL
 * so that no Service Worker NavigationRoute can ever intercept the download URL
 * and replace the binary file with index.html.
 */
export function triggerBrowserDownload(blob: Blob, fileName: string) {
  if (
    typeof window !== 'undefined' &&
    window.AndroidNativeBridge?.downloadFileBase64
  ) {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        if (base64 && window.AndroidNativeBridge?.downloadFileBase64) {
          window.AndroidNativeBridge.downloadFileBase64(
            base64,
            fileName,
            blob.type || 'application/octet-stream'
          );
        }
      };
      reader.readAsDataURL(blob);
      return;
    } catch {
      // Fallback to standard anchor download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) {
      document.body.removeChild(a);
    }
    URL.revokeObjectURL(url);
  }, 10000);
}
