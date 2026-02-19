# @vericorp/invoice-extract

Official TypeScript/JavaScript SDK for the [VeriCorp Invoice Extract API](https://rapidapi.com/vericorptestcollab/api/vericorp-invoice-extract) — extract structured data from European invoices using AI.

## Install

```bash
npm install @vericorp/invoice-extract
```

## Quick Start

```typescript
import { VeriCorpInvoice } from "@vericorp/invoice-extract";
import { readFileSync } from "fs";

const client = new VeriCorpInvoice({ apiKey: "your-rapidapi-key" });

// Extract data from an invoice
const invoice = await client.extract(readFileSync("invoice.pdf"), {
  filename: "invoice.pdf",
});

console.log(invoice.issuer.name);
console.log(invoice.totals.total_amount);
console.log(invoice.line_items);
```

## API

### `new VeriCorpInvoice(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | **required** | Your RapidAPI key |
| `timeout` | `number` | `30000` | Request timeout in ms |
| `maxRetries` | `number` | `1` | Retries on 429/503 |

### Methods

- **`extract(file, options?)`** — Extract structured data from an invoice (PDF, PNG, JPG, WebP)
- **`health()`** — API health and budget status
- **`supportedFormats()`** — List supported file formats and limits

### Error Handling

```typescript
import {
  VeriCorpInvoice,
  InvalidFileError,
  RateLimitError,
  ExtractionFailedError,
} from "@vericorp/invoice-extract";

try {
  await client.extract(file);
} catch (err) {
  if (err instanceof InvalidFileError) {
    console.log("Invalid file format");
  } else if (err instanceof RateLimitError) {
    console.log("Rate limited, try again later");
  } else if (err instanceof ExtractionFailedError) {
    console.log("AI could not extract data");
  }
}
```

## License

MIT
