import { describe, expect, it } from 'vitest';
import { getRemainingDeck } from '../engine/deck';
import type { HandParticipant, PlayerMemory, SeatConfig } from '../engine/types';
import {
  applyHandCompletionToMemory,
  createInitialPlayerMemory,
  recomputePlayerProfile,
} from './memory';

describe('session memory, Bayesian smoothing, EWMA decay, and showdown isolation', () => {
  it('keeps new player profile neutral at zero observations', () => {
    const mem = createInitialPlayerMemory('p1', 'Игрок #2');
    const profile = recomputePlayerProfile(mem);
    expect(profile.phi).toBe(0);
    expect(profile.styleTag).toBe('NEUTRAL');
  });

  it('smooths small sample sizes via Bayesian priors instead of jumping to extremes', () => {
    const mem: PlayerMemory = {
      ...createInitialPlayerMemory('p1', 'Игрок #2'),
      nHandsDecayed: 2,
      nFlopDecayed: 2,
      nRaiseDecayed: 1,
      nCcDecayed: 1,
    };

    const profile = recomputePlayerProfile(mem);
    expect(Math.abs(profile.phi)).toBeLessThan(0.25);
  });

  it('applies EWMA decay and updates profile after showdown without polluting next hand deck', () => {
    const seats: SeatConfig[] = [
      { seatIndex: 0, playerId: 'me', name: 'Я', isMe: true },
      { seatIndex: 1, playerId: 'opp-1', name: 'Игрок #2', isMe: false },
    ];

    const participants: Record<number, HandParticipant> = {
      0: { seatIndex: 0, playerId: 'me', status: 'active' },
      1: { seatIndex: 1, playerId: 'opp-1', status: 'active' },
    };

    const { updatedPlayers, showdownRecord } = applyHandCompletionToMemory(
      {},
      seats,
      {
        handId: 1,
        endStreet: 'River',
        participants,
        events: [],
        finalBoardCards: ['Ah', 'Ad', '2c', '7s', '9d'],
        winnerSeatIndices: [1],
        isShowdown: true,
        revealedCardsBySeat: {
          1: ['As', 'Ac'], // Каре тузов на шоудауне
        },
      }
    );

    const oppMem = updatedPlayers['opp-1'];
    expect(oppMem.nHandsDecayed).toBe(1);
    expect(oppMem.nShowdownsTotal).toBe(1);
    expect(oppMem.nWinsTotal).toBe(1);
    expect(oppMem.nRevDecayed).toBe(1);
    expect(oppMem.sQDecayed).toBeGreaterThan(0.5);
    expect(oppMem.phi).toBeGreaterThan(0);

    expect(showdownRecord.revealedCardsBySeat?.[1]).toEqual(['As', 'Ac']);

    // В следующей раздаче вскрытые карты прошлого шоудауна НЕ попадают автоматически в knownDeadCards
    const nextHandDeck = getRemainingDeck({
      handCards: ['Kh', 'Kd'],
      boardCards: [],
      knownDeadCards: [],
    });
    expect(nextHandDeck).toContain('As');
    expect(nextHandDeck).toContain('Ac');
  });
});