/**
 * End-to-End Simulation Flow Tests
 * Tests critical user journeys from start to finish
 */

import { test, expect } from '@playwright/test';

test.describe('Simulation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('complete simulation flow with preset selection', async ({ page }) => {
    // Step 1: Select a preset scenario
    await page.click('[data-testid="preset-baseline"]');
    await expect(page.locator('[data-testid="preset-baseline"]')).toHaveClass(/selected/i);
    
    // Step 2: Run simulation with selected preset
    await page.click('[data-testid="run-simulation"]');
    
    // Wait for simulation to complete
    await page.waitForSelector('[data-testid="simulation-results"]', { timeout: 30000 });
    await expect(page.locator('[data-testid="simulation-results"]')).toBeVisible();
    
    // Step 3: Verify results are displayed
    await expect(page.locator('[data-testid="wealth-chart"]')).toBeVisible();
    await expect(page.locator('[data-testid="comparison-results"]')).toBeVisible();
    
    // Step 4: Check for key metrics
    await expect(page.getByText(/wealth impact/i)).toBeVisible();
    await expect(page.getByText(/equality measures/i)).toBeVisible();
    await expect(page.getByText(/community health/i)).toBeVisible();
  });

  test('custom parameter setup and simulation flow', async ({ page }) => {
    // Step 1: Navigate to custom setup tab
    await page.click('[data-testid="tab-custom"]');
    await expect(page.locator('[data-testid="tab-custom"]')).toHaveAttribute('aria-selected', 'true');
    
    // Step 2: Modify parameters
    await page.fill('[data-testid="num-members"]', '50');
    await page.fill('[data-testid="weekly-income"]', '300');
    await page.fill('[data-testid="weekly-budget"]', '150');
    
    // Step 3: Run simulation with custom parameters
    await page.click('[data-testid="run-simulation"]');
    
    // Step 4: Verify simulation runs and completes
    await expect(page.locator('[data-testid="simulation-loading"]')).toBeVisible();
    await page.waitForSelector('[data-testid="simulation-loading"]', { state: 'hidden', timeout: 30000 });
    
    // Step 5: Check results display
    await expect(page.locator('[data-testid="simulation-results"]')).toBeVisible();
    await expect(page.getByText(/custom parameters/i)).toBeVisible();
  });

  test('error handling and recovery flow', async ({ page }) => {
    // Mock API failure
    await page.route('/api/simulation', route => route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Simulation failed' })
    }));
    
    // Step 1: Attempt to run simulation
    await page.click('[data-testid="run-simulation"]');
    
    // Step 2: Verify error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.getByText(/simulation failed/i)).toBeVisible();
    
    // Step 3: Verify retry button is available
    await expect(page.getByText(/retry/i)).toBeVisible();
    
    // Step 4: Test retry functionality
    await page.unroute('/api/simulation'); // Remove mock
    await page.click('[data-testid="retry-button"]');
    
    // Step 5: Verify successful simulation after retry
    await expect(page.locator('[data-testid="simulation-results"]')).toBeVisible({ timeout: 30000 });
  });

  test('responsive design on mobile devices', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    
    // Step 1: Verify mobile layout
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();
    await expect(page.getByText(/number of members/i)).toBeVisible();
    
    // Step 2: Test mobile form interaction
    await page.tap('[data-testid="num-members"]'); // Mobile tap
    await expect(page.locator('[data-testid="num-members"]')).toBeFocused();
    
    // Step 3: Verify charts adapt to mobile
    await page.click('[data-testid="tab-analysis"]');
    await expect(page.locator('[data-testid="wealth-chart"]')).toBeVisible();
    
    // Verify touch targets are at least 44px
    const sliderHandle = page.locator('[data-testid="num-members-slider"]');
    const boundingBox = await sliderHandle.boundingBox();
    expect(boundingBox.height).toBeGreaterThanOrEqual(44); // Minimum touch target
  });

  test('accessibility compliance', async ({ page }) => {
    // Step 1: Test keyboard navigation
    await page.keyboard.press('Tab'); // Navigate through tabs
    await expect(page.locator('[data-testid="tab-dashboard"]')).toBeFocused();
    
    // Step 2: Test screen reader compatibility
    const simulationButton = page.getByRole('button', { name: /run simulation/i });
    await expect(simulationButton).toHaveAttribute('aria-label');
    
    // Step 3: Test ARIA labels on form inputs
    const membersInput = page.getByLabel(/number of members/i);
    await expect(membersInput).toHaveAttribute('aria-describedby');
    
    // Step 4: Test color contrast (basic check)
    const textElements = await page.locator('[data-testid="form-text"]').all();
    for (const element of textElements) {
      const styles = await element.evaluate((el) => {
        return window.getComputedStyle(el);
      });
      const contrast = await element.evaluate((el) => {
        const color = window.getComputedStyle(el).color;
        const bgColor = window.getComputedStyle(el).backgroundColor;
        // Basic contrast check - would need more sophisticated calculation
        expect(color).not.toBe('');
        expect(bgColor).not.toBe('');
      });
    }
  });

  test('performance and loading states', async ({ page }) => {
    // Step 1: Measure initial load time
    const startTime = Date.now();
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000); // Should load in under 3 seconds
    
    // Step 2: Test loading states during simulation
    await page.click('[data-testid="run-simulation"]');
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    await expect(page.getByText(/running/i)).toBeVisible();
    
    // Step 3: Test that loading states are accessible
    const loadingButton = page.getByRole('button', { name: /running/i });
    await expect(loadingButton).toHaveAttribute('aria-busy', 'true');
    await expect(loadingButton).toBeDisabled();
  });
});