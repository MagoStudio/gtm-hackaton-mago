import Papa from 'papaparse';

export interface RawCsvRow {
  id: string;
  firstname: string;
  lastname: string;
  companies: string;
  jobTitle: string;
  description: string;
  Status: string;
  'Deal value': string;
  'Actual ACV': string;
  'Company size': string;
  'Company vertical': string;
  'Prospect owner': string;
  Where: string;
  'Next steps': string;
  'Closed date': string;
  'Lost reason': string;
  lastInteraction: string;
  favoriteEmail: string;
  emails: string;
  favoritePhone: string;
  phones: string;
  favoriteUrl: string;
  urls: string;
  favoriteAddress: string;
  addresses: string;
  nbInteractions: string;
  strongestConnection: string;
}

export interface ParsedDeal {
  external_id: string;
  first_name: string;
  last_name: string;
  company: string;
  job_title: string;
  status: string;
  deal_value: number;
  actual_acv: number;
  company_size: string;
  company_vertical: string;
  prospect_owner: string;
  country: string;
  next_steps: string;
  closed_date: string | null;
  lost_reason: string;
  last_interaction: string | null;
  email: string;
  phone: string;
  linkedin_url: string;
  address: string;
  description: string;
  nb_interactions: number;
  strongest_connection: string;
}

export interface ParsedNote {
  contact_id: string;
  contact_name: string;
  note_id: string;
  author: string;
  content: string;
  created_at: string;
}

export type CsvParseResult =
  | { type: 'people'; deals: ParsedDeal[] }
  | { type: 'notes'; notes: ParsedNote[] };

function extractLinkedIn(urls: string): string {
  if (!urls) return '';
  const parts = urls.split(',');
  const li = parts.find((u) => u.includes('linkedin.com'));
  return li?.trim() || '';
}

function detectCsvType(headers: string[]): 'people' | 'notes' {
  const lower = headers.map((h) => h.toLowerCase().trim());
  if (lower.includes('notecontent') || lower.includes('noteid')) {
    return 'notes';
  }
  return 'people';
}

/** Normalize common status typos from CSV exports */
const STATUS_CORRECTIONS: Record<string, string> = {
  'recyle': 'Recycle',
  'recylce': 'Recycle',
  'commited': 'Committed',
  'comitted': 'Committed',
  'closedwon': 'Closed-won',
  'closedlost': 'Closed-lost',
  'closed won': 'Closed-won',
  'closed lost': 'Closed-lost',
};

function normalizeStatus(raw: string): string {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (STATUS_CORRECTIONS[lower]) return STATUS_CORRECTIONS[lower];
  // Match against known stages (case-insensitive)
  const KNOWN = ['Lead', 'Prospect', 'Email follow up', 'Discovery Meeting', 'Tech Qualification', 'Design proposal', 'Committed', 'Closed-won', 'Closed-lost', 'Recycle'];
  const match = KNOWN.find((s) => s.toLowerCase() === lower);
  return match || trimmed;
}

export function parseCsvFile(file: File): Promise<CsvParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields || [];
        const csvType = detectCsvType(headers);

        if (csvType === 'notes') {
          const notes: ParsedNote[] = (results.data as any[])
            .filter((row) => row.noteContent?.trim())
            .map((row) => ({
              contact_id: row.contactId || '',
              contact_name: row.contactName || '',
              note_id: row.noteId || '',
              author: row.author || '',
              content: row.noteContent || '',
              created_at: row.createdAt || '',
            }));
          resolve({ type: 'notes', notes });
        } else {
          const deals: ParsedDeal[] = (results.data as RawCsvRow[]).map((row) => ({
            external_id: row.id || '',
            first_name: row.firstname || '',
            last_name: row.lastname || '',
            company: (row.companies || '').split(',')[0]?.trim() || '',
            job_title: row.jobTitle || '',
            status: normalizeStatus(row.Status || ''),
            deal_value: parseFloat(row['Deal value']) || 0,
            actual_acv: parseFloat(row['Actual ACV']) || 0,
            company_size: row['Company size'] || '',
            company_vertical: row['Company vertical'] || '',
            prospect_owner: row['Prospect owner'] || '',
            country: row.Where || '',
            next_steps: row['Next steps'] || '',
            closed_date: row['Closed date'] || null,
            lost_reason: row['Lost reason'] || '',
            last_interaction: row.lastInteraction || null,
            email: row.favoriteEmail || row.emails?.split(',')[0]?.trim() || '',
            phone: row.favoritePhone || row.phones?.split(',')[0]?.trim() || '',
            linkedin_url: extractLinkedIn(row.urls || row.favoriteUrl || ''),
            address: row.favoriteAddress || row.addresses?.split(',')[0]?.trim() || '',
            description: row.description || '',
            nb_interactions: parseInt(row.nbInteractions) || 0,
            strongest_connection: row.strongestConnection || '',
          }));
          resolve({ type: 'people', deals });
        }
      },
      error(err) {
        reject(err);
      },
    });
  });
}
