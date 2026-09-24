import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { GREETINGS, greetingsFor, pickGreeting, slotOf, wordGreeting } from '@/lib/greetings';

// 2026-09-21 is a Monday; the rest of the week follows. Local time, as the dashboard's clock is.
const at = (day: number, hour: number) => new Date(2026, 8, 21 + ((day + 6) % 7), hour, 30);
const MON = 1, FRI = 5, SAT = 6, SUN = 0;

describe('slotOf — the hour picks the slot', () => {
  test('boundaries: start hour inclusive, end exclusive', () => {
    assert.equal(slotOf(5), 'night');
    assert.equal(slotOf(6), 'morning');
    assert.equal(slotOf(11), 'morning');
    assert.equal(slotOf(12), 'afternoon');
    assert.equal(slotOf(16), 'afternoon');
    assert.equal(slotOf(17), 'evening');
    assert.equal(slotOf(20), 'evening');
    assert.equal(slotOf(21), 'night');
    assert.equal(slotOf(0), 'night');
  });
});

describe('greetingsFor — slot, weekday, and holds', () => {
  const texts = (d: Date) => greetingsFor(d).map((g) => g.text);

  test('weekday greetings only on their day', () => {
    assert.ok(texts(at(MON, 9)).includes('Happy Monday, {name}'));
    assert.ok(!texts(at(FRI, 9)).includes('Happy Monday, {name}'));
    assert.ok(texts(at(FRI, 9)).includes('That Friday feeling, {name}'));
  });

  test('weekend greetings on Saturday and Sunday only', () => {
    assert.ok(texts(at(SAT, 9)).includes('Welcome to the weekend, {name}'));
    assert.ok(texts(at(SUN, 9)).includes('Welcome to the weekend, {name}'));
    assert.ok(!texts(at(FRI, 9)).includes('Welcome to the weekend, {name}'));
  });

  test('day greetings stay in the morning', () => {
    assert.ok(!texts(at(MON, 14)).includes('Happy Monday, {name}'));
  });

  test('held greetings never enter the draw; the rest do', () => {
    for (let h = 0; h < 24; h++) {
      assert.ok(greetingsFor(at(MON, h)).every((g) => g.flag?.kind !== 'hold'));
    }
    assert.ok(texts(at(MON, 9)).includes('Coffee & past paper time?'));
  });

  test('every hour of every day has something to say', () => {
    for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) assert.ok(greetingsFor(at(d, h)).length > 0);
  });
});

describe('wordGreeting — the name as typed', () => {
  const evening = GREETINGS.find((g) => g.text === 'Good evening, {name}')!;
  const returns = GREETINGS.find((g) => g.text === '{name} returns!')!;

  test('fills the name exactly as entered', () => {
    assert.equal(wordGreeting(evening, 'Zohaib'), 'Good evening, Zohaib');
    assert.equal(wordGreeting(returns, 'zo'), 'zo returns!');
  });

  test('no name falls back to the nameless wording', () => {
    assert.equal(wordGreeting(evening, '  '), 'Good evening');
    assert.equal(wordGreeting(returns, ''), 'Back at it!');
  });

  test('every {name} greeting has a nameless wording', () => {
    for (const g of GREETINGS) if (g.text.includes('{name}')) assert.ok(g.bare, g.text);
  });
});

describe('pickGreeting — one line for this moment', () => {
  test('rng chooses within the moment’s pool', () => {
    const first = pickGreeting(at(MON, 19), 'Sam', { rng: () => 0 });
    assert.equal(first, 'Sam returns!');
  });

  test('never repeats the line shown last when there is an alternative', () => {
    assert.notEqual(pickGreeting(at(MON, 19), 'Sam', { rng: () => 0, avoid: 'Sam returns!' }), 'Sam returns!');
  });
});
