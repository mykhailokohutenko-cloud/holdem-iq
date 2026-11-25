import { getRemainingDeck, hasDuplicateCards } from './deck';
import { evaluateHand } from './evaluator';
import type { Card, HandRankClass } from './types';

export interface ProbabilityInput {
  /** Карты «Я» (слоты могут быть null при неполном вводе) */
  myCards: readonly [Card | null, Card | null];
  /** Открытые карты борда: 0, 3, 4 или 5 карт */
  boardCards: readonly Card[];
  /** Только известные карты текущей раздачи (прошлые шоудауны сюда не передаются) */
  knownDeadCards?: readonly Card[];
  /** Общее число мест за столом: 2..15 */
  nTable: number;
  /** Активных игроков в раздаче: 2..nTable */
  nActive: number;
  /** Число итераций Монте-Карло (по умолчанию 1200) */
  iterations?: number;
  /** Детерминированный seed (опционально для воспроизводимости) */
  seed?: number;
}

export interface ProbabilityResult {
  hasFullHand: boolean;
  nTable: number;
  nActive: number;
  nOpp: number;
  remainingDeckCount: number;
  pWinRaw: number;
  pTie: number;
  pLoseRaw: number;
  combinations: Record<HandRankClass, number>;
  pDrawPlus: number;
}

const ALL_HAND_CLASSES: readonly HandRankClass[] = [
  'HIGH_CARD',
  'PAIR',
  'TWO_PAIR',
  'THREE_OF_A_KIND',
  'STRAIGHT',
  'FLUSH',
  'FULL_HOUSE',
  'FOUR_OF_A_KIND',
  'STRAIGHT_FLUSH',
] as const;

function createEmptyCombinations(): Record<HandRankClass, number> {
  return {
    HIGH_CARD: 0,
    PAIR: 0,
    TWO_PAIR: 0,
    THREE_OF_A_KIND: 0,
    STRAIGHT: 0,
    FLUSH: 0,
    FULL_HOUSE: 0,
    FOUR_OF_A_KIND: 0,
    STRAIGHT_FLUSH: 0,
  };
}

/**
 * Простой быстрый PRNG (Mulberry32) для детерминированных/быстрых симуляций на клиенте.
 */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Выбирает k уникальных случайных элементов из массива without mutating source.
 */
function sampleUnique<T>(
  source: readonly T[],
  count: number,
  rng: () => number
): T[] {
  if (count <= 0) return [];
  if (count > source.length) {
    throw new Error(`Cannot sample ${count} cards from ${source.length} remaining cards`);
  }

  const pool = source.slice();
  const picked: T[] = [];
  for (let i = 0; i < count; i++) {
    const idx = i + Math.floor(rng() * (pool.length - i));
    const tmp = pool[i];
    pool[i] = pool[idx];
    pool[idx] = tmp;
    picked.push(pool[i]);
  }
  return picked;
}

/**
 * Считает базовые вероятности исходов (победа / ничья / проигрыш),
 * классы комбинаций и потенциал доезда для N_active ∈ [2..15].
 */
export function calculateBaseProbabilities(
  input: ProbabilityInput
): ProbabilityResult {
  const nTable = Math.max(2, Math.min(15, Math.trunc(input.nTable)));
  const clampedActive = Math.max(2, Math.min(nTable, Math.trunc(input.nActive)));
  const nOpp = clampedActive - 1;

  const board = input.boardCards;
  if (![0, 3, 4, 5].includes(board.length)) {
    throw new Error(`Invalid boardCards length: ${board.length}. Expected 0, 3, 4, or 5.`);
  }

  const dead = input.knownDeadCards ?? [];
  if (
    hasDuplicateCards({
      handCards: input.myCards,
      boardCards: board,
      knownDeadCards: dead,
    })
  ) {
    throw new Error('Duplicate cards detected in current hand state');
  }

  const remainingDeck = getRemainingDeck({
    handCards: input.myCards,
    boardCards: board,
    knownDeadCards: dead,
  });

  const c0 = input.myCards[0];
  const c1 = input.myCards[1];
  const hasFullHand = c0 != null && c1 != null;

  if (!hasFullHand) {
    return {
      hasFullHand: false,
      nTable,
      nActive: clampedActive,
      nOpp,
      remainingDeckCount: remainingDeck.length,
      pWinRaw: 0,
      pTie: 0,
      pLoseRaw: 0,
      combinations: createEmptyCombinations(),
      pDrawPlus: 0,
    };
  }

  const myPair: [Card, Card] = [c0, c1];
  const boardNeeded = Math.max(0, 5 - board.length);
  const oppCardsNeeded = nOpp * 2;
  const totalCardsNeededFromDeck = boardNeeded + oppCardsNeeded;

  if (totalCardsNeededFromDeck > remainingDeck.length) {
    throw new Error(
      `Not enough cards in remaining deck (${remainingDeck.length}) for ${boardNeeded} board + ${oppCardsNeeded} opponent cards`
    );
  }

  const iterations = Math.max(200, Math.min(10000, Math.trunc(input.iterations ?? 1200)));
  const rng = createRng(
    input.seed ??
      (nTable * 100003 + clampedActive * 7919 + remainingDeck.length * 131 + board.length * 17)
  );

  let winWeight = 0;
  let tieWeight = 0;
  let loseWeight = 0;
  let drawPlusCount = 0;
  const classCounts = createEmptyCombinations();

  const currentHandEval =
    board.length >= 3 ? evaluateHand([...myPair, ...board]) : null;

  for (let sim = 0; sim < iterations; sim++) {
    const drawn = sampleUnique(remainingDeck, totalCardsNeededFromDeck, rng);
    const runoutBoard = boardNeeded > 0 ? drawn.slice(0, boardNeeded) : [];
    const finalBoard = [...board, ...runoutBoard];

    const myFinalEval = evaluateHand([...myPair, ...finalBoard]);
    classCounts[myFinalEval.rankClass] += 1;

    if (
      boardNeeded > 0 &&
      currentHandEval != null &&
      myFinalEval.score > currentHandEval.score
    ) {
      drawPlusCount += 1;
    }

    let bestOppScore = -1;
    for (let o = 0; o < nOpp; o++) {
      const startIdx = boardNeeded + o * 2;
      const oppHand: [Card, Card] = [drawn[startIdx], drawn[startIdx + 1]];
      const oppEval = evaluateHand([...oppHand, ...finalBoard]);
      if (oppEval.score > bestOppScore) {
        bestOppScore = oppEval.score;
      }
    }

    if (myFinalEval.score > bestOppScore) {
      winWeight += 1;
    } else if (myFinalEval.score === bestOppScore) {
      // При дележе между «Я» и k оппонентами доля выигрыша «Я» равна 1 / (k + 1)
      let tiedOpps = 0;
      for (let o = 0; o < nOpp; o++) {
        const startIdx = boardNeeded + o * 2;
        const oppHand: [Card, Card] = [drawn[startIdx], drawn[startIdx + 1]];
        const oppEval = evaluateHand([...oppHand, ...finalBoard]);
        if (oppEval.score === bestOppScore) {
          tiedOpps += 1;
        }
      }
      const share = 1 / (tiedOpps + 1);
      winWeight += share;
      tieWeight += Math.max(0, 1 - share);
    } else {
      loseWeight += 1;
    }
  }

  const pWinRaw = winWeight / iterations;
  const pTie = tieWeight / iterations;
  const pLoseRaw = Math.max(0, 1 - pWinRaw - pTie);

  const combinations = createEmptyCombinations();
  for (const rankClass of ALL_HAND_CLASSES) {
    combinations[rankClass] = classCounts[rankClass] / iterations;
  }

  const pDrawPlus = boardNeeded > 0 ? drawPlusCount / iterations : 0;

  return {
    hasFullHand: true,
    nTable,
    nActive: clampedActive,
    nOpp,
    remainingDeckCount: remainingDeck.length,
    pWinRaw,
    pTie,
    pLoseRaw,
    combinations,
    pDrawPlus,
  };
}