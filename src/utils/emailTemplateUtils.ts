import { UnifiedInspectionEntry } from '../types';
import { formatTodayISO } from './dateUtils';

export const DEFAULT_EMAIL_SUBJECT =
  '[ALERTĂ EXPIRARE] {nr_elemente} elemente scadente - Facility and Fleet Maintanance';

export const DEFAULT_EMAIL_TEMPLATE =
  `<p>Bună ziua,</p>
<p>Vă informăm că la data de <strong>{data}</strong> există <strong>{nr_elemente} inspecții / termene scadente</strong> (Mentenanță Clădire, ITP / MOT și Viniete de drum) care necesită intervenție sau reînnoire:</p>
{tabel_inspectii}
<p style="margin-top: 16px;">Vă rugăm să efectuați demersurile de verificare și reînnoire sau să actualizați noile termene în aplicația <em>Facility and Fleet Maintanance</em>.</p>`;

export const DEFAULT_EMAIL_SIGNATURE =
  `Lucian Pop
Administrator Mentenanță Clădire & Flotă
Facility and Fleet Maintanance · Timișoara
Email: Facilityandfleetmaintanance@gmail.com`;

export interface RenderEmailOptions {
  subjectPattern?: string;
  template?: string;
  signature?: string;
  inspections: UnifiedInspectionEntry[];
  senderEmail: string;
  recipientEmail: string;
  leadValue?: number;
  leadUnit?: 'days' | 'weeks';
  currentDate?: string;
}

export function buildInspectionsHtmlTable(
  inspections: UnifiedInspectionEntry[]
): string {
  if (inspections.length === 0) {
    return '<p style="color: #16a34a; font-weight: bold;">Toate termenele sunt valide. Nu există inspecții scadente.</p>';
  }

  const rows = inspections
    .map((item) => {
      const isOverdue = item.status === 'overdue' || item.daysRemaining <= 0;
      const isDueSoon = item.status === 'due_soon';
      const statusColor = isOverdue
        ? '#dc2626'
        : isDueSoon
        ? '#d97706'
        : '#16a34a';
      const statusLabel = isOverdue
        ? 'OVERDUE'
        : isDueSoon
        ? 'DUE SOON'
        : 'OK';

      return `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 8px 10px; font-size: 12px; color: #475569;">${item.categoryLabel}</td>
          <td style="padding: 8px 10px; font-size: 12px; font-weight: bold; color: #0f172a;">${item.title} ${
        item.subtitle ? `<span style="font-weight: normal; color: #64748b;">(${item.subtitle})</span>` : ''
      }</td>
          <td style="padding: 8px 10px; font-size: 12px; font-family: monospace; color: #0f172a;">${item.expiryDate}</td>
          <td style="padding: 8px 10px; font-size: 12px; font-family: monospace; font-weight: bold; color: ${statusColor};">
            ${
              item.daysRemaining < 0
                ? `${Math.abs(item.daysRemaining)} zile depășite`
                : item.daysRemaining === 0
                ? 'Expiră astăzi'
                : `${item.daysRemaining} zile`
            }
          </td>
          <td style="padding: 8px 10px; font-size: 11px; font-weight: bold; text-align: center; color: ${statusColor};">${statusLabel}</td>
        </tr>
      `;
    })
    .join('');

  return `
    <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; margin-top: 12px; margin-bottom: 16px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
      <thead style="background: #0f172a; color: #ffffff;">
        <tr>
          <th style="padding: 9px 10px; font-size: 11px; text-align: left; text-transform: uppercase;">Categorie</th>
          <th style="padding: 9px 10px; font-size: 11px; text-align: left; text-transform: uppercase;">Element / Vehicul</th>
          <th style="padding: 9px 10px; font-size: 11px; text-align: left; text-transform: uppercase;">Data Expirării</th>
          <th style="padding: 9px 10px; font-size: 11px; text-align: left; text-transform: uppercase;">Termen</th>
          <th style="padding: 9px 10px; font-size: 11px; text-align: center; text-transform: uppercase;">Status</th>
        </tr>
      </thead>
      <tbody style="background: #ffffff;">
        ${rows}
      </tbody>
    </table>
  `;
}

export function renderEmailSubject(
  subjectPattern: string | undefined,
  inspectionsCount: number,
  currentDate: string = formatTodayISO()
): string {
  const pattern = subjectPattern?.trim() || DEFAULT_EMAIL_SUBJECT;
  return pattern
    .replace(/\{nr_elemente\}/g, String(inspectionsCount))
    .replace(/\{data\}/g, currentDate);
}

export function renderEmailHtml(options: RenderEmailOptions): string {
  const {
    template = DEFAULT_EMAIL_TEMPLATE,
    signature = DEFAULT_EMAIL_SIGNATURE,
    inspections,
    senderEmail,
    recipientEmail,
    leadValue = 15,
    leadUnit = 'days',
    currentDate = formatTodayISO(),
  } = options;

  const count = inspections.length;
  const tableHtml = buildInspectionsHtmlTable(inspections);

  // Convert signature plain text newlines to HTML <br/>
  const formattedSignature = (signature || DEFAULT_EMAIL_SIGNATURE)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('<br/>');

  // Replace placeholders in the custom template
  let bodyContent = (template || DEFAULT_EMAIL_TEMPLATE)
    .replace(/\{nr_elemente\}/g, String(count))
    .replace(/\{data\}/g, currentDate)
    .replace(/\{expeditor\}/g, senderEmail)
    .replace(/\{destinatar\}/g, recipientEmail)
    .replace(/\{prag_alerta\}/g, `${leadValue} ${leadUnit === 'weeks' ? 'săptămâni' : 'zile'}`)
    .replace(/\{tabel_inspectii\}/g, tableHtml)
    .replace(/\{lista_inspectii\}/g, tableHtml);

  // If the user's template didn't include the table tag, append it automatically
  if (!bodyContent.includes(tableHtml)) {
    bodyContent += `\n${tableHtml}`;
  }

  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 680px; margin: 0 auto; color: #0f172a; line-height: 1.5;">
      <div style="background: #0f172a; padding: 18px 22px; border-radius: 8px 8px 0 0; color: #ffffff;">
        <h2 style="margin: 0; font-size: 18px; font-weight: bold; letter-spacing: 0.5px;">Facility and Fleet Maintanance</h2>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 4px;">Sistem Automat de Notificare · Notificări 09:00 CET</div>
      </div>

      <div style="background: #f8fafc; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; padding: 12px 20px; font-size: 12px; color: #475569;">
        <div><strong>De la:</strong> ${senderEmail}</div>
        <div><strong>Către:</strong> ${recipientEmail}</div>
        <div><strong>Data generării:</strong> ${currentDate}</div>
      </div>

      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-top: none; padding: 22px 24px; border-radius: 0 0 8px 8px;">
        ${bodyContent}

        <div style="margin-top: 24px; padding-top: 16px; border-top: 2px solid #e2e8f0; font-size: 13px; color: #334155; line-height: 1.6;">
          <div style="font-weight: bold; color: #0f172a; margin-bottom: 4px;">Cu respect,</div>
          <div>${formattedSignature}</div>
        </div>
      </div>

      <div style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 14px;">
        Acest e-mail a fost generat automat din aplicația Facility and Fleet Maintanance.
      </div>
    </div>
  `;
}
