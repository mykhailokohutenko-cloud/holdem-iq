import { describe, expect, it } from 'vitest';
import {
  computeSeatPositions,
  evaluateContextAndVerdict,
  getNextBtnSeat,
} from './contextAndVerdict';
import { calculateBaseProbabilities } from './probabilities';
import type { HandEvent, HandParticipant } from './types';

describe('positions, street events, and verdict engine', () => {
  it('rotates BTN around a 2..15 table and assigns SB/BB cleanly', () => {
    expect(getNextBtnSeat(0, 9)).toBe(1);
    expect(getNextBtnSeat(8, 9)).toBe(0);
    expect(getNextBtnSeat(14, 15)).toBe(0);

    const posNine = computeSeatPositions(9, 2, 2, 'Flop');
    expect(posNine.btn).toBe(2);
    expect(posNine.sb).toBe(3);
    expect(posNine.bb).toBe(4);
    expect(posNine.myRelPos).toBe(0);
    expect(posNine.posScore).toBe(1);

    const posHeadsUp = computeSeatPositions(2, 0, 1, 'Flop');
    expect(posHeadsUp.btn).toBe(0);
    expect(posHeadsUp.sb).toBe(1);
    expect(posHeadsUp.bb).toBe(0);
  });

  it('never recommends CHECK when facingRaise === 1 and never recommends FOLD on free check', () => {
    const probs = calculateBaseProbabilities({
      myCards: ['7h', '2d'],
      boardCards: ['As', 'Ks', 'Qs'],
      nTable: 6,
      nActive: 4,
      iterations: 600,
      seed: 19,
    });

    const participants: Record<number, HandParticipant> = {
      0: { seatIndex: 0, playerId: 'seat-0', status: 'active' },
      1: { seatIndex: 1, playerId: 'seat-1', status: 'active' },
      2: { seatIndex: 2, playerId: 'seat-2', status: 'active' },
      3: { seatIndex: 3, playerId: 'seat-3', status: 'active' },
    };

    const raiseEvents: HandEvent[] = [
      {
        id: 'e1',
        street: 'Flop',
        seatIndex: 2,
        playerId: 'seat-2',
        action: 'RAISE',
        relOrder: 'AFTER_ME',
        facingRaise: 0,
      },
      {
        id: 'e2',
        street: 'Flop',
        seatIndex: 3,
        playerId: 'seat-3',
        action: 'RAISE',
        relOrder: 'AFTER_ME',
        facingRaise: 1,
      },
    ];

    const facingDecision = evaluateContextAndVerdict({
      nTable: 6,
      btnSeat: 0,
      mySeat: 1,
      street: 'Flop',
      participants,
      events: raiseEvents,
      probabilities: probs,
    });

    expect(facingDecision.turnContext.facingRaise).toBe(1);
    expect(facingDecision.verdict.action).not.toBe('CHECK');
    expect(facingDecision.verdict.action).toBe('FOLD');

    const freeCheckDecision = evaluateContextAndVerdict({
      nTable: 6,
      btnSeat: 0,
      mySeat: 1,
      street: 'Flop',
      participants,
      events: [],
      probabilities: probs,
    });

    expect(freeCheckDecision.turnContext.canFreeCheck).toBe(true);
    expect(freeCheckDecision.verdict.action).toBe('CHECK');
  });

  it('recommends RAISE with dominant hand on flop', () => {
    const probs = calculateBaseProbabilities({
      myCards: ['As', 'Ah'],
      boardCards: ['Ad', 'Ac', '2s'],
      nTable: 9,
      nActive: 5,
      iterations: 600,
      seed: 77,
    });

    const res = evaluateContextAndVerdict({
      nTable: 9,
      btnSeat: 0,
      mySeat: 0,
      street: 'Flop',
      participants: {},
      events: [],
      probabilities: probs,
    });

    expect(res.verdict.action).toBe('RAISE');
    expect(['FOLD', 'CHECK', 'CALL', 'RAISE']).toContain(res.verdict.action);
  });
});