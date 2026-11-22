import { expect, test } from '@playwright/test';

// One full flow on a mobile viewport, with no API keys (the app must still work end to end):
// example note -> review cards -> resolve "Kaun se Sharma?" -> save -> Kal ka kaam -> Poochho answer -> undo.
test('example note to saved entries to Kal ka kaam to Poochho', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Hindi / Hinglish' }).click();
  await expect(page.getByRole('button', { name: 'Bolna shuru karo' })).toBeVisible();
  await expect(page.getByText('Offline mode')).toBeVisible(); // no keys in preview -> offline chip, no error screen

  await page.getByRole('button', { name: 'Example se try karo' }).click();
  await expect(page.getByRole('heading', { name: 'Check karo, phir save' })).toBeVisible();
  const cards = page.locator('.card.entry');
  await expect(cards).toHaveCount(6);
  // the correction "150 ... nahi 250" became 250
  await expect(cards.nth(5)).toContainText('₹250');
  // two Sharmas in the ledger -> must choose before saving
  await expect(page.getByText(/Kaun se Sharma\?/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sab sahi hai, save karo' })).toBeDisabled();
  await page.getByRole('button', { name: 'Sharma ji', exact: true }).click();
  await expect(page.getByText(/Kaun se Sharma\?/)).toHaveCount(0);
  // "Gupta ji" (customer order) must not be silently linked to supplier "Gupta Traders"
  await expect(page.getByText(/Kaun se Gupta ji\? Gupta Traders ya Naya naam\?/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sab sahi hai, save karo' })).toBeDisabled();
  await page.getByRole('button', { name: 'Naya naam' }).click();
  await page.getByRole('button', { name: 'Sab sahi hai, save karo' }).click();
  await expect(page.getByText('Save ho gaya.')).toBeVisible();

  // Kal ka kaam: Ramesh was overdue in the sample ledger; Gupta Traders due tomorrow; reorder list
  await expect(page.getByRole('heading', { name: 'Kal ka kaam' })).toBeVisible();
  await expect(page.getByText('Ramesh distributor ko dena')).toBeVisible();
  await expect(page.getByText(/Mangwana hai \(4\)/)).toBeVisible();
  await expect(page.getByTestId('total-dena')).toHaveText('₹14,000'); // 3200+5000 + 1800 + (6000-2000)
  await expect(page.locator('#h-kal').locator('..').getByText('Gupta ji ka order')).toBeVisible();
  await expect(page.getByText('Gupta Traders ka order')).toHaveCount(0);

  // Poochho answers only from saved data
  await page.getByRole('navigation').getByRole('button', { name: 'Poochho' }).click();
  await page.getByPlaceholder('Sharma ji ka kitna baaki hai?').fill('Sharma ji ka kitna baaki hai?');
  await page.getByRole('main').getByRole('button', { name: 'Poochho', exact: true }).click();
  await expect(page.locator('.ans-text')).toHaveText('Sharma ji ka ₹650 udhaar baaki hai.');

  // Khata one-tap action + undo
  await page.getByRole('navigation').getByRole('button', { name: 'Khata' }).click();
  const before = await page.getByTestId('total-dena').textContent();
  await page.getByRole('button', { name: 'Paid' }).first().click();
  await expect(page.getByText('Payment likh diya.')).toBeVisible();
  await page.getByRole('button', { name: /Wapas lo/ }).click();
  await expect(page.getByTestId('total-dena')).toHaveText(before!);
});

test('typing fallback works and nothing is saved without confirmation', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Type instead' }).click();
  await page.getByRole('textbox').fill('Owe Ramesh 5000 by Friday, sugar finished');
  await page.getByRole('button', { name: 'Understand and show' }).click();
  await expect(page.locator('.card.entry')).toHaveCount(2);
  await expect(page.getByTestId('total-dena')).toHaveText('₹0'); // not saved yet
  await page.reload();
  await expect(page.locator('.card.entry')).toHaveCount(2); // draft survives reload
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.locator('.card.entry')).toHaveCount(0);
  await expect(page.getByTestId('total-dena')).toHaveText('₹0');
});
