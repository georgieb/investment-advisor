/**
 * Brokerage integration contract (Stage 2).
 *
 * Stage 1 only supports manually entered holdings. Each future integration
 * (Charles Schwab / thinkorswim, etc.) implements this interface and syncs into
 * the same `accounts` and `holdings` tables, with `accounts.source` set to the
 * provider. The analysis code doesn't need to know where holdings came from.
 *
 * Security requirements for implementations:
 *   - Request read-only scopes. This app never places trades on a user's behalf
 *     without an explicit, separate confirmation flow.
 *   - OAuth access/refresh tokens are stored encrypted with Supabase Vault and
 *     are only readable from server-side code. They never reach the browser.
 *   - Sync runs server-side (Route Handler or Edge Function) as the signed-in
 *     user, so RLS still applies to every row written.
 */
import type { AssetClass } from "@/lib/portfolio/analysis";
import type { AccountType } from "@/lib/portfolio/schemas";

export type BrokerProviderId = "schwab";

export type BrokerAccount = {
  externalId: string;
  name: string;
  accountType: AccountType;
};

export type BrokerPosition = {
  externalAccountId: string;
  symbol: string;
  name: string | null;
  assetClass: AssetClass;
  quantity: number;
  currentPrice: number;
  costBasisPerUnit: number | null;
};

export interface BrokerProvider {
  id: BrokerProviderId;
  displayName: string;
  /** URL that starts the provider's OAuth consent flow. */
  authorizationUrl(state: string, redirectUri: string): string;
  /** Exchanges an OAuth code for tokens; the caller stores them in Vault. */
  exchangeCode(code: string, redirectUri: string): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }>;
  listAccounts(accessToken: string): Promise<BrokerAccount[]>;
  listPositions(accessToken: string): Promise<BrokerPosition[]>;
}
