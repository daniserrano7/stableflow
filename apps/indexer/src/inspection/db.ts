import type { QueryResultRow } from "pg";
import pg from "pg";
import { env } from "../env/env.js";

const { Pool } = pg;

export type ReadOnlyDb = {
  close: () => Promise<void>;
  query: <Row extends QueryResultRow>(text: string, values?: unknown[]) => Promise<Row[]>;
};

export type OperatorDb = ReadOnlyDb & {
  execute: <Row extends QueryResultRow>(text: string, values?: unknown[]) => Promise<Row[]>;
  tryAdvisoryLock: (key1: number, key2: number) => Promise<(() => Promise<void>) | null>;
};

const assertReadOnlyQuery = (text: string) => {
  const normalizedText = text.trim().toLowerCase();

  if (!normalizedText.startsWith("select") && !normalizedText.startsWith("with")) {
    throw new Error("Inspection queries must be read-only SELECT statements");
  }
};

const createPool = (applicationName: string) =>
  new Pool({
    application_name: applicationName,
    connectionString: env.DATABASE_URL,
    max: 1,
  });

export const createReadOnlyDb = (): ReadOnlyDb => {
  const pool = createPool("stableflow-indexer-inspection");

  return {
    close: () => pool.end(),
    query: async <Row extends QueryResultRow>(text: string, values: unknown[] = []) => {
      assertReadOnlyQuery(text);

      const result = await pool.query<Row>(text, values);
      return result.rows;
    },
  };
};

export const createOperatorDb = (): OperatorDb => {
  const pool = new Pool({
    application_name: "stableflow-indexer-label-operator",
    connectionString: env.DATABASE_URL,
    max: 2,
  });

  return {
    close: () => pool.end(),
    execute: async <Row extends QueryResultRow>(text: string, values: unknown[] = []) => {
      const result = await pool.query<Row>(text, values);
      return result.rows;
    },
    query: async <Row extends QueryResultRow>(text: string, values: unknown[] = []) => {
      assertReadOnlyQuery(text);

      const result = await pool.query<Row>(text, values);
      return result.rows;
    },
    tryAdvisoryLock: async (key1, key2) => {
      const client = await pool.connect();

      try {
        const result = await client.query<{ acquired: boolean }>(
          "select pg_try_advisory_lock($1::integer, $2::integer) as acquired",
          [key1, key2],
        );

        if (result.rows[0]?.acquired !== true) {
          client.release();
          return null;
        }

        return async () => {
          try {
            await client.query("select pg_advisory_unlock($1::integer, $2::integer)", [key1, key2]);
          } finally {
            client.release();
          }
        };
      } catch (error) {
        client.release();
        throw error;
      }
    },
  };
};
