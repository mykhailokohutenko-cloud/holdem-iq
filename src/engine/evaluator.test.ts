import { describe, expect, it } from 'vitest';
import { evaluateFiveCards, evaluateHand } from './evaluator';

describe('hand evaluator (5-7 cards)', () => {
  it('evaluates high card and one pair accurately', () => {
    const high = evaluateFiveCards(['As', 'Kd', '9c', '6h', '2d']);
    expect(high.rankClass).toBe('HIGH_CARD');

    const pair = evaluateFiveCards(['Ah', 'Ad', 'Kc', '8s', '3d']);
    expect(pair.rankClass).toBe('PAIR');
    expect(pair.score).toBeGreaterThan(high.score);
  });

  it('evaluates two pair, three of a kind, and full house', () => {
    const twoPair = evaluateFiveCards(['Ks', 'Kd', '9c', '9h', '4d']);
    expect(twoPair.rankClass).toBe('TWO_PAIR');

    const trips = evaluateFiveCards(['7s', '7d', '7c', 'Ah', '2d']);
    expect(trips.rankClass).toBe('THREE_OF_A_KIND');
    expect(trips.score).toBeGreaterThan(twoPair.score);

    const fullHouse = evaluateFiveCards(['Qd', 'Qs', 'Qh', '5c', '5d']);
    expect(fullHouse.rankClass).toBe('FULL_HOUSE');
    expect(fullHouse.score).toBeGreaterThan(trips.score);
  });

  it('handles wheel straight (A-2-3-4-5) below normal straight', () => {
    const wheel = evaluateFiveCards(['Ac', '2d', '3h', '4s', '5c']);
    expect(wheel.rankClass).toBe('STRAIGHT');

    const sixHighStraight = evaluateFiveCards(['2c', '3d', '4h', '5s', '6c']);
    expect(sixHighStraight.rankClass).toBe('STRAIGHT');
    expect(sixHighStraight.score).toBeGreaterThan(wheel.score);
  });

  it('evaluates flush, four of a kind, and straight flush from 7 cards', () => {
    const flush = evaluateHand(['Ah', 'Kh', '8h', '3h', '5h', '9c', 'Td']);
    expect(flush.rankClass).toBe('FLUSH');

    const quads = evaluateHand(['9s', '9d', '9c', '9h', 'As', 'Kd', '2c']);
    expect(quads.rankClass).toBe('FOUR_OF_A_KIND');
    expect(quads.score).toBeGreaterThan(flush.score);

    const straightFlush = evaluateHand(['5s', '6s', '7s', '8s', '9s', 'Ad', 'Kc']);
    expect(straightFlush.rankClass).toBe('STRAIGHT_FLUSH');
    expect(straightFlush.score).toBeGreaterThan(quads.score);
  });

  it('throws on invalid card count outside 5..7', () => {
    expect(() => evaluateHand(['As', 'Kd', 'Qh', 'Jc'])).toThrow();
    expect(() => evaluateHand(['As', 'Kd', 'Qh', 'Jc', 'Tc', '2d', '3c', '4h'])).toThrow();
  });
});