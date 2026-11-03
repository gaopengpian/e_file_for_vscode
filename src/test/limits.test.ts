import test from 'node:test';
import assert from 'node:assert/strict';
import { exceedsAnalysisLimit } from '../core/limits';

test('limits optional visual analysis by UTF-8 byte size', () => {
  assert.equal(exceedsAnalysisLimit('abc', 3), false);
  assert.equal(exceedsAnalysisLimit('éé', 3), true);
});
