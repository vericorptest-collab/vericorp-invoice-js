export class VeriCorpInvoiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "VeriCorpInvoiceError";
  }
}

export class RateLimitError extends VeriCorpInvoiceError {
  constructor(message = "Too many requests") {
    super(message, "RATE_LIMITED", 429);
    this.name = "RateLimitError";
  }
}

export class InvalidFileError extends VeriCorpInvoiceError {
  constructor(message = "Invalid file") {
    super(message, "INVALID_FILE", 400);
    this.name = "InvalidFileError";
  }
}

export class ExtractionFailedError extends VeriCorpInvoiceError {
  constructor(message = "Failed to extract invoice data") {
    super(message, "EXTRACTION_FAILED", 422);
    this.name = "ExtractionFailedError";
  }
}

export class BudgetExhaustedError extends VeriCorpInvoiceError {
  constructor(message = "Source temporarily unavailable") {
    super(message, "BUDGET_EXHAUSTED", 503);
    this.name = "BudgetExhaustedError";
  }
}

export class TimeoutError extends VeriCorpInvoiceError {
  constructor(message = "Request timed out") {
    super(message, "TIMEOUT", 0);
    this.name = "TimeoutError";
  }
}
