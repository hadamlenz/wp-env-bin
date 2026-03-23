import { chromium, FullConfig } from '@playwright/test';
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth/admin.json');

setup('authenticate as WordPress admin', async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/wp-login.php`);
    console.log(`log in at ${baseURL}`)
    await page.getByLabel('Username or Email Address').fill('admin');
    await page.getByLabel('Password', { exact: true }).fill('password');
    await page.getByRole('button', { name: 'Log In' }).click();

    // Fail loudly if login didn't work
    await expect(
        page.locator('#login_error'),
        'WordPress login failed — check credentials and that wp-env is running'
    ).not.toBeVisible();

    await page.waitForURL('**/wp-admin/**');
    await expect(page.locator('#wpadminbar')).toBeVisible();

    // Save the authenticated session
    await page.context().storageState({ path: authFile });

    console.log('✅ WordPress login successful — session saved.');
});