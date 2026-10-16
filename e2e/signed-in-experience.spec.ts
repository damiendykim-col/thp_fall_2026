import { randomUUID } from 'node:crypto';
import { test, expect, login } from './fixtures';

test('several saved drafts stay available while other work is pending', async ({ page, accounts }, testInfo) => {
  const owner = await accounts.create();
  const { data: templates } = await accounts.admin.from('images').select('id').limit(1);
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const result = await accounts.admin.rpc('create_reviewed_challenge', {
      p_owner: owner.id, p_image_id: null, p_template: templates![0].id, p_description: 'A yellow square.',
      p_context: '', p_caption: `Draft ${i}`, p_confirmed: true, p_manual: false, p_submission: randomUUID(),
    });
    expect(result.error).toBeNull();
    ids.push(result.data);
  }
  await login(page, owner);
  await page.goto('/');
  const activity = page.getByRole('complementary', { name: 'Pick up where you left off' });
  for (const id of ids) await expect(activity.locator(`a[href="/challenges/${id}"]`)).toBeVisible();
  await page.goto(`/challenges/${ids[0]}`);
  await page.getByRole('link', { name: 'Start another', exact: true }).click();
  await expect(page).toHaveURL(/\/challenges\/new$/);
  await page.getByLabel('Image source').selectOption('template');
  await page.getByLabel('Gallery template').selectOption(templates![0].id);
  await page.getByLabel('I confirm this image description').check();
  await page.getByRole('button', { name: 'Continue to caption' }).click();
  await page.getByLabel('Your caption', { exact: true }).fill('A new contender.');
  await page.getByRole('button', { name: 'Content and AI details' }).click();
  await expect(page.locator('.info-content:popover-open')).toContainText('Your opponent sees the image and context, not your caption');
  await page.keyboard.press('Escape');
  await expect(page.locator('.info-content:popover-open')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('creation-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('creation-mobile.png'), fullPage: true });
});

test('next and previous navigate without voting and preserve an undoable ballot', async ({ page, accounts }, testInfo) => {
  const owner = await accounts.create();
  const voter = await accounts.create();
  const { data: templates } = await accounts.admin.from('images').select('id,image_url').limit(1);
  const ids: string[] = [];
  for (let i = 0; i < 2; i++) {
    const { data, error } = await accounts.admin.from('challenges').insert({
      creator_id: owner.id, template_id: templates![0].id, template_url: templates![0].image_url,
      situation: 'A square', status: 'published', closes_at: new Date(Date.now() + 86400000).toISOString(),
    }).select('id').single();
    expect(error).toBeNull(); ids.push(data!.id);
    expect((await accounts.admin.from('challenge_captions').insert([
      { challenge_id: data!.id, body: 'A human line', origin: 'human' },
      { challenge_id: data!.id, body: 'An AI line', origin: 'ai' },
    ])).error).toBeNull();
  }
  await login(page, voter);
  await page.goto(`/challenges/${ids[1]}`);
  await page.getByRole('link', { name: 'Next round →' }).click();
  await expect(page).toHaveURL(new RegExp(ids[0]));
  expect((await voter.client.from('challenge_votes').select('*')).data).toEqual([]);
  await page.getByRole('button', { name: 'Upvote', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Undo upvote' })).toBeEnabled();
  await page.getByRole('link', { name: '← Previous round' }).click();
  await page.getByRole('link', { name: 'Next round →' }).click();
  await expect(page.getByRole('button', { name: 'Undo upvote' })).toBeEnabled();
  await page.screenshot({ path: testInfo.outputPath('matchup-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('matchup-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Undo upvote' }).click();
  await expect(page.getByRole('button', { name: 'Upvote', exact: true })).toHaveCount(2);
});
