import { describe, expect, it } from 'vitest';
import {
  createStandardDeck,
  formatCard,
  getRemainingDeck,
  hasDuplicateCards,
  isValidCard,
  parseCard,
} from './deck';
import type { Card, SessionState } from './types';

describe('deck & card domain primitives', () => {
  it('generates a standard 52-card deck with unique valid cards', () => {
    const deck = createStandardDeck();
    expect(deck).toHaveLength(52);

    const unique = new Set(deck);
    expect(unique.size).toBe(52);

    for (const card of deck) {
      expect(isValidCard(card)).toBe(true);
    }
  });

  it('parses and formats cards accurately across ranks 2..14', () => {
    const parsedAce = parseCard('As');
    expect(parsedAce).toEqual({ card: 'As', rank: 14, suit: 's' });
    expect(formatCard(14, 's')).toBe('As');

    const parsedTen = parseCard('Td');
    expect(parsedTen).toEqual({ card: 'Td', rank: 10, suit: 'd' });
    expect(formatCard(10, 'd')).toBe('Td');

    const parsedTwo = parseCard('2c');
    expect(parsedTwo).toEqual({ card: '2c', rank: 2, suit: 'c' });
    expect(formatCard(2, 'c')).toBe('2c');
  });

  it('supports incomplete data without throwing (0 or 1 hand card, empty board)', () => {
    expect(getRemainingDeck()).toHaveLength(52);
    expect(
      getRemainingDeck({
        handCards: ['Ah', null],
        boardCards: [],
        knownDeadCards: [],
      })
    ).toHaveLength(51);
  });

  it('filters handCards, boardCards, and knownDeadCards cleanly', () => {
    const remaining = getRemainingDeck({
      handCards: ['As', 'Kd'],
      boardCards: ['Qh', 'Jc', 'Ts'],
      knownDeadCards: ['2c', '7h'],
    });

    expect(remaining).toHaveLength(52 - 7);
    const excluded: Card[] = ['As', 'Kd', 'Qh', 'Jc', 'Ts', '2c', '7h'];
    for (const card of excluded) {
      expect(remaining).not.toContain(card);
    }
  });

  it('detects duplicate cards across hand, board, and knownDeadCards', () => {
    expect(
      hasDuplicateCards({
        handCards: ['As', 'Kd'],
        boardCards: ['As', '7c', '2d'],
      })
    ).toBe(true);

    expect(
      hasDuplicateCards({
        handCards: ['As', 'Kd'],
        boardCards: ['Qh', '7c', '2d'],
        knownDeadCards: ['9s'],
      })
    ).toBe(false);
  });

  it('keeps past showdown revealed cards isolated from current hand remaining deck', () => {
    const sessionWithPastShowdown: SessionState = {
      sessionId: 'sess-1',
      nTable: 9,
      seats: [],
      players: {},
      showdownHistory: [
        {
          handId: 1,
          street: 'River',
          winnerSeatIndices: [2],
          isShowdown: true,
          revealedCardsBySeat: {
            2: ['As', 'Ad'],
            5: ['Kh', 'Kc'],
          },
        },
      ],
    };

    // В новой раздаче handId = 2 карты из прошлого шоудауна снова в колоде,
    // если они не указаны в handCards / boardCards / knownDeadCards текущей раздачи.
    expect(sessionWithPastShowdown.showdownHistory).toHaveLength(1);

    const nextHandRemaining = getRemainingDeck({
      handCards: ['7s', '2d'],
      boardCards: [],
      knownDeadCards: [],
    });

    expect(nextHandRemaining).toHaveLength(50);
    expect(nextHandRemaining).toContain('As');
    expect(nextHandRemaining).toContain('Ad');
    expect(nextHandRemaining).toContain('Kh');
    expect(nextHandRemaining).toContain('Kc');
  });
});