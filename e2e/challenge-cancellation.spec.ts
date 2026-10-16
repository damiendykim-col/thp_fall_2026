import { test, expect, login } from './fixtures';

test('only the owner can cancel a draft; late generation cannot revive it', async ({ page, accounts }) => {
  const owner = await accounts.create();
  const other = await accounts.create();
  const { data: templates } = await accounts.admin.from('images').select('id').limit(1);
  const { data: id, error } = await accounts.admin.rpc('create_caption_challenge', {
    p_owner: owner.id, p_image: null, p_template: templates![0].id,
    p_situation: 'Cancellation fixture', p_caption: 'A draft that I no longer want.',
  });
  expect(error).toBeNull();
  const { data: request, error: claimError } = await accounts.admin.rpc('claim_caption_generation', {
    p_owner: owner.id, p_challenge: id, p_provider: 'mock', p_model: 'fixture', p_prompt: {},
  });
  expect(claimError).toBeNull();
  expect((await other.client.rpc('cancel_caption_draft', { p_challenge: id })).error).toBeTruthy();
  expect((await accounts.anonymous.rpc('cancel_caption_draft', { p_challenge: id })).error).toBeTruthy();
  await login(page, owner);
  await page.goto(`/challenges/${id}`);
  await page.getByRole('button', { name: 'Cancel draft', exact: true }).click();
  await page.getByRole('button', { name: 'Keep draft', exact: true }).click();
  expect((await owner.client.from('challenges').select('hidden_at').eq('id', id).single()).data?.hidden_at).toBeNull();
  await page.getByRole('button', { name: 'Cancel draft', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, cancel draft' }).click();
  await expect(page).toHaveURL(/\/challenges\?view=yours$/);
  await expect(page.locator(`a[href="/challenges/${id}"]`)).toHaveCount(0);
  expect((await accounts.admin.rpc('finish_caption_generation', { p_request: request, p_caption: 'Too late' })).error).toBeNull();
  expect((await owner.client.rpc('publish_caption_challenge', { p_challenge: id })).error).toBeTruthy();
  expect((await owner.client.rpc('cancel_caption_draft', { p_challenge: id })).error).toBeNull();
  const { data: captions } = await accounts.admin.from('challenge_captions').select('id').eq('challenge_id', id).eq('origin', 'ai');
  expect(captions).toEqual([]);
  const { data: generation } = await accounts.admin.from('challenge_generations').select('status').eq('id', request).single();
  expect(generation?.status).toBe('failed');
  const { data: published, error: insertError } = await accounts.admin.from('challenges').insert({
    creator_id: owner.id, template_id: templates![0].id, template_url: 'https://example.test/image.png',
    situation: 'Published fixture', status: 'published', closes_at: new Date(Date.now() + 60000).toISOString(),
  }).select('id').single();
  expect(insertError).toBeNull();
  expect((await owner.client.rpc('cancel_caption_draft', { p_challenge: published!.id })).error).toBeTruthy();
  await page.goto(`/challenges/${id}`);
  await expect(page.getByText('This draft was cancelled.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate AI opponent' })).toHaveCount(0);
});
