export interface D1PreparedLike {
  bind(...values: unknown[]): D1PreparedLike;
  run(): Promise<unknown>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1Like {
  prepare(query: string): D1PreparedLike;
  batch(statements: D1PreparedLike[]): Promise<unknown>;
}

export interface R2ObjectLike {
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2Like {
  put(
    key: string,
    value: ArrayBuffer | ReadableStream,
    options?: { httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> },
  ): Promise<unknown>;
  get(key: string): Promise<R2ObjectLike | null>;
  delete(key: string): Promise<void>;
}

type RuntimeBindings = {
  DB?: D1Like;
  FILES?: R2Like;
  APP_ENCRYPTION_KEY?: string;
};

const runtimeBindings: RuntimeBindings =
  process.env.MATHORA_SELF_HOSTED === "1"
    ? (await import("./node-bindings")).createNodeBindings()
    : ((await import("cloudflare:workers")).env as unknown as RuntimeBindings);

export function getBindings() {
  return runtimeBindings;
}

export function requireDb() {
  const db = getBindings().DB;
  if (!db) {
    throw new Error("Kho dữ liệu D1 chưa được kết nối.");
  }
  return db;
}

export function requireFiles() {
  const files = getBindings().FILES;
  if (!files) {
    throw new Error("Kho tệp R2 chưa được kết nối.");
  }
  return files;
}
