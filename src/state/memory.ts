import { evaluateHand } from '../engine/evaluator';
import type {
  Card,
  HandEvent,
  HandParticipant,
  PlayerMemory,
  PlayerStyleTag,
  SeatConfig,
  ShowdownRecord,
  Street,
} from '../engine/types';

export interface HandCompletionInput {
  handId: number;
  endStreet: Exclude<Street, 'Showdown'>;
  participants: Record<number, HandParticipant>;
  events: readonly HandEvent[];
  finalBoardCards?: readonly Card[];
  winnerSeatIndices?: readonly number[];
  isShowdown?: boolean;
  revealedCardsBySeat?: Record<number, readonly Card[]>;
}

const MEMORY_CONSTANTS = {
  GAMMA_MEM: 0.985,
  GAMMA_SD: 0.95,
  PRIOR_FLOP_RATE: 0.45,
  PRIOR_AGG_RATE: 0.25,
  M_FLOP: 6,
  M_ACT: 8,
  M_SD: 4,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Создаёт начальную запись памяти игрока за сессию.
 */
export function createInitialPlayerMemory(
  playerId: string,
  name: string
): PlayerMemory {
  return {
    playerId,
    name,
    nHandsDecayed: 0,
    nFlopDecayed: 0,
    nTurnDecayed: 0,
    nRiverDecayed: 0,
    nRaiseDecayed: 0,
    nCcDecayed: 0,
    nFoldDecayed: 0,
    nFoldToRaiseDecayed: 0,
    nShowdownsTotal: 0,
    nWinsTotal: 0,
    nRevDecayed: 0,
    sQDecayed: 0,
    phi: 0,
    styleTag: 'NEUTRAL',
  };
}

/**
 * Оценивает нормированное качество вскрытой руки q_rev ∈ [-1, +1]
 * по вскрытым картам (0, 1 или 2 карты) и финальному борду (если их вместе >= 5 карт).
 * Если карт нет или их недостаточно для оценки комбинации, возвращает 0.
 */
export function scoreRevealedHand(
  revealedCards: readonly Card[] | undefined,
  boardCards: readonly Card[] | undefined,
  isWinner: boolean
): number {
  if (!revealedCards || revealedCards.length === 0) {
    return 0;
  }

  const combined: Card[] = [...revealedCards];
  if (boardCards && boardCards.length > 0) {
    for (const c of boardCards) {
      if (!combined.includes(c)) {
        combined.push(c);
      }
    }
  }

  if (combined.length >= 5) {
    const evalRes = evaluateHand(combined.slice(0, 7));
    const classQualityMap: Record<string, number> = {
      HIGH_CARD: -0.65,
      PAIR: -0.2,
      TWO_PAIR: 0.25,
      THREE_OF_A_KIND: 0.5,
      STRAIGHT: 0.65,
      FLUSH: 0.78,
      FULL_HOUSE: 0.9,
      FOUR_OF_A_KIND: 0.97,
      STRAIGHT_FLUSH: 1.0,
    };
    const baseQ = classQualityMap[evalRes.rankClass] ?? 0;
    const winAdjust = isWinner ? 0.05 : -0.05;
    return clamp(baseQ + winAdjust, -1, 1);
  }

  // Если на шоудауне указаны только 1-2 карты без полного 5+ карточного набора
  const rankOrder = '23456789TJQKA';
  let sumNorm = 0;
  for (const card of revealedCards) {
    const idx = rankOrder.indexOf(card[0] ?? '2');
    const r = idx >= 0 ? idx + 2 : 2;
    sumNorm += (r - 8) / 6; // ~ [-1, +1]
  }
  const avgCard = sumNorm / revealedCards.length;
  const isPocketPair =
    revealedCards.length === 2 && revealedCards[0][0] === revealedCards[1][0];
  return clamp(avgCard * 0.6 + (isPocketPair ? 0.2 : 0), -1, 1);
}

/**
 * Пересчитывает байесовски сглаженный профиль phi ∈ [-1, +1] и styleTag игрока.
 * При отсутствии наблюдений возвращает phi = 0 и 'NEUTRAL'.
 */
export function recomputePlayerProfile(mem: PlayerMemory): {
  phi: number;
  styleTag: PlayerStyleTag;
} {
  const { PRIOR_FLOP_RATE, PRIOR_AGG_RATE, M_FLOP, M_ACT, M_SD } =
    MEMORY_CONSTANTS;

  const hasAnySignal =
    mem.nHandsDecayed > 0 ||
    mem.nRaiseDecayed + mem.nCcDecayed > 0 ||
    mem.nRevDecayed > 0;

  if (!hasAnySignal) {
    return { phi: 0, styleTag: 'NEUTRAL' };
  }

  const rFlopHat =
    (mem.nFlopDecayed + M_FLOP * PRIOR_FLOP_RATE) /
    (mem.nHandsDecayed + M_FLOP);

  const actDenom = mem.nRaiseDecayed + mem.nCcDecayed + M_ACT;
  const aAggHat =
    (mem.nRaiseDecayed + M_ACT * PRIOR_AGG_RATE) / Math.max(1, actDenom);

  const qSdHat = mem.sQDecayed / (mem.nRevDecayed + M_SD);

  const rawPhi =
    0.8 * (PRIOR_FLOP_RATE - rFlopHat) +
    0.5 * (aAggHat - PRIOR_AGG_RATE) +
    0.9 * qSdHat;

  const phi = clamp(rawPhi, -1, 1);

  const isTight = rFlopHat < PRIOR_FLOP_RATE - 0.05 || phi > 0.22;
  const isLoose = rFlopHat > PRIOR_FLOP_RATE + 0.08 || phi < -0.22;
  const isAgg = aAggHat > PRIOR_AGG_RATE + 0.08;

  let styleTag: PlayerStyleTag = 'NEUTRAL';
  if (isTight && isAgg) {
    styleTag = 'TIGHT_AGG';
  } else if (isTight && !isAgg) {
    styleTag = 'TIGHT_PASSIVE';
  } else if (isLoose && isAgg) {
    styleTag = 'LOOSE_AGG';
  } else if (isLoose && !isAgg) {
    styleTag = 'LOOSE_PASSIVE';
  }

  return { phi, styleTag };
}

/**
 * Обновляет память всех игроков за сессию при завершении раздачи / шоудауна
 * и возвращает запись шоудауна (которая хранится отдельно от knownDeadCards следующей раздачи).
 */
export function applyHandCompletionToMemory(
  playersById: Record<string, PlayerMemory>,
  seats: readonly SeatConfig[],
  completion: HandCompletionInput
): {
  updatedPlayers: Record<string, PlayerMemory>;
  showdownRecord: ShowdownRecord;
} {
  const { GAMMA_MEM, GAMMA_SD } = MEMORY_CONSTANTS;
  const updatedPlayers: Record<string, PlayerMemory> = {};

  for (const [id, mem] of Object.entries(playersById)) {
    updatedPlayers[id] = { ...mem };
  }

  const seatToConfig = new Map<number, SeatConfig>();
  for (const seat of seats) {
    seatToConfig.set(seat.seatIndex, seat);
  }

  const winnersSet = new Set<number>(completion.winnerSeatIndices ?? []);
  const isShowdown = Boolean(completion.isShowdown);
  const revealedBySeat = completion.revealedCardsBySeat ?? {};

  const streetRankOrder: Record<Exclude<Street, 'Showdown'>, number> = {
    Pre: 0,
    Flop: 1,
    Turn: 2,
    River: 3,
  };
  const endOrder = streetRankOrder[completion.endStreet];

  for (const participant of Object.values(completion.participants)) {
    if (participant.status === 'sittingOut') continue;
    const seatCfg = seatToConfig.get(participant.seatIndex);
    if (seatCfg?.isMe) continue; // Память ведётся по оппонентам (кроме «Я»)

    const playerId =
      participant.playerId || seatCfg?.playerId || `seat-${participant.seatIndex}`;
    const name = seatCfg?.name || `Игрок #${participant.seatIndex + 1}`;

    const prev =
      updatedPlayers[playerId] ?? createInitialPlayerMemory(playerId, name);

    // 1. EWMA-затухание накопителей сессии (gamma_mem = 0.985)
    const nHandsDecayed = prev.nHandsDecayed * GAMMA_MEM + 1;
    let nFlopDecayed = prev.nFlopDecayed * GAMMA_MEM;
    let nTurnDecayed = prev.nTurnDecayed * GAMMA_MEM;
    let nRiverDecayed = prev.nRiverDecayed * GAMMA_MEM;
    let nRaiseDecayed = prev.nRaiseDecayed * GAMMA_MEM;
    let nCcDecayed = prev.nCcDecayed * GAMMA_MEM;
    let nFoldDecayed = prev.nFoldDecayed * GAMMA_MEM;
    let nFoldToRaiseDecayed = prev.nFoldToRaiseDecayed * GAMMA_MEM;

    const reachedFlop =
      endOrder >= 1 ||
      (participant.foldedOnStreet != null &&
        streetRankOrder[participant.foldedOnStreet] >= 1);
    const reachedTurn =
      endOrder >= 2 ||
      (participant.foldedOnStreet != null &&
        streetRankOrder[participant.foldedOnStreet] >= 2);
    const reachedRiver =
      endOrder >= 3 ||
      (participant.foldedOnStreet != null &&
        streetRankOrder[participant.foldedOnStreet] >= 3);

    if (reachedFlop) nFlopDecayed += 1;
    if (reachedTurn) nTurnDecayed += 1;
    if (reachedRiver) nRiverDecayed += 1;

    // 2. Учёт событий игрока в завершённой раздаче
    for (const ev of completion.events) {
      if (ev.playerId !== playerId && ev.seatIndex !== participant.seatIndex) {
        continue;
      }
      if (ev.action === 'RAISE') {
        nRaiseDecayed += 1;
      } else if (ev.action === 'CHECK_CALL') {
        nCcDecayed += 1;
      } else if (ev.action === 'FOLD') {
        nFoldDecayed += 1;
        if (ev.facingRaise === 1) {
          nFoldToRaiseDecayed += 1;
        }
      }
    }

    if (
      participant.status === 'folded' &&
      !completion.events.some(
        (ev) =>
          ev.action === 'FOLD' &&
          (ev.playerId === playerId || ev.seatIndex === participant.seatIndex)
      )
    ) {
      nFoldDecayed += 1;
      if (participant.foldedFacingRaise === 1) {
        nFoldToRaiseDecayed += 1;
      }
    }

    // 3. Шоудаун, победы и вскрытые карты (gamma_sd = 0.95)
    const isWinner = winnersSet.has(participant.seatIndex);
    const nShowdownsTotal =
      prev.nShowdownsTotal + (isShowdown && participant.status === 'active' ? 1 : 0);
    const nWinsTotal = prev.nWinsTotal + (isWinner ? 1 : 0);
    let nRevDecayed = prev.nRevDecayed;
    let sQDecayed = prev.sQDecayed;

    const revealedCards = revealedBySeat[participant.seatIndex];
    if (isShowdown && participant.status === 'active') {
      if (revealedCards && revealedCards.length > 0) {
        const qRev = scoreRevealedHand(
          revealedCards,
          completion.finalBoardCards,
          isWinner
        );
        nRevDecayed = prev.nRevDecayed * GAMMA_SD + 1;
        sQDecayed = prev.sQDecayed * GAMMA_SD + qRev;
      }
    }

    const draftMem: PlayerMemory = {
      ...prev,
      name,
      nHandsDecayed,
      nFlopDecayed,
      nTurnDecayed,
      nRiverDecayed,
      nRaiseDecayed,
      nCcDecayed,
      nFoldDecayed,
      nFoldToRaiseDecayed,
      nShowdownsTotal,
      nWinsTotal,
      nRevDecayed,
      sQDecayed,
    };

    const profile = recomputePlayerProfile(draftMem);
    updatedPlayers[playerId] = {
      ...draftMem,
      phi: profile.phi,
      styleTag: profile.styleTag,
    };
  }

  const normalizedRevealed: Record<number, Card[]> = {};
  for (const [seatKey, cards] of Object.entries(revealedBySeat)) {
    const idx = Number(seatKey);
    if (!Number.isNaN(idx) && cards && cards.length > 0) {
      normalizedRevealed[idx] = [...cards];
    }
  }

  const showdownRecord: ShowdownRecord = {
    handId: completion.handId,
    street: completion.endStreet,
    winnerSeatIndices: Array.from(winnersSet),
    isShowdown,
    revealedCardsBySeat: normalizedRevealed,
  };

  return {
    updatedPlayers,
    showdownRecord,
  };
}