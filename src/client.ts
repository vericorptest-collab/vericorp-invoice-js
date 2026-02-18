import type {
  VeriCorpInvoiceOptions,
  ExtractOptions,
  InvoiceResponse,
  HealthResponse,
  SupportedFormatsResponse,
  ApiErrorBody,
} from "./types";
import {
  VeriCorpInvoiceError,
  RateLimitError,
  InvalidFileError,
  ExtractionFailedError,
  BudgetExhaustedError,
  TimeoutError,
} from "./errors";
import { fetchWithRetry } from "./retry";

const DEFAULT_HOST = "vericorp-invoice-api.p.rapidapi.com";
const DEFAULT_BASE_URL = "https://vericorp-invoice-api.p.rapidapi.com";
const DEFAULT_TIMEOUT = 30000; // 30s — invoice processing takes longer
const DEFAULT_MAX_RETRIES = 1;

export class VeriCorpInvoice {
  private readonly apiKey: string;
  private readonly host: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly maxRetries: number;

  constructor(options: VeriCorpInvoiceOptions) {
    if (!options.apiKey) throw new Error("apiKey is required");
    this.apiKey = options.apiKey;
    this.host = options.host ?? DEFAULT_HOST;
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  /**
   * Extract structured data from an invoice file (PDF or image).
   * Accepts Blob, File, or ArrayBuffer.
   */
  async extract(
    file: Blob | File | ArrayBuffer,
    options: ExtractOptions = {},
  ): Promise<InvoiceResponse> {
    const formData = new FormData();
    const blob = file instanceof Blob ? file : new Blob([file]);
    formData.append("file", blob, blob instanceof File ? blob.name : "invoice");

    if (options.validateNif === false) formData.append("validate_nif", "false");
    if (options.validateIban === false) formData.append("validate_iban", "false");
    if (options.includeRawText) formData.append("include_raw_text", "true");

    return this.request<InvoiceResponse>("/v1/extract", {
      method: "POST",
      body: formData,
    });
  }

  /** Check API health and budget status. */
  async health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("/v1/health");
  }

  /** Get supported file formats and size limits. */
  async supportedFormats(): Promise<SupportedFormatsResponse> {
    return this.request<SupportedFormatsResponse>("/v1/supported-formats");
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers: Record<string, string> = {
        "X-RapidAPI-Key": this.apiKey,
        "X-RapidAPI-Host": this.host,
      };

      // Don't set Content-Type for FormData — browser/runtime sets it with boundary
      if (!(init?.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
      }

      const response = await fetchWithRetry(
        url,
        {
          ...init,
          signal: controller.signal,
          headers: { ...headers, ...init?.headers as Record<string, string> },
        },
        this.maxRetries,
      );

      if (!response.ok) {
        const body = (await response.json().catch(() => ({
          error: response.statusText,
          code: "UNKNOWN",
        }))) as ApiErrorBody;

        throw this.mapError(response.status, body);
      }

      return (await response.json()) as T;
    } catch (err) {
      if (err instanceof VeriCorpInvoiceError) throw err;
      if ((err as Error).name === "AbortError") throw new TimeoutError();
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private mapError(status: number, body: ApiErrorBody): VeriCorpInvoiceError {
    switch (body.code) {
      case "RATE_LIMITED":
        return new RateLimitError(body.error);
      case "INVALID_FILE":
      case "UNSUPPORTED_FORMAT":
      case "MISSING_FILE":
        return new InvalidFileError(body.error);
      case "EXTRACTION_FAILED":
        return new ExtractionFailedError(body.error);
      case "BUDGET_EXHAUSTED":
        return new BudgetExhaustedError(body.error);
      default:
        return new VeriCorpInvoiceError(body.error, body.code, status);
    }
  }
}
