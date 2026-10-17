/**
 * Runs the real Supabase migration against an embedded Postgres (PGlite) with a
 * minimal stand-in for Supabase's `auth` schema, then verifies that Row Level
 * Security isolates every user's data from every other user and from anonymous
 * visitors.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");

const ALICE = "00000000-0000-0000-0000-00000000a11c";
const BOB = "00000000-0000-0000-0000-000000000b0b";

// Mirrors the parts of Supabase's auth schema the migration depends on.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

let db: PGlite;

/** Runs `fn` as the given Supabase role, impersonating `userId` if provided. */
async function as<T>(
  role: "anon" | "authenticated",
  userId: string | null,
  fn: (tx: Pick<PGlite, "query" | "exec">) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ""]);
    return fn(tx);
  });
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }

  // Sign up two users (fires the profile trigger) and give each some data.
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'alice@example.com', '{"display_name":"Alice"}'),
       ($2, 'bob@example.com', '{}')`,
    [ALICE, BOB],
  );
  for (const [userId, symbol] of [
    [ALICE, "VTI"],
    [BOB, "BND"],
  ]) {
    await as("authenticated", userId, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.accounts (user_id, name, account_type)
         values ($1, 'Brokerage', 'taxable') returning id`,
        [userId],
      );
      await tx.query(
        `insert into public.holdings (user_id, account_id, symbol, asset_class, quantity, current_price)
         values ($1, $2, $3, 'us_equity', 10, 100)`,
        [userId, rows[0].id, symbol],
      );
      await tx.query(
        `insert into public.risk_profiles (user_id, age, retirement_age, annual_income,
           emergency_fund_months, current_retirement_savings, monthly_contribution,
           retirement_goal, capacity_score, tolerance_score, risk_score, risk_level)
         values ($1, 35, 65, 100000, 6, 50000, 1000, 1500000, 60, 60, 60, 'moderately_aggressive')`,
        [userId],
      );
    });
  }
});

afterAll(async () => {
  await db?.close();
});

describe("row level security", () => {
  it("creates a profile for each new user", async () => {
    const { rows } = await db.query<{ id: string; display_name: string | null }>(
      "select id, display_name from public.profiles order by display_name nulls last",
    );
    expect(rows).toEqual([
      { id: ALICE, display_name: "Alice" },
      { id: BOB, display_name: null },
    ]);
  });

  it("only shows a user their own rows", async () => {
    await as("authenticated", ALICE, async (tx) => {
      for (const table of ["profiles", "risk_profiles", "accounts", "holdings"]) {
        const col = table === "profiles" ? "id" : "user_id";
        const { rows } = await tx.query<{ owner: string }>(
          `select ${col} as owner from public.${table}`,
        );
        expect(rows.length, table).toBeGreaterThan(0);
        expect(rows.every((r) => r.owner === ALICE), table).toBe(true);
      }
      const { rows } = await tx.query<{ symbol: string }>("select symbol from public.holdings");
      expect(rows.map((r) => r.symbol)).toEqual(["VTI"]);
    });
  });

  it("denies anonymous visitors any access", async () => {
    for (const table of ["profiles", "risk_profiles", "accounts", "holdings"]) {
      await expect(
        as("anon", null, (tx) => tx.query(`select * from public.${table}`)),
        table,
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("returns nothing to an authenticated request without a user id", async () => {
    const { rows } = await as("authenticated", null, (tx) =>
      tx.query("select * from public.holdings"),
    );
    expect(rows).toEqual([]);
  });

  it("prevents creating rows on behalf of another user", async () => {
    await expect(
      as("authenticated", ALICE, (tx) =>
        tx.query(
          `insert into public.accounts (user_id, name, account_type) values ($1, 'Sneaky', 'taxable')`,
          [BOB],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("prevents attaching a holding to another user's account", async () => {
    const { rows } = await db.query<{ id: string }>(
      "select id from public.accounts where user_id = $1",
      [BOB],
    );
    await expect(
      as("authenticated", ALICE, (tx) =>
        tx.query(
          `insert into public.holdings (user_id, account_id, symbol, asset_class, quantity, current_price)
           values ($1, $2, 'AAPL', 'us_equity', 1, 1)`,
          [ALICE, rows[0].id],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("prevents updating or deleting another user's rows", async () => {
    await as("authenticated", ALICE, async (tx) => {
      const updated = await tx.query(
        "update public.holdings set quantity = 0 where user_id = $1",
        [BOB],
      );
      expect(updated.affectedRows).toBe(0);
      const deleted = await tx.query("delete from public.accounts where user_id = $1", [BOB]);
      expect(deleted.affectedRows).toBe(0);
    });
    const { rows } = await db.query<{ quantity: string }>(
      "select quantity from public.holdings where user_id = $1",
      [BOB],
    );
    expect(Number(rows[0].quantity)).toBe(10);
  });

  it("prevents handing a row over to another user", async () => {
    await expect(
      as("authenticated", ALICE, (tx) =>
        tx.query("update public.holdings set user_id = $1 where user_id = $2", [BOB, ALICE]),
      ),
    ).rejects.toThrow(/row-level security|foreign key/);
  });

  it("does not let users call the signup trigger function directly", async () => {
    await expect(
      as("authenticated", ALICE, (tx) => tx.query("select public.handle_new_user()")),
    ).rejects.toThrow();
  });
});
