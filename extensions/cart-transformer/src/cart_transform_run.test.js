import { describe, it, expect } from 'vitest';
import { cartTransformRun } from './cart_transform_run';

/**
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

describe('cart transform function', () => {
  it('returns no operations', () => {
    const result = cartTransformRun({});
    const expected = /** @type {CartTransformRunResult} */ ({ operations: [] });

    expect(result).toEqual(expected);
  });
});