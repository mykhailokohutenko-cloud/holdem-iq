import type { Card, Rank, RankChar, Suit } from './types';

export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'] as const;

export const RANK_CHARS: readonly RankChar[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'T',
  'J',
  'Q',
  'K',
  'A',
] as const;

const CHAR_TO_RANK: Record<RankChar, Rank> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
};

const RANK_TO_CHAR: Record<Rank, RankChar> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export interface ParsedCard {
  card: Card;
  rank: Rank;
  suit: Suit;
}

export interface DeckFilterInput {
  /** Карты «Я» (0, 1 или 2 выбранные карты при неполном вводе) */
  handCards?: ReadonlyArray<Card | null | undefined>;
  /** Открытые карты борда (0, 3, 4 или 5 карт) */
  boardCards?: ReadonlyArray<Card | null | undefined>;
  /** Явно указанные известные карты текущей раздачи (прошлые шоудауны сюда НЕ передаются) */
  knownDeadCards?: ReadonlyArray<Card | null | undefined>;
}

/**
 * Генерирует стандартную колоду из 52 уникальных карт в детерминированном порядке.
 */
export function createStandardDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rankChar of RANK_CHARS) {
      deck.push(`${rankChar}${suit}`);
    }
  }
  return deck;
}

/**
 * Проверяет, является ли строка валидной картой колоды.
 */
export function isValidCard(value: unknown): value is Card {
  if (typeof value !== 'string' || value.length !== 2) {
    return false;
  }
  const rankChar = value[0] as RankChar;
  const suit = value[1] as Suit;
  return (
    Object.prototype.hasOwnProperty.call(CHAR_TO_RANK, rankChar) &&
    SUITS.includes(suit)
  );
}

/**
 * Разбирает строковую карту в объект { card, rank, suit }.
 */
export function parseCard(card: Card): ParsedCard {
  if (!isValidCard(card)) {
    throw new Error(`Invalid card: ${String(card)}`);
  }
  const rankChar = card[0] as RankChar;
  const suit = card[1] as Suit;
  return {
    card,
    rank: CHAR_TO_RANK[rankChar],
    suit,
  };
}

/**
 * Собирает карту из числового ранга (2..14) и масти.
 */
export function formatCard(rank: Rank, suit: Suit): Card {
  return `${RANK_TO_CHAR[rank]}${suit}`;
}

/**
 * Возвращает множество уникальных известных карт текущей раздачи
 * (handCards ∪ boardCards ∪ knownDeadCards).
 */
export function collectExcludedCards(input: DeckFilterInput): Set<Card> {
  const excluded = new Set<Card>();
  const sources = [
    input.handCards ?? [],
    input.boardCards ?? [],
    input.knownDeadCards ?? [],
  ];

  for (const list of sources) {
    for (const item of list) {
      if (item != null && isValidCard(item)) {
        excluded.add(item);
      }
    }
  }

  return excluded;
}

/**
 * Проверяет отсутствие дубликатов среди переданных карт текущей раздачи.
 */
export function hasDuplicateCards(input: DeckFilterInput): boolean {
  const seen = new Set<Card>();
  const sources = [
    input.handCards ?? [],
    input.boardCards ?? [],
    input.knownDeadCards ?? [],
  ];

  for (const list of sources) {
    for (const item of list) {
      if (item == null) continue;
      if (seen.has(item)) {
        return true;
      }
      seen.add(item);
    }
  }

  return false;
}

/**
 * Вычисляет остаток колоды D_rem = D \ (H ∪ B ∪ K_known).
 * Работает при неполном вводе (например, 0 или 1 карта у «Я», пустой борд).
 * Карты прошлых шоудаунов не участвуют в фильтрации.
 */
export function getRemainingDeck(input: DeckFilterInput = {}): Card[] {
  const excluded = collectExcludedCards(input);
  return createStandardDeck().filter((card) => !excluded.has(card));
}