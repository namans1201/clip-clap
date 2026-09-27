import { test, expect, type Page } from '@playwright/test';

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD;
const hasCredentials = !!(TEST_EMAIL && TEST_PASSWORD);

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_EMAIL!);
  await page.fill('input[type="password"]', TEST_PASSWORD!);
  await page.getByRole('button', { name: /let's go/i }).click();
  await page.waitForURL((url) => url.pathname === '/', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

// ─────────────────────────────────────────────
// LOGIN PAGE (no auth needed)
// ─────────────────────────────────────────────
test.describe('Login page', () => {
  test('renders the login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /let's go/i })).toBeVisible();
  });

  test('shows public/shared device toggle', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText(/public/i)).toBeVisible();
  });

  test('rejects empty form submission', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /let's go/i }).click();
    await expect(page).toHaveURL('/login');
  });
});

// ─────────────────────────────────────────────
// PROFILE BUTTON (no auth needed, login page only)
// ─────────────────────────────────────────────
test.describe('Profile button on login page', () => {
  test('GET /api/profile returns valid profile data', async ({ request }) => {
    const res = await request.get('/api/profile');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.name).toBeTruthy();
    expect(body.tagline).toBeTruthy();
    expect(body.avatar).toMatch(/^\//);
    expect(body.socials).toBeTruthy();
  });

  test('FAB is visible at bottom-right of login page', async ({ page }) => {
    await page.goto('/login');
    const fab = page.getByTestId('profile-button');
    await expect(fab).toBeVisible();
    const box = await fab.boundingBox();
    const vp  = page.viewportSize();
    expect(box && vp).toBeTruthy();
    // bottom-right anchored
    expect(box!.x + box!.width).toBeGreaterThan(vp!.width  - 80);
    expect(box!.y + box!.height).toBeGreaterThan(vp!.height - 80);
  });

  test('clicking the FAB opens the profile modal with card', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('profile-button').click();
    await expect(page.getByTestId('profile-modal')).toBeVisible();
    await expect(page.getByTestId('profile-card')).toBeVisible();
    // name from API is rendered
    await expect(page.getByText(/Naman Shrimal/i)).toBeVisible();
  });

  test('close button dismisses the modal', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('profile-button').click();
    await expect(page.getByTestId('profile-modal')).toBeVisible();
    await page.getByTestId('profile-close').click();
    await expect(page.getByTestId('profile-modal')).not.toBeVisible();
  });

  test('Escape key closes the modal', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('profile-button').click();
    await expect(page.getByTestId('profile-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('profile-modal')).not.toBeVisible();
  });

  test('profile FAB does NOT appear on protected routes (redirects to /login but still only login shows it)', async ({ page }) => {
    // /pinned redirects to /login (we already tested this elsewhere)
    // The FAB should be present because we ended up on /login
    await page.goto('/pinned');
    await expect(page).toHaveURL('/login');
    await expect(page.getByTestId('profile-button')).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// AUTHENTICATION
// ─────────────────────────────────────────────
test.describe('Authentication', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });

  test('redirects /pinned to login when unauthenticated', async ({ page }) => {
    await page.goto('/pinned');
    await expect(page).toHaveURL('/login');
  });

  test('redirects /trash to login when unauthenticated', async ({ page }) => {
    await page.goto('/trash');
    await expect(page).toHaveURL('/login');
  });

  test.describe('with credentials', () => {
    test.skip(!hasCredentials, 'TEST_EMAIL / TEST_PASSWORD not set in .env.test');

    test('logs in successfully', async ({ page }) => {
      await login(page);
      await expect(page).toHaveURL('/');
    });

    test('redirects authenticated user away from /login', async ({ page }) => {
      await login(page);
      await page.goto('/login');
      await expect(page).toHaveURL('/');
    });
  });
});

// ─────────────────────────────────────────────
// DASHBOARD (requires auth)
// ─────────────────────────────────────────────
test.describe('Dashboard', () => {
  test.skip(!hasCredentials, 'TEST_EMAIL / TEST_PASSWORD not set in .env.test');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('renders sidebar with navigation links', async ({ page }) => {
    await expect(page.getByRole('link', { name: /all clips/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /pinned/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /trash/i })).toBeVisible();
  });

  test('renders search bar', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  test('renders new clip button', async ({ page }) => {
    await expect(page.locator('button[aria-label="Add New Clip"]')).toBeVisible();
  });

  test('renders lock button', async ({ page }) => {
    // The lock button's inner <button> carries FingerprintButton's own
    // aria-label ("Press to scan fingerprint") since the visual redesign
    // in the "Prod Ready" commit — LockButton itself is just a wrapping
    // <div onClick> with no aria-label of its own. See lock-button.tsx.
    await expect(page.locator('button[aria-label="Press to scan fingerprint"]')).toBeVisible();
  });

  test('search filters clips with debounce', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('zzz_no_match_xyz');
    // Wait for the 200ms debounce + render
    await page.waitForTimeout(400);
    await expect(page.getByText(/no clips match/i)).toBeVisible();
  });

  test('clears search and shows all clips', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('zzz_no_match_xyz');
    await page.waitForTimeout(400);
    await searchInput.fill('');
    await page.waitForTimeout(400);
    await expect(page.getByText(/no clips match/i)).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────
// CLIP MANAGEMENT (requires auth)
// ─────────────────────────────────────────────
test.describe('Clip Management', () => {
  test.skip(!hasCredentials, 'TEST_EMAIL / TEST_PASSWORD not set in .env.test');

  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.waitForLoadState('networkidle');
  });

  test('opens new clip dialog', async ({ page }) => {
    await page.locator('button[aria-label="Add New Clip"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
  });

  test('creates a new clip', async ({ page }) => {
    await page.locator('button[aria-label="Add New Clip"]').click();
    await page.waitForSelector('textarea', { state: 'visible' });
    await page.fill('textarea', 'E2E test clip content');
    await page.getByRole('button', { name: /create clip/i }).click();
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 });
  });

  test('cancels new clip dialog', async ({ page }) => {
    await page.locator('button[aria-label="Add New Clip"]').click();
    await page.waitForSelector('textarea', { state: 'visible' });
    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('soft-deletes a clip and finds it in trash', async ({ page }) => {
    // Ensure there's a clip to delete
    await page.locator('button[aria-label="Add New Clip"]').click();
    await page.waitForSelector('textarea', { state: 'visible' });
    await page.fill('textarea', 'Clip to be deleted E2E');
    await page.getByRole('button', { name: /create clip/i }).click();
    await page.waitForTimeout(500);

    const firstClip = page.getByTestId('clip-card').first();
    await firstClip.waitFor({ state: 'visible' });
    if ((page.viewportSize()?.width ?? 0) >= 640) await firstClip.hover();
    await firstClip.locator('button[title*="Delete"]').first().click();
    await expect(page.locator('[data-sonner-toast]')).toBeVisible({ timeout: 5000 });

    await page.getByRole('link', { name: /trash/i }).click();
    await page.waitForURL('/trash');
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('clip-card').first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────
// NAVIGATION (requires auth)
// ─────────────────────────────────────────────
test.describe('Navigation', () => {
  test.skip(!hasCredentials, 'TEST_EMAIL / TEST_PASSWORD not set in .env.test');

  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('navigates to pinned page', async ({ page }) => {
    await page.getByRole('link', { name: /pinned/i }).click();
    await expect(page).toHaveURL('/pinned');
  });

  test('navigates to trash page', async ({ page }) => {
    await page.getByRole('link', { name: /trash/i }).click();
    await expect(page).toHaveURL('/trash');
  });

  test('navigates back to all clips', async ({ page }) => {
    await page.getByRole('link', { name: /pinned/i }).click();
    await page.getByRole('link', { name: /all clips/i }).click();
    await expect(page).toHaveURL('/');
  });
});

// ─────────────────────────────────────────────
// LOCK / LOGOUT (requires auth)
// ─────────────────────────────────────────────
test.describe('Lock & Logout', () => {
  test.skip(!hasCredentials, 'TEST_EMAIL / TEST_PASSWORD not set in .env.test');

  test('lock button logs out and redirects to login', async ({ page }) => {
    await login(page);
    // See the "renders lock button" test above for why this targets
    // FingerprintButton's aria-label rather than "Lock & logout".
    await page.locator('button[aria-label="Press to scan fingerprint"]').click();
    await expect(page).toHaveURL('/login', { timeout: 10000 });
  });
});
