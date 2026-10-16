/** @jest-environment node */
import { generateOpponent } from './actions';
import { challengeAdmin } from '@/lib/challenges/server';
import { logOperation } from '@/lib/operation-log';

jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/auth', () => ({ requireUser: async () => ({ user: { id: 'owner' } }) }));
jest.mock('@/lib/challenges/server', () => ({ challengeAdmin: jest.fn() }));
jest.mock('@/lib/operation-log', () => ({ logOperation: jest.fn() }));
jest.mock('@/lib/challenges/generation', () => ({
  generationConfig: () => ({ provider: 'mock', model: 'test' }),
  captionPrompt: () => ({}), generateCaption: async () => 'A generated caption',
}));
jest.mock('@/lib/challenges/moderation', () => ({
  ...jest.requireActual('@/lib/challenges/moderation'),
  reviewChallenge: async () => ({ challenge: { revision: 1, situation: 'A scene' } }),
  ensureModerated: async () => 'check',
}));

beforeEach(() => jest.clearAllMocks());
test.each([
  ['failed', null, false],
  ['succeeded', null, false],
  ['succeeded', { id: 'draft' }, true],
])('generation %s with attachment %j reports success only if actually saved', async (status, attached, success) => {
  const update = jest.fn();
  const chain = { update, eq: jest.fn(), is: jest.fn(), select: jest.fn(), maybeSingle: async () => ({ data: attached, error: null }) };
  for (const method of [chain.update, chain.eq, chain.is, chain.select]) method.mockReturnValue(chain);
  const admin = {
    rpc: jest.fn(async (name: string) => ({ data: name === 'claim_reviewed_caption_generation' ? 'request' : null, error: null })),
    from: jest.fn((table: string) => table === 'challenge_generations'
      ? { select: () => ({ eq: () => ({ single: async () => ({ data: { status }, error: null }) }) }) }
      : chain),
  };
  jest.mocked(challengeAdmin).mockReturnValue(admin as never);
  const result = await generateOpponent('draft');
  expect(Boolean(result.error)).toBe(!success);
  if (status === 'failed') expect(update).not.toHaveBeenCalled();
  if (success) expect(logOperation).toHaveBeenCalledWith('generation.complete', 'succeeded');
  else expect(logOperation).not.toHaveBeenCalledWith('generation.complete', 'succeeded');
});
