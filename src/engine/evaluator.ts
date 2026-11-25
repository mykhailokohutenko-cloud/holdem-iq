import { parseCard } from './deck';
import type { Card, HandRankClass, Rank, Suit } from './types';

export interface EvaluatedHand {
  rankClass: HandRankClass;
  /** Числовая оценка для сравнения двух комбинаций: чем больше, тем сильнее */
  score: number;
  /** Лучшие 5 карт, составившие комбинацию */
  bestFive: Card[];
}

const RANK_CLASS_WEIGHT: Record<HandRankClass, number> = {
  HIGH_CARD: 1,
  PAIR: 2,
  TWO_PAIR: 3,
  THREE_OF_A_KIND: 4,
  STRAIGHT: 5,
  FLUSH: 6,
  FULL_HOUSE: 7,
  FOUR_OF_A_KIND: 8,
  STRAIGHT_FLUSH: 9,
};

interface CardInfo {
  card: Card;
  rank: Rank;
  suit: Suit;
}

/**
 * Кодирует массив старшинств (до 5 значений 1..14, где 1 — «младший туз» в A-2-3-4-5)
 * в единое монотонно возрастающее число по основанию 15.
 */
function encodeTiebreakers(values: readonly number[]): number {
  let acc = 0;
  for (let i = 0; i < 5; i++) {
    const v = values[i] ?? 0;
    acc = acc * 15 + v;
  }
  return acc;
}

function buildScore(rankClass: HandRankClass, tiebreakers: readonly number[]): number {
  return RANK_CLASS_WEIGHT[rankClass] * 1_000_000 + encodeTiebreakers(tiebreakers);
}

/**
 * Проверяет, образуют ли 5 карт стрит, и возвращает старшую карту стрита (14 для A-K-Q-J-T, 5 для A-2-3-4-5)
 * либо null, если стрита нет.
 */
function getStraightHighRank(infos: readonly CardInfo[]): number | null {
  const uniqueRanks = Array.from(new Set(infos.map((c) => c.rank))).sort(
    (a, b) => b - a
  );
  if (uniqueRanks.length !== 5) {
    return null;
  }

  // Обычный стрит (например, 14, 13, 12, 11, 10)
  if (uniqueRanks[0] - uniqueRanks[4] === 4) {
    return uniqueRanks[0];
  }

  // Колесо / младший стрит: A-2-3-4-5 -> ранги [14, 5, 4, 3, 2]
  if (
    uniqueRanks[0] === 14 &&
    uniqueRanks[1] === 5 &&
    uniqueRanks[2] === 4 &&
    uniqueRanks[3] === 3 &&
    uniqueRanks[4] === 2
  ) {
    return 5;
  }

  return null;
}

/**
 * Оценивает ровно 5 карт.
 */
export function evaluateFiveCards(cards: readonly Card[]): EvaluatedHand {
  if (cards.length !== 5) {
    throw new Error(`evaluateFiveCards requires exactly 5 cards, got ${cards.length}`);
  }

  const infos: CardInfo[] = cards.map((card) => {
    const parsed = parseCard(card);
    return { card: parsed.card, rank: parsed.rank, suit: parsed.suit };
  });

  const isFlush = infos.every((c) => c.suit === infos[0].suit);
  const straightHigh = getStraightHighRank(infos);

  if (isFlush && straightHigh !== null) {
    const sortedForDisplay = [...infos].sort((a, b) => b.rank - a.rank);
    return {
      rankClass: 'STRAIGHT_FLUSH',
      score: buildScore('STRAIGHT_FLUSH', [straightHigh]),
      bestFive: sortedForDisplay.map((c) => c.card),
    };
  }

  // Подсчёт частот рангов
  const countByRank = new Map<Rank, CardInfo[]>();
  for (const item of infos) {
    const list = countByRank.get(item.rank) ?? [];
    list.push(item);
    countByRank.set(item.rank, list);
  }

  // Группы по убыванию: сначала по количеству карт (4, 3, 2, 1), затем по рангу
  const groups = Array.from(countByRank.entries())
    .map(([rank, items]) => ({ rank, count: items.length, items }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.rank - a.rank;
    });

  // Каре (Four of a Kind)
  if (groups[0].count === 4) {
    const kicker = groups[1].rank;
    const bestFive = [...groups[0].items, ...groups[1].items.slice(0, 1)].map(
      (c) => c.card
    );
    return {
      rankClass: 'FOUR_OF_A_KIND',
      score: buildScore('FOUR_OF_A_KIND', [groups[0].rank, kicker]),
      bestFive,
    };
  }

  // Фулл-хаус (Full House)
  if (groups[0].count === 3 && groups[1]?.count === 2) {
    const bestFive = [...groups[0].items, ...groups[1].items].map((c) => c.card);
    return {
      rankClass: 'FULL_HOUSE',
      score: buildScore('FULL_HOUSE', [groups[0].rank, groups[1].rank]),
      bestFive,
    };
  }

  // Флеш (Flush)
  if (isFlush) {
    const sortedByRank = [...infos].sort((a, b) => b.rank - a.rank);
    const ranks = sortedByRank.map((c) => c.rank);
    return {
      rankClass: 'FLUSH',
      score: buildScore('FLUSH', ranks),
      bestFive: sortedByRank.map((c) => c.card),
    };
  }

  // Стрит (Straight)
  if (straightHigh !== null) {
    const sortedByRank = [...infos].sort((a, b) => b.rank - a.rank);
    return {
      rankClass: 'STRAIGHT',
      score: buildScore('STRAIGHT', [straightHigh]),
      bestFive: sortedByRank.map((c) => c.card),
    };
  }

  // Сет / Тройка (Three of a Kind)
  if (groups[0].count === 3) {
    const kickers = [groups[1].rank, groups[2].rank].sort((a, b) => b - a);
    const bestFive = [
      ...groups[0].items,
      ...groups[1].items.slice(0, 1),
      ...groups[2].items.slice(0, 1),
    ].map((c) => c.card);
    return {
      rankClass: 'THREE_OF_A_KIND',
      score: buildScore('THREE_OF_A_KIND', [groups[0].rank, ...kickers]),
      bestFive,
    };
  }

  // Две пары (Two Pair)
  if (groups[0].count === 2 && groups[1]?.count === 2) {
    const highPair = Math.max(groups[0].rank, groups[1].rank);
    const lowPair = Math.min(groups[0].rank, groups[1].rank);
    const kicker = groups[2].rank;
    const highGroup = groups[0].rank > groups[1].rank ? groups[0] : groups[1];
    const lowGroup = groups[0].rank > groups[1].rank ? groups[1] : groups[0];
    const bestFive = [
      ...highGroup.items,
      ...lowGroup.items,
      ...groups[2].items.slice(0, 1),
    ].map((c) => c.card);
    return {
      rankClass: 'TWO_PAIR',
      score: buildScore('TWO_PAIR', [highPair, lowPair, kicker]),
      bestFive,
    };
  }

  // Одна пара (Pair)
  if (groups[0].count === 2) {
    const kickers = [groups[1].rank, groups[2].rank, groups[3].rank].sort(
      (a, b) => b - a
    );
    const bestFive = [
      ...groups[0].items,
      ...groups[1].items.slice(0, 1),
      ...groups[2].items.slice(0, 1),
      ...groups[3].items.slice(0, 1),
    ].map((c) => c.card);
    return {
      rankClass: 'PAIR',
      score: buildScore('PAIR', [groups[0].rank, ...kickers]),
      bestFive,
    };
  }

  // Старшая карта (High Card)
  const sortedByRank = [...infos].sort((a, b) => b.rank - a.rank);
  const ranks = sortedByRank.map((c) => c.rank);
  return {
    rankClass: 'HIGH_CARD',
    score: buildScore('HIGH_CARD', ranks),
    bestFive: sortedByRank.map((c) => c.card),
  };
}

/**
 * Оценивает от 5 до 7 карт (например, 2 карты руки + 3–5 карт борда),
 * перебирая все 5-карточные комбинации C(n, 5).
 */
export function evaluateHand(cards: readonly Card[]): EvaluatedHand {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`evaluateHand requires between 5 and 7 cards, got ${cards.length}`);
  }

  if (cards.length === 5) {
    return evaluateFiveCards(cards);
  }

  let best: EvaluatedHand | null = null;
  const current: Card[] = [];

  function backtrack(startIndex: number): void {
    if (current.length === 5) {
      const candidate = evaluateFiveCards(current);
      if (!best || candidate.score > best.score) {
        best = candidate;
      }
      return;
    }

    const needed = 5 - current.length;
    for (let i = startIndex; i <= cards.length - needed; i++) {
      current.push(cards[i]);
      backtrack(i + 1);
      current.pop();
    }
  }

  backtrack(0);
  if (!best) {
    throw new Error('Failed to evaluate hand');
  }
  return best;
}