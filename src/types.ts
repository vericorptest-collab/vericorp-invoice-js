export interface VeriCorpInvoiceOptions {
  apiKey: string;
  host?: string;
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface ExtractOptions {
  validateNif?: boolean;
  validateIban?: boolean;
  includeRawText?: boolean;
}

export interface InvoiceResponse {
  document_type: "invoice" | "credit_note" | "debit_note" | "receipt" | "unknown";
  confidence: number;
  issuer: Party;
  recipient: Party;
  invoice_number: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  line_items: LineItem[];
  totals: Totals;
  payment: PaymentInfo;
  metadata: ExtractionMetadata;
  quality: QualityResult;
  raw_text?: string;
}

export interface Party {
  name: string | null;
  tax_id: string | null;
  tax_id_valid: boolean | null;
  tax_id_country: string | null;
  address: string | null;
  iban: string | null;
  iban_valid: boolean | null;
  iban_formatted: string | null;
  bank_name: string | null;
  bank_bic: string | null;
}

export interface LineItem {
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  vat_rate: number | null;
  amount: number | null;
  confidence: number;
}

export interface Totals {
  subtotal: number | null;
  vat_amount: number | null;
  total: number | null;
  vat_breakdown: VATBreakdown[];
  validation: TotalsValidation;
}

export interface VATBreakdown {
  rate: number;
  base: number;
  amount: number;
}

export interface TotalsValidation {
  line_items_match: boolean | null;
  vat_match: boolean | null;
  total_match: boolean | null;
}

export interface PaymentInfo {
  iban: string | null;
  iban_valid: boolean | null;
  iban_formatted: string | null;
  bank_name: string | null;
  bank_bic: string | null;
  reference: string | null;
  method: string | null;
}

export interface ExtractionMetadata {
  model: string;
  neurons_used: number;
  processing_time_ms: number;
  pages: number;
  retries: number;
  cached: boolean;
  file_hash: string;
}

export interface QualityResult {
  level: "high" | "medium" | "low" | "very_low";
  width: number | null;
  height: number | null;
  estimated_dpi: number | null;
  file_type: string;
  file_size: number;
  warning: string | null;
  issues: QualityIssue[];
}

export interface QualityIssue {
  field: string;
  issue: string;
  severity: "warning" | "error";
}

export interface HealthResponse {
  status: "healthy" | "degraded";
  timestamp: string;
  budget: NeuronBudget;
  cache: { status: "up" | "down" };
}

export interface NeuronBudget {
  used: number;
  limit: number;
  remaining: number;
  reset_at: string;
}

export interface SupportedFormatsResponse {
  supported_formats: string[];
  max_file_size: number;
  max_file_size_human: string;
}

export interface ApiErrorBody {
  error: string;
  code: string;
}
