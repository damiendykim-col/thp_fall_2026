/** @jest-environment node */
import { logOperation } from './operation-log';

afterEach(() => jest.restoreAllMocks());
test('backend faults carry searchable outcomes without raw error details', () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  logOperation('generation.claim', 'failed', { code: 'PGRST202', message: 'secret prompt', token: 'secret' });
  expect(log).toHaveBeenCalledWith({ event: 'app-operation', operation: 'generation.claim', outcome: 'failed', code: 'PGRST202' });
});
test('expected rejections and successes do not inflate error logs', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const info = jest.spyOn(console, 'info').mockImplementation(() => {});
  logOperation('generation.claim', 'rejected', { code: '40001' });
  logOperation('generation.complete', 'succeeded');
  expect(error).not.toHaveBeenCalled();
  expect(info).toHaveBeenCalledTimes(2);
});
