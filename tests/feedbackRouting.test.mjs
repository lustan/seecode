import assert from 'node:assert/strict';
import { resolveFeedbackPresentation } from '../src/utils/feedbackRouting.mjs';

assert.equal(
  resolveFeedbackPresentation({ type: 'success', message: 'Copied to clipboard', presentation: 'toast' }),
  'toast'
);

assert.equal(
  resolveFeedbackPresentation({ type: 'error', message: 'Invalid JSON' }),
  'modal'
);

assert.equal(
  resolveFeedbackPresentation({ type: 'success', message: 'Saved', onConfirm: () => {} }),
  'modal'
);

console.log('feedbackRouting tests passed');
