import { expect, test } from "@playwright/test";

test("public Home exposes the Phase 1 shell without secrets", async ({
  page,
}) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: "FUMIBRO" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "メインナビゲーション" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "FUMIBROに質問" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "準備中" })).toBeDisabled();
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();

  const html = await page.locator("html").textContent();
  expect(html).not.toContain("SUPABASE_SECRET_KEY");
  expect(html).not.toContain("VISITOR_HMAC_SECRET");
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["strict-transport-security"]).toBe(
    "max-age=31536000",
  );
});

test("signed-out Admin is redirected to the login form", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin/u);
  await expect(
    page.getByRole("heading", { name: "管理者ログイン" }),
  ).toBeVisible();
  await expect(page.getByLabel("メールアドレス")).toBeVisible();
  await expect(page.getByLabel("パスワード")).toBeVisible();
});

test("invalid recovery credentials fail closed", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=invalid&type=signup");
  await expect(page).toHaveURL(/\/admin\/forgot-password\?error=invalid_link/u);
  await expect(
    page.getByText("リセットリンクが無効または期限切れです。"),
  ).toBeVisible();
});

test("password form requires an authenticated Admin recovery session", async ({
  page,
}) => {
  await page.goto("/admin/update-password");
  await expect(page).toHaveURL(/\/admin\/forgot-password\?error=invalid_link/u);
  await expect(page.getByLabel("新しいパスワード")).toHaveCount(0);
});

test("login explains a completed password update", async ({ page }) => {
  await page.goto("/admin/login?password_updated=1");
  await expect(
    page.getByText(
      "パスワードを更新しました。新しいパスワードでログインしてください。",
    ),
  ).toBeVisible();
});

test("layout does not overflow the active viewport", async ({ page }) => {
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(
    dimensions.clientWidth + 1,
  );
});
