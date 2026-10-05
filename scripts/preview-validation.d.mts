export interface LocalMigration { name: string; sql: string | Uint8Array; }
export interface MigrationHistory {
  name: string;
  checksum: string;
  tables: string[];
  indexes: Array<{ name: string; unique: boolean }>;
  constraints: string[];
}
export interface CliResult {
  status: number | null;
  signal?: string | null;
  error?: unknown;
  stdout?: string | null;
  stderr?: string | null;
}
export const REVIEWED_MIGRATIONS: ReadonlyArray<Readonly<{ name: string; checksum: string }>>;
export function reviewedMigrationHistory(entries: LocalMigration[]): MigrationHistory[];
export function validatePreviewConnections(direct: string | undefined, pooled: string | undefined, endpoint: string | undefined): void;
export function withValidatedPreview<T>(input: {
  endpoint?: string; branch?: string; direct?: string; pooled?: string; migrations: LocalMigration[];
}, work: (verified: { history: MigrationHistory[] }) => T): T;
export function requireCliSuccess(result: CliResult, command: string): void;
export function classifyMigrationStatus(result: CliResult, pending: string[]): "up-to-date" | "pending";
