import { describe, expect, it } from 'vitest';
import { calculateBaseProbabilities } from './probabilities';

describe('base probabilities & combinations engine', () => {
  it('handles incomplete hand gracefully without throwing', () => {
    const res = calculateBaseProbabilities({
      myCards: ['As', null],
      boardCards: [],
      nTable: 9,
      nActive: 9,
    });

    expect(res.hasFullHand).toBe(false);
    expect(res.remainingDeckCount).toBe(51);
    expect(res.pWinRaw).toBe(0);
  });

  it('gives strong preflop equity for pocket aces and lowers it as nActive grows', () => {
    const headsUp = calculateBaseProbabilities({
      myCards: ['As', 'Ad'],
      boardCards: [],
      nTable: 9,
      nActive: 2,
      iterations: 1500,
      seed: 42,
    });

    const nineWay = calculateBaseProbabilities({
      myCards: ['As', 'Ad'],
      boardCards: [],
      nTable: 9,
      nActive: 9,
      iterations: 1500,
      seed: 42,
    });

    expect(headsUp.pWinRaw).toBeGreaterThan(0.75);
    expect(nineWay.pWinRaw).toBeGreaterThan(0.25);
    expect(headsUp.pWinRaw).toBeGreaterThan(nineWay.pWinRaw);

    const sumNine = nineWay.pWinRaw + nineWay.pTie + nineWay.pLoseRaw;
    expect(sumNine).toBeCloseTo(1, 5);
  });

  it('computes draw potential on turn and zero draw potential on river', () => {
    const onTurn = calculateBaseProbabilities({
      myCards: ['Ah', 'Kh'],
      boardCards: ['Qh', 'Jh', '2d', '9c'],
      nTable: 6,
      nActive: 3,
      iterations: 1500,
      seed: 101,
    });

    const onRiver = calculateBaseProbabilities({
      myCards: ['Ah', 'Kh'],
      boardCards: ['Qh', 'Jh', '2d', '9c', '3s'],
      nTable: 6,
      nActive: 3,
      iterations: 1500,
      seed: 101,
    });

    expect(onTurn.pDrawPlus).toBeGreaterThan(0);
    expect(onRiver.pDrawPlus).toBe(0);
  });

  it('clamps nActive to nTable and supports up to 15 players at the table', () => {
    const res = calculateBaseProbabilities({
      myCards: ['Ks', 'Kd'],
      boardCards: [],
      nTable: 15,
      nActive: 20, // должен зажаться до 15
      iterations: 800,
      seed: 7,
    });

    expect(res.nTable).toBe(15);
    expect(res.nActive).toBe(15);
    expect(res.nOpp).toBe(14);
  });
});