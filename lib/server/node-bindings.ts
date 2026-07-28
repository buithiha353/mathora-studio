import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DatabaseSync,
  type SQLInputValue,
} from "node:sqlite";
import type {
  D1Like,
  D1PreparedLike,
  R2Like,
  R2ObjectLike,
} from "./bindings";

class NodePreparedStatement implements D1PreparedLike {
  private values: SQLInputValue[] = [];

  constructor(
    private readonly database: DatabaseSync,
    private readonly query: string,
  ) {}

  private statement() {
    return this.database.prepare(this.query);
  }

  bind(...values: unknown[]) {
    this.values = values as SQLInputValue[];
    return this;
  }

  async run() {
    return this.statement().run(...this.values);
  }

  async first<T = Record<string, unknown>>() {
    return (this.statement().get(...this.values) as T | undefined) ?? null;
  }

  async all<T = Record<string, unknown>>() {
    return { results: this.statement().all(...this.values) as T[] };
  }
}

class NodeDatabase implements D1Like {
  constructor(private readonly database: DatabaseSync) {}

  prepare(query: string) {
    return new NodePreparedStatement(this.database, query);
  }

  async batch(statements: D1PreparedLike[]) {
    this.database.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

class LocalObject implements R2ObjectLike {
  constructor(private readonly filePath: string) {}

  async arrayBuffer() {
    const bytes = readFileSync(this.filePath);
    return bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    );
  }
}

class LocalFiles implements R2Like {
  constructor(private readonly root: string) {
    mkdirSync(root, { recursive: true });
  }

  private resolveKey(key: string) {
    const target = path.resolve(this.root, key);
    const rootPrefix = `${path.resolve(this.root)}${path.sep}`;
    if (!target.startsWith(rootPrefix)) {
      throw new Error("Đường dẫn tệp không hợp lệ.");
    }
    return target;
  }

  async put(key: string, value: ArrayBuffer | ReadableStream) {
    if (value instanceof ReadableStream) {
      throw new Error("Máy chủ Node chưa hỗ trợ ghi luồng trực tiếp.");
    }
    const target = this.resolveKey(key);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(value));
  }

  async get(key: string) {
    try {
      return new LocalObject(this.resolveKey(key));
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return null;
      }
      throw error;
    }
  }

  async delete(key: string) {
    rmSync(this.resolveKey(key), { force: true });
  }
}

export function createNodeBindings() {
  const dataDir = path.resolve(
    process.env.MATHORA_DATA_DIR ?? path.join(process.cwd(), "data"),
  );
  const uploadDir = path.resolve(
    process.env.MATHORA_UPLOAD_DIR ?? path.join(process.cwd(), "uploads"),
  );
  mkdirSync(dataDir, { recursive: true });

  const database = new DatabaseSync(path.join(dataDir, "mathora.sqlite"));
  database.exec("PRAGMA journal_mode=WAL");
  database.exec("PRAGMA busy_timeout=5000");

  return {
    DB: new NodeDatabase(database),
    FILES: new LocalFiles(uploadDir),
    APP_ENCRYPTION_KEY: process.env.APP_ENCRYPTION_KEY,
  };
}
