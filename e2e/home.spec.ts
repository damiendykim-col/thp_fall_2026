import { test, expect } from './fixtures';

test('signed-out home demonstrates the challenge and keeps account and legacy sections out of navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Can you out-caption AI?' })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: /Images|Members|Profile/ })).toHaveCount(0);
  const example = page.getByRole('region', { name: 'Example challenge' });
  const caption = example.getByRole('button').first();
  await caption.click();
  await expect(caption).toHaveAttribute('aria-pressed', 'true');
  await caption.click();
  await expect(caption).toHaveAttribute('aria-pressed', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav.getByRole('link', { name: 'Create challenge' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('sign-in to create survives onboarding and account controls stay accessible', async ({ page, accounts }) => {
  const account = await accounts.create();
  await page.goto('/');
  await page.getByRole('link', { name: 'Create challenge' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Fchallenges%2Fnew$/);
  await page.getByLabel('Test email', { exact: true }).fill(account.email);
  await page.getByLabel('Test password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in with test account' }).click();
  await expect(page).toHaveURL(/\/profile\?next=%2Fchallenges%2Fnew$/);
  await page.getByRole('textbox', { name: 'First name', exact: true }).fill('Test');
  await page.getByRole('textbox', { name: 'Last name', exact: true }).fill('Person');
  await page.getByRole('button', { name: 'Save profile', exact: true }).click();
  await page.getByRole('link', { name: 'Continue to challenges' }).click();
  await expect(page).toHaveURL(/\/challenges\/new$/);
  await page.getByText('Account', { exact: true }).click();
  await expect(page.getByRole('link', { name: 'Profile', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Moderation', exact: true })).toHaveCount(0);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Yours', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Results', exact: true })).toBeVisible();
});

test('an established member returns to a linked challenge after sign-in without casting a vote', async ({ page, accounts }) => {
  const owner = await accounts.create();
  const viewer = await accounts.create();
  expect((await accounts.admin.from('profiles').update({ first_name: 'Test', last_name: 'Member' }).eq('id', viewer.id)).error).toBeNull();
  const { data: templates } = await accounts.admin.from('images').select('id,image_url').limit(1);
  const { data: challenge, error } = await accounts.admin.from('challenges').insert({ creator_id: owner.id, template_id: templates![0].id, template_url: templates![0].image_url, situation: 'A round worth returning to', status: 'published', closes_at: new Date(Date.now() + 60000).toISOString() }).select('id').single();
  expect(error).toBeNull();
  expect((await accounts.admin.from('challenge_captions').insert([{ challenge_id: challenge!.id, body: 'First option', origin: 'human' }, { challenge_id: challenge!.id, body: 'Second option', origin: 'ai' }])).error).toBeNull();
  await page.goto(`/challenges/${challenge!.id}`);
  await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Fchallenges%2F${challenge!.id}$`));
  await page.getByLabel('Test email', { exact: true }).fill(viewer.email);
  await page.getByLabel('Test password', { exact: true }).fill(viewer.password);
  await page.getByRole('button', { name: 'Sign in with test account' }).click();
  await expect(page).toHaveURL(new RegExp(`/challenges/${challenge!.id}$`));
  await expect(page.getByRole('button', { name: 'Upvote', exact: true })).toHaveCount(2);
  await expect(page.getByText('AI caption', { exact: true })).toHaveCount(0);
  expect((await viewer.client.from('challenge_votes').select('*').eq('challenge_id', challenge!.id)).data).toEqual([]);
});
