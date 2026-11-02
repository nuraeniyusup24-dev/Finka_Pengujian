import test from 'node:test'
import assert from 'node:assert/strict'
import { isValidDateOnly, positiveSafeInteger } from '../src/validation.js'

test('isValidDateOnly accepts real ISO calendar dates', () => {
  assert.equal(isValidDateOnly('2024-02-29'), true)
  assert.equal(isValidDateOnly('2026-10-26'), true)
})

test('isValidDateOnly rejects impossible or malformed dates', () => {
  for (const value of ['2025-02-29', '2026-13-01', '2026-04-31', '26-10-2026', '', null, 20261026]) {
    assert.equal(isValidDateOnly(value), false, `should reject ${String(value)}`)
  }
})

test('positiveSafeInteger accepts only positive safe integer values', () => {
  assert.equal(positiveSafeInteger(1), true)
  assert.equal(positiveSafeInteger('42'), true)
  for (const value of [0, -1, 1.5, 'abc', Number.MAX_SAFE_INTEGER + 1, null]) {
    assert.equal(positiveSafeInteger(value), false, `should reject ${String(value)}`)
  }
})
