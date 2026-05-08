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
    max: 1,
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
  };
};
