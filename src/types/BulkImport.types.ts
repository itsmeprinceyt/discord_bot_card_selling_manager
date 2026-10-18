export interface BulkImportResult {
  imported: number;
  duplicates: number;
  errors: number;
  skipped: number;
  errorDetails: string[];
}
