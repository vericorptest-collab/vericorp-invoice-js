import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  VeriCorpInvoice,
  RateLimitError,
  InvalidFileError,
  ExtractionFailedError,
  BudgetExhaustedError,
  TimeoutError,
  VeriCorpInvoiceError,
} from "../src";

const API_KEY = "test-api-key";

const INVOICE_RESPONSE = {
  document_type: "invoice",
  confidence: 0.92,
  issuer: { name: "Acme Lda", tax_id: "PT502011378", tax_id_valid: true, tax_id_country: "PT", address: "Rua Example 1", iban: null, iban_valid: null, iban_formatted: null, bank_name: null, bank_bic: null },
  recipient: { name: "Client SA", tax_id: "PT509123456", tax_id_valid: true, tax_id_country: "PT", address: null, iban: null, iban_valid: null, iban_formatted: null, bank_name: null, bank_bic: null },
  invoice_number: "FT 2026/001",
  issue_date: "2026-01-15",
  due_date: "2026-02-15",
  currency: "EUR",
  line_items: [{ description: "Service", quantity: 1, unit_price: 100, vat_rate: 23, amount: 100, confidence: 0.95 }],
  totals: { subtotal: 100, vat_amount: 23, total: 123, vat_breakdown: [{ rate: 23, base: 100, amount: 23 }], validation: { line_items_match: true, vat_match: true, total_match: true } },
  payment: { iban: null, iban_valid: null, iban_formatted: null, bank_name: null, bank_bic: null, reference: null, method: null },
  metadata: { model: "llama-3.3-70b", neurons_used: 840, processing_time_ms: 3200, pages: 1, retries: 0, cached: false, file_hash: "abc123" },
  quality: { level: "high", width: null, height: null, estimated_dpi: null, file_type: "application/pdf", file_size: 45000, warning: null, issues: [] },
};

const HEALTH_RESPONSE = {
  status: "healthy",
  timestamp: "2026-02-19T00:00:00Z",
  budget: { used: 100, limit: 5000, remaining: 4900, reset_at: "2026-02-20T00:00:00Z" },
  cache: { status: "up" },
};

const FORMATS_RESPONSE = {
  supported_formats: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
  max_file_size: 10485760,
  max_file_size_human: "10 MB",
};

function mockFetch(body: unknown, status = 200, headers?: Record<string, string>) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: () => Promise.resolve(body),
    headers: new Headers(headers),
  });
}

describe("VeriCorpInvoice", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requires apiKey", () => {
    expect(() => new VeriCorpInvoice({ apiKey: "" })).toThrow("apiKey is required");
  });

  describe("extract", () => {
    it("returns invoice data from PDF", async () => {
      globalThis.fetch = mockFetch(INVOICE_RESPONSE);

      const client = new VeriCorpInvoice({ apiKey: API_KEY });
      const result = await client.extract(new Blob(["pdf content"], { type: "application/pdf" }));

      expect(result.document_type).toBe("invoice");
      expect(result.issuer.name).toBe("Acme Lda");
      expect(result.totals.total).toBe(123);
      expect(result.confidence).toBe(0.92);
      expect(globalThis.fetch).toHaveBeenCalledOnce();

      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain("/v1/extract");
      expect(init.method).toBe("POST");
      expect(init.headers["X-RapidAPI-Key"]).toBe(API_KEY);
    });

    it("sends extract options", async () => {
      globalThis.fetch = mockFetch(INVOICE_RESPONSE);

      const client = new VeriCorpInvoice({ apiKey: API_KEY });
      await client.extract(new Blob(["data"]), {
        validateNif: false,
        validateIban: false,
        includeRawText: true,
      });

      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = init.body as FormData;
      expect(body.get("validate_nif")).toBe("false");
      expect(body.get("validate_iban")).toBe("false");
      expect(body.get("include_raw_text")).toBe("true");
    });

    it("accepts ArrayBuffer", async () => {
      globalThis.fetch = mockFetch(INVOICE_RESPONSE);

      const client = new VeriCorpInvoice({ apiKey: API_KEY });
      const buffer = new ArrayBuffer(10);
      const result = await client.extract(buffer);

      expect(result.document_type).toBe("invoice");
    });
  });

  describe("health", () => {
    it("returns health status", async () => {
      globalThis.fetch = mockFetch(HEALTH_RESPONSE);

      const client = new VeriCorpInvoice({ apiKey: API_KEY });
      const result = await client.health();

      expect(result.status).toBe("healthy");
      expect(result.budget.remaining).toBe(4900);
    });
  });

  describe("supportedFormats", () => {
    it("returns formats list", async () => {
      globalThis.fetch = mockFetch(FORMATS_RESPONSE);

      const client = new VeriCorpInvoice({ apiKey: API_KEY });
      const result = await client.supportedFormats();

      expect(result.supported_formats).toContain("application/pdf");
      expect(result.max_file_size).toBe(10485760);
    });
  });

  describe("error handling", () => {
    it("throws InvalidFileError on INVALID_FILE", async () => {
      globalThis.fetch = mockFetch({ error: "Invalid file type", code: "INVALID_FILE" }, 400);

      const client = new VeriCorpInvoice({ apiKey: API_KEY });
      await expect(client.extract(new Blob(["bad"]))).rejects.toThrow(InvalidFileError);
    });

    it("throws ExtractionFailedError on EXTRACTION_FAILED", async () => {
      globalThis.fetch = mockFetch({ error: "Could not extract", code: "EXTRACTION_FAILED" }, 422);

      const client = new VeriCorpInvoice({ apiKey: API_KEY });
      await expect(client.extract(new Blob(["data"]))).rejects.toThrow(ExtractionFailedError);
    });

    it("throws BudgetExhaustedError on BUDGET_EXHAUSTED", async () => {
      globalThis.fetch = mockFetch({ error: "Budget exhausted", code: "BUDGET_EXHAUSTED" }, 503);

      const client = new VeriCorpInvoice({ apiKey: API_KEY, maxRetries: 0 });
      await expect(client.extract(new Blob(["data"]))).rejects.toThrow(BudgetExhaustedError);
    });

    it("throws RateLimitError on 429", async () => {
      globalThis.fetch = mockFetch({ error: "Rate limited", code: "RATE_LIMITED" }, 429);

      const client = new VeriCorpInvoice({ apiKey: API_KEY, maxRetries: 0 });
      await expect(client.extract(new Blob(["data"]))).rejects.toThrow(RateLimitError);
    });

    it("throws VeriCorpInvoiceError for unknown errors", async () => {
      globalThis.fetch = mockFetch({ error: "Forbidden", code: "FORBIDDEN" }, 403);

      const client = new VeriCorpInvoice({ apiKey: API_KEY });
      await expect(client.extract(new Blob(["data"]))).rejects.toThrow(VeriCorpInvoiceError);
    });

    it("throws TimeoutError when request times out", async () => {
      globalThis.fetch = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          const onAbort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          if (init.signal?.aborted) return onAbort();
          init.signal?.addEventListener("abort", onAbort);
        });
      });

      const client = new VeriCorpInvoice({ apiKey: API_KEY, timeout: 50, maxRetries: 0 });
      await expect(client.extract(new Blob(["data"]))).rejects.toThrow(TimeoutError);
    });
  });

  describe("retry", () => {
    it("retries on 429 and succeeds", async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({
          ok: false, status: 429, statusText: "Too Many Requests",
          json: () => Promise.resolve({ error: "Rate limited", code: "RATE_LIMITED" }),
          headers: new Headers({ "Retry-After": "0" }),
        })
        .mockResolvedValueOnce({
          ok: true, status: 200, statusText: "OK",
          json: () => Promise.resolve(INVOICE_RESPONSE),
          headers: new Headers(),
        });
      globalThis.fetch = fn;

      const client = new VeriCorpInvoice({ apiKey: API_KEY, maxRetries: 1 });
      const result = await client.extract(new Blob(["data"]));

      expect(result.document_type).toBe("invoice");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("retries on 503 and succeeds", async () => {
      const fn = vi.fn()
        .mockResolvedValueOnce({
          ok: false, status: 503, statusText: "Service Unavailable",
          json: () => Promise.resolve({ error: "AI unavailable", code: "AI_UNAVAILABLE" }),
          headers: new Headers(),
        })
        .mockResolvedValueOnce({
          ok: true, status: 200, statusText: "OK",
          json: () => Promise.resolve(INVOICE_RESPONSE),
          headers: new Headers(),
        });
      globalThis.fetch = fn;

      const client = new VeriCorpInvoice({ apiKey: API_KEY, maxRetries: 1 });
      const result = await client.extract(new Blob(["data"]));

      expect(result.issuer.name).toBe("Acme Lda");
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe("custom options", () => {
    it("supports custom baseUrl", async () => {
      globalThis.fetch = mockFetch(HEALTH_RESPONSE);

      const client = new VeriCorpInvoice({ apiKey: API_KEY, baseUrl: "https://custom.api.com" });
      await client.health();

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toMatch(/^https:\/\/custom\.api\.com/);
    });

    it("supports custom host", async () => {
      globalThis.fetch = mockFetch(HEALTH_RESPONSE);

      const client = new VeriCorpInvoice({ apiKey: API_KEY, host: "custom.host.com" });
      await client.health();

      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(init.headers["X-RapidAPI-Host"]).toBe("custom.host.com");
    });
  });
});
