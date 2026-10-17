/**
 * End-to-end smoke test against a running app and local Supabase stack.
 *
 *   npx supabase start
 *   npm run build && npm start -- -H 127.0.0.1
 *   npm run test:e2e
 *
 * Covers signup with email confirmation, the risk questionnaire, holdings CRUD,
 * the dashboard, and that a second user can't see the first user's data.
 * Needs a Chromium binary: set CHROMIUM_PATH, or install one with
 * `npx playwright install chromium`.
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const MAIL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";
const shots = process.env.SCREENSHOT_DIR;

async function confirmLink(email) {
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent("to:" + email)}`);
    const { messages } = await res.json();
    if (messages?.length) {
      const msg = await (await fetch(`${MAIL}/api/v1/message/${messages[0].ID}`)).json();
      const m = msg.HTML.match(/href="([^"]+)"/);
      return m[1].replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("no email");
}

async function signUpAndConfirm(page, email, password) {
  await page.goto(`${BASE}/signup`);
  await page.fill("input[name=email]", email);
  await page.evaluate(() => document.querySelector("form").setAttribute("novalidate", ""));
  await page.fill("input[name=password]", "short");
  await page.click("button[type=submit]");
  await page.waitForSelector("text=Use at least 12 characters");
  if ((await page.inputValue("input[name=email]")) !== email) throw new Error("email not preserved after error");
  await page.fill("input[name=password]", password);
  await page.click("button[type=submit]");
  await page.waitForSelector("text=Check your email");
  const link = await confirmLink(email);
  console.log("confirm link:", link.slice(0, 120));
  await page.goto(link);
  await page.waitForURL(/\/profile/, { timeout: 15000 });
  console.log("after confirm:", page.url());
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));

const alice = `alice${Date.now()}@example.com`;
const pw = "CorrectHorse42Battery";
await signUpAndConfirm(page, alice, pw);

// Risk profile
const nums = { age: 38, retirementAge: 65, annualIncome: 150000, emergencyFundMonths: 6, currentRetirementSavings: 180000, monthlyContribution: 1500, retirementGoal: 2500000 };
for (const [k, v] of Object.entries(nums)) await page.fill(`input[name=${k}]`, String(v));
for (const [k, v] of Object.entries({ incomeStability: "stable", withdrawalNeed: "gt_20", primaryGoal: "growth", experience: "moderate", drawdownReaction: "hold", tradeoff: "c" }))
  await page.check(`input[name=${k}][value=${v}]`);
await page.click("text=Save and calculate my risk level");
await page.waitForSelector("text=Your risk profile has been saved.");
await page.waitForSelector("text=Your result");
console.log("risk level:", await page.locator("section:has-text('Your result') p.text-2xl").innerText());
if (shots) await page.screenshot({ path: `${shots}/profile.png`, fullPage: true });

// Holdings
await page.goto(`${BASE}/holdings`);
await page.fill("input[name=name]", "Schwab Brokerage");
await page.selectOption("select[name=accountType]", "taxable");
await page.fill("input[name=institution]", "Charles Schwab");
await page.click("text=Add account");
await page.waitForSelector("text=Account added.");
await page.fill("input[name=name]", "Roth IRA");
await page.selectOption("select[name=accountType]", "roth_ira");
await page.click("text=Add account");
await page.waitForSelector("h2:has-text('Roth IRA')");

const holdings = [
  ["Schwab Brokerage", "VTI", "us_equity", 300, 290, 210],
  ["Schwab Brokerage", "NVDA", "us_equity", 120, 180, 40],
  ["Roth IRA", "VXUS", "intl_equity", 250, 68, 60],
  ["Roth IRA", "BND", "bond", 200, 73, 75],
];
for (const [acct, sym, cls, qty, price, basis] of holdings) {
  await page.selectOption("select[name=accountId]", { label: acct });
  await page.fill("input[name=symbol]", sym.toLowerCase());
  await page.selectOption("select[name=assetClass]", cls);
  await page.fill("input[name=quantity]", String(qty));
  await page.fill("input[name=currentPrice]", String(price));
  await page.fill("input[name=costBasisPerUnit]", String(basis));
  await page.click("text=Add holding");
  await page.waitForSelector(`text=${sym} added.`);
}
// Invalid symbol keeps the input
await page.fill("input[name=symbol]", "BAD SYMBOL!");
await page.fill("input[name=quantity]", "1");
await page.fill("input[name=currentPrice]", "1");
await page.click("text=Add holding");
await page.waitForSelector("text=Use the ticker symbol");
console.log("symbol kept after error:", await page.inputValue("input[name=symbol]"));

// Edit a holding
await page.locator("tr:has-text('NVDA') >> text=Edit").click();
await page.waitForURL(/\/edit$/);
await page.fill("input[name=quantity]", "100");
await page.click("text=Save changes");
await page.waitForURL(/\/holdings$/);
console.log("NVDA row:", await page.locator("tr:has-text('NVDA')").innerText());
if (shots) await page.screenshot({ path: `${shots}/holdings.png`, fullPage: true });

// Dashboard
await page.goto(`${BASE}/dashboard`);
await page.waitForSelector("text=Suggested moves");
console.log("stats:", (await page.locator("div.grid >> nth=0").innerText()).replaceAll("\n", " | "));
console.log("suggestions:\n  " + (await page.locator("section:has-text('Suggested moves') li").allInnerTexts()).map((t) => t.replaceAll("\n", " — ")).join("\n  "));
if (shots) await page.screenshot({ path: `${shots}/dashboard.png`, fullPage: true });
const aliceHoldingUrl = await (async () => {
  await page.goto(`${BASE}/holdings`);
  return BASE + (await page.locator("tr:has-text('VTI') >> text=Edit").getAttribute("href"));
})();

// Sign out, then confirm protected pages redirect
await page.click("text=Sign out");
await page.waitForURL(/\/login/);
await page.goto(`${BASE}/dashboard`);
console.log("after sign out, /dashboard ->", page.url());

// A second user must not see Alice's data, even by URL
const ctx2 = await browser.newContext();
const page2 = await ctx2.newPage();
const bob = `bob${Date.now()}@example.com`;
await signUpAndConfirm(page2, bob, pw);
await page2.goto(`${BASE}/holdings`);
console.log("bob sees VTI?", (await page2.content()).includes("VTI"), (await page2.locator("main").innerText()).includes("VTI"));
await page2.goto(aliceHoldingUrl);
const body = await page2.locator("main").innerText();
console.log("bob opening alice's holding edit URL shows:", JSON.stringify(body.slice(0, 120)), "| leaks VTI?", (await page2.content()).includes("VTI"));
await page2.goto(`${BASE}/dashboard`);
console.log("bob dashboard value:", await page2.locator("text=Portfolio value >> xpath=..").innerText());

// Sign in flow with wrong + right password
const ctx3 = await browser.newContext();
const page3 = await ctx3.newPage();
await page3.goto(`${BASE}/login?next=/holdings`);
await page3.fill("input[name=email]", alice);
await page3.fill("input[name=password]", "WrongPassword123");
await page3.click("button[type=submit]");
await page3.waitForSelector("text=Incorrect email or password");
await page3.fill("input[name=password]", pw);
await page3.click("button[type=submit]");
await page3.waitForURL((u) => new URL(u).pathname === "/holdings");
console.log("login with next ->", page3.url());
await page3.goto(`${BASE}/login?next=//evil.com`);
await page3.waitForURL((u) => new URL(u).pathname === "/dashboard");
console.log("signed-in user visiting /login ->", page3.url());

// Delete: cancelling keeps the account, accepting deletes the holding
await page3.goto(`${BASE}/holdings`);
page3.once("dialog", (d) => d.dismiss());
await page3.locator("section:has-text('Roth IRA') >> text=Delete account").click();
await page3.waitForTimeout(500);
console.log("Roth IRA still there after cancel:", await page3.locator("h2:has-text('Roth IRA')").count() === 1);
page3.once("dialog", (d) => d.accept());
await page3.locator("tr:has-text('BND') >> text=Delete").click();
await page3.waitForSelector("tr:has-text('BND')", { state: "detached" });
console.log("BND deleted");
page3.once("dialog", (d) => d.accept());
await page3.locator("section:has-text('Roth IRA') >> text=Delete account").click();
await page3.waitForSelector("h2:has-text('Roth IRA')", { state: "detached" });
console.log("Roth IRA deleted, VXUS gone:", !(await page3.locator("main").innerText()).includes("VXUS"));

await browser.close();
console.log("E2E OK");
