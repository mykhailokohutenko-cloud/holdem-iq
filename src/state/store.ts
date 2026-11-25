import {
  computeRaiseEscalationMultiplier,
  computeSeatPositions,
  evaluateContextAndVerdict,
  getNextBtnSeat,
} from '../engine/contextAndVerdict';
import { getRemainingDeck, isValidCard, SUITS } from '../engine/deck';
import { calculateBaseProbabilities } from '../engine/probabilities';
import type {
  Card,
  EngineOutput,
  HandEvent,
  HandParticipant,
  HandState,
  MatrixCellUI,
  MatrixZone,
  ParticipantStatus,
  PlayerAction,
  PlayerInsightUI,
  PlayerMemory,
  RankChar,
  RelativeTurnOrder,
  SeatConfig,
  SessionState,
  Street,
} from '../engine/types';
import {
  applyHandCompletionToMemory,
  createInitialPlayerMemory,
  recomputePlayerProfile,
  type HandCompletionInput,
} from './memory';

export const SESSION_STORAGE_KEY = 'holdemiq_session_v1';

export interface PokerStoreSnapshot {
  session: SessionState;
  hand: HandState;
  engine: EngineOutput;
  awaitingFirstPostResetPick?: boolean;
  firstActionSeatAfterReset?: number;
}

export interface MidHandEntryInput {
  boardCards: readonly Card[];
  myCards?: readonly [Card | null, Card | null];
  mySeat?: number | null;
  btnSeat?: number;
  foldedSeatIndices?: readonly number[];
  knownDeadCards?: readonly Card[];
}

export interface RecordPlayerActionInput {
  seatIndex: number;
  action: PlayerAction;
  street?: Exclude<Street, 'Showdown'>;
  relOrder?: RelativeTurnOrder;
}

export interface CompleteHandInput {
  winnerSeatIndices?: readonly number[];
  isShowdown?: boolean;
  revealedCardsBySeat?: Record<number, readonly Card[]>;
  autoStartNextHand?: boolean;
}

const MATRIX_RANKS: readonly RankChar[] = [
  'A',
  'K',
  'Q',
  'J',
  'T',
  '9',
  '8',
  '7',
  '6',
  '5',
  '4',
  '3',
  '2',
] as const;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeParticipantStatus(raw: unknown): ParticipantStatus {
  if (raw === 'active' || raw === 'folded' || raw === 'eliminated') {
    return raw;
  }
  if (raw === 'sittingOut') {
    return 'eliminated';
  }
  return 'active';
}

export function normalizeTableSize(nTable: number): number {
  if (!Number.isFinite(nTable)) return 6;
  return clamp(Math.trunc(nTable), 2, 15);
}

export function normalizeSeatIndex(seatIndex: number, nTable: number): number {
  const safeTable = normalizeTableSize(nTable);
  if (!Number.isFinite(seatIndex)) return 0;
  return ((Math.trunc(seatIndex) % safeTable) + safeTable) % safeTable;
}

export function computeFirstActionSeatAfterBb(
  nTable: number,
  btnSeat: number,
  mySeat: number | null,
  street: Street,
  participants: Record<number, HandParticipant>
): number {
  const safe = normalizeTableSize(nTable);
  const pos = computeSeatPositions(safe, btnSeat, mySeat, street, participants);
  const start = normalizeSeatIndex(pos.bb + 1, safe);

  for (let step = 0; step < safe; step++) {
    const candidate = (start + step) % safe;
    const st = normalizeParticipantStatus(participants[candidate]?.status);
    if (st !== 'eliminated') {
      return candidate;
    }
  }

  return start;
}

export function createSeatsForTable(
  nTable: number,
  mySeat: number | null = 0,
  existingPlayers: Record<string, PlayerMemory> = {}
): SeatConfig[] {
  const safeTable = normalizeTableSize(nTable);
  const validMySeat =
    mySeat != null && mySeat >= 0 && mySeat < safeTable
      ? Math.trunc(mySeat)
      : null;

  const seats: SeatConfig[] = [];
  for (let i = 0; i < safeTable; i++) {
    const isMe = validMySeat === i;
    const playerId = isMe ? 'me' : `seat-${i}`;
    const name = isMe
      ? 'Я'
      : existingPlayers[playerId]?.name || `Игрок #${i + 1}`;
    seats.push({
      seatIndex: i,
      playerId,
      name,
      isMe,
    });
  }
  return seats;
}

export function inferStreetFromBoard(boardCount: number): Street {
  if (boardCount >= 5) return 'River';
  if (boardCount === 4) return 'Turn';
  if (boardCount >= 3) return 'Flop';
  return 'Pre';
}

function createInitialParticipants(
  seats: readonly SeatConfig[],
  foldedSet: ReadonlySet<number> = new Set(),
  eliminatedSet: ReadonlySet<number> = new Set()
): Record<number, HandParticipant> {
  const participants: Record<number, HandParticipant> = {};
  for (const seat of seats) {
    const isEliminated = eliminatedSet.has(seat.seatIndex);
    const isFolded = !isEliminated && foldedSet.has(seat.seatIndex);
    participants[seat.seatIndex] = {
      seatIndex: seat.seatIndex,
      playerId: seat.playerId,
      status: isEliminated ? 'eliminated' : isFolded ? 'folded' : 'active',
      isAllIn: false,
      foldedOnStreet: isFolded ? 'Pre' : undefined,
    };
  }
  return participants;
}

export function createInitialSession(
  nTable: number = 6,
  mySeat: number | null = 0
): SessionState {
  const safeTable = normalizeTableSize(nTable);
  const seats = createSeatsForTable(safeTable, mySeat, {});
  const players: Record<string, PlayerMemory> = {};

  for (const seat of seats) {
    if (!seat.isMe) {
      players[seat.playerId] = createInitialPlayerMemory(seat.playerId, seat.name);
    }
  }

  return {
    sessionId: `session-${Date.now()}`,
    nTable: safeTable,
    seats,
    players,
    showdownHistory: [],
  };
}

export function createInitialHand(
  session: SessionState,
  options: {
    handId?: number;
    btnSeat?: number;
    mySeat?: number | null;
    myCards?: readonly [Card | null, Card | null];
    boardCards?: readonly Card[];
    knownDeadCards?: readonly Card[];
    entryMode?: 'PreflopStart' | 'MidHandEntry';
    foldedSeatIndices?: readonly number[];
    eliminatedSeatIndices?: readonly number[];
  } = {}
): HandState {
  const nTable = normalizeTableSize(session.nTable);
  const defaultMySeat =
    session.seats.find((s) => s.isMe)?.seatIndex ?? null;
  const mySeat =
    options.mySeat !== undefined ? options.mySeat : defaultMySeat;
  const safeMySeat =
    mySeat != null && mySeat >= 0 && mySeat < nTable
      ? Math.trunc(mySeat)
      : null;

  const btnSeat = normalizeSeatIndex(options.btnSeat ?? 0, nTable);
  const validBoard = (options.boardCards ?? []).filter(isValidCard).slice(0, 5);
  const c0 =
    options.myCards?.[0] && isValidCard(options.myCards[0])
      ? options.myCards[0]
      : null;
  const c1 =
    options.myCards?.[1] && isValidCard(options.myCards[1])
      ? options.myCards[1]
      : null;
  const validDead = (options.knownDeadCards ?? []).filter(isValidCard);

  const foldedSet = new Set<number>(
    (options.foldedSeatIndices ?? []).map((idx) =>
      normalizeSeatIndex(idx, nTable)
    )
  );
  const eliminatedSet = new Set<number>(
    (options.eliminatedSeatIndices ?? []).map((idx) =>
      normalizeSeatIndex(idx, nTable)
    )
  );
  const participants = createInitialParticipants(
    session.seats,
    foldedSet,
    eliminatedSet
  );

  return {
    handId: options.handId ?? 1,
    street:
      options.entryMode === 'MidHandEntry'
        ? inferStreetFromBoard(validBoard.length)
        : 'Pre',
    entryMode: options.entryMode ?? 'PreflopStart',
    btnSeat,
    mySeat: safeMySeat,
    myCards: [c0, c1],
    boardCards: validBoard,
    knownDeadCards: validDead,
    participants,
    events: [],
  };
}

export function saveSessionToStorage(
  session: SessionState,
  storage?: Storage | null
): boolean {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof globalThis !== 'undefined' && 'localStorage' in globalThis
        ? globalThis.localStorage
        : null;

  if (!targetStorage || typeof targetStorage.setItem !== 'function') {
    return false;
  }

  try {
    const payload = JSON.stringify(session);
    targetStorage.setItem(SESSION_STORAGE_KEY, payload);
    return true;
  } catch {
    return false;
  }
}

export function loadSessionFromStorage(
  storage?: Storage | null
): SessionState | null {
  const targetStorage =
    storage !== undefined
      ? storage
      : typeof globalThis !== 'undefined' && 'localStorage' in globalThis
        ? globalThis.localStorage
        : null;

  if (!targetStorage || typeof targetStorage.getItem !== 'function') {
    return null;
  }

  try {
    const raw = targetStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<SessionState>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const nTable = normalizeTableSize(Number(parsed.nTable ?? 6));
    const rawSeats = Array.isArray(parsed.seats) ? parsed.seats : [];
    const existingMySeat =
      rawSeats.find((s) => Boolean(s && s.isMe))?.seatIndex ?? 0;

    const players: Record<string, PlayerMemory> = {};
    if (parsed.players && typeof parsed.players === 'object') {
      for (const [playerId, rawMem] of Object.entries(parsed.players)) {
        if (!rawMem || typeof rawMem !== 'object') continue;
        const base = createInitialPlayerMemory(
          playerId,
          typeof rawMem.name === 'string' && rawMem.name.trim()
            ? rawMem.name
            : playerId
        );
        const draft: PlayerMemory = {
          ...base,
          nHandsDecayed: Number.isFinite(Number(rawMem.nHandsDecayed))
            ? Math.max(0, Number(rawMem.nHandsDecayed))
            : 0,
          nFlopDecayed: Number.isFinite(Number(rawMem.nFlopDecayed))
            ? Math.max(0, Number(rawMem.nFlopDecayed))
            : 0,
          nTurnDecayed: Number.isFinite(Number(rawMem.nTurnDecayed))
            ? Math.max(0, Number(rawMem.nTurnDecayed))
            : 0,
          nRiverDecayed: Number.isFinite(Number(rawMem.nRiverDecayed))
            ? Math.max(0, Number(rawMem.nRiverDecayed))
            : 0,
          nRaiseDecayed: Number.isFinite(Number(rawMem.nRaiseDecayed))
            ? Math.max(0, Number(rawMem.nRaiseDecayed))
            : 0,
          nCcDecayed: Number.isFinite(Number(rawMem.nCcDecayed))
            ? Math.max(0, Number(rawMem.nCcDecayed))
            : 0,
          nFoldDecayed: Number.isFinite(Number(rawMem.nFoldDecayed))
            ? Math.max(0, Number(rawMem.nFoldDecayed))
            : 0,
          nFoldToRaiseDecayed: Number.isFinite(
            Number(rawMem.nFoldToRaiseDecayed)
          )
            ? Math.max(0, Number(rawMem.nFoldToRaiseDecayed))
            : 0,
          nShowdownsTotal: Number.isFinite(Number(rawMem.nShowdownsTotal))
            ? Math.max(0, Number(rawMem.nShowdownsTotal))
            : 0,
          nWinsTotal: Number.isFinite(Number(rawMem.nWinsTotal))
            ? Math.max(0, Number(rawMem.nWinsTotal))
            : 0,
          nRevDecayed: Number.isFinite(Number(rawMem.nRevDecayed))
            ? Math.max(0, Number(rawMem.nRevDecayed))
            : 0,
          sQDecayed: Number.isFinite(Number(rawMem.sQDecayed))
            ? clamp(Number(rawMem.sQDecayed), -100, 100)
            : 0,
        };
        const profile = recomputePlayerProfile(draft);
        players[playerId] = {
          ...draft,
          phi: profile.phi,
          styleTag: profile.styleTag,
        };
      }
    }

    const seats = createSeatsForTable(nTable, existingMySeat, players);
    for (let i = 0; i < seats.length; i++) {
      const candidate = rawSeats[i];
      if (
        candidate &&
        typeof candidate.name === 'string' &&
        candidate.name.trim()
      ) {
        seats[i] = {
          ...seats[i],
          name: candidate.isMe ? 'Я' : candidate.name.trim(),
        };
      }
      if (!seats[i].isMe && !players[seats[i].playerId]) {
        players[seats[i].playerId] = createInitialPlayerMemory(
          seats[i].playerId,
          seats[i].name
        );
      }
    }

    const showdownHistory = Array.isArray(parsed.showdownHistory)
      ? parsed.showdownHistory.filter(
          (rec): rec is SessionState['showdownHistory'][number] =>
            Boolean(
              rec && typeof rec === 'object' && typeof rec.handId === 'number'
            )
        )
      : [];

    return {
      sessionId:
        typeof parsed.sessionId === 'string' && parsed.sessionId
          ? parsed.sessionId
          : `session-${Date.now()}`,
      nTable,
      seats,
      players,
      showdownHistory,
    };
  } catch {
    return null;
  }
}

function pickRepresentativePair(
  rowIdx: number,
  colIdx: number,
  myCards: readonly [Card | null, Card | null],
  remainingDeck: readonly Card[]
): [Card, Card] | null {
  const r1 = MATRIX_RANKS[rowIdx];
  const r2 = MATRIX_RANKS[colIdx];
  const isPair = rowIdx === colIdx;
  const isSuited = rowIdx < colIdx;

  if (myCards[0] && myCards[1]) {
    const c0 = myCards[0];
    const c1 = myCards[1];
    const r0 = c0[0] as RankChar;
    const r0b = c1[0] as RankChar;
    const sameOrder =
      (r0 === r1 && r0b === r2) || (r0 === r2 && r0b === r1);
    const sameSuit = c0[1] === c1[1];
    if (
      sameOrder &&
      (isPair ? !sameSuit : isSuited ? sameSuit : !sameSuit)
    ) {
      return [c0, c1];
    }
  }

  const remSet = new Set(remainingDeck);

  if (isPair) {
    const matching = remainingDeck.filter((c) => c[0] === r1);
    if (matching.length >= 2) {
      return [matching[0], matching[1]];
    }
    return null;
  }

  if (isSuited) {
    for (const s of SUITS) {
      const a = `${r1}${s}` as Card;
      const b = `${r2}${s}` as Card;
      if (remSet.has(a) && remSet.has(b) && a !== b) {
        return [a, b];
      }
    }
    return null;
  }

  const firstCandidates = remainingDeck.filter((c) => c[0] === r1);
  const secondCandidates = remainingDeck.filter((c) => c[0] === r2);
  for (const a of firstCandidates) {
    for (const b of secondCandidates) {
      if (a !== b && a[1] !== b[1]) {
        return [a, b];
      }
    }
  }
  return null;
}

function buildReactiveMatrix13x13(params: {
  myCards: readonly [Card | null, Card | null];
  boardCards: readonly Card[];
  remainingDeck: readonly Card[];
  nTable: number;
  nActive: number;
  street: Street;
  handId: number;
  thetaCall: number;
  thetaRaise: number;
  posScore: number;
  raisesOnStreet: number;
  nAiOpp: number;
  baseProbs: ReturnType<typeof calculateBaseProbabilities>;
  currentEEff: number;
}): MatrixCellUI[] {
  const {
    myCards,
    remainingDeck,
    nTable,
    nActive,
    street,
    thetaCall,
    thetaRaise,
    posScore,
    raisesOnStreet,
    nAiOpp,
    baseProbs,
    currentEEff,
  } = params;

  const myRank1 = myCards[0] ? (myCards[0][0] as RankChar) : null;
  const myRank2 = myCards[1] ? (myCards[1][0] as RankChar) : null;
  const mySuited =
    myCards[0] && myCards[1] ? myCards[0][1] === myCards[1][1] : false;

  const cells: MatrixCellUI[] = [];

  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const r1 = MATRIX_RANKS[row];
      const r2 = MATRIX_RANKS[col];
      const isPair = row === col;
      const isSuited = row < col;
      const label = isPair
        ? `${r1}${r2}`
        : isSuited
          ? `${r1}${r2}s`
          : `${r2}${r1}o`;

      const isMyHand =
        Boolean(myRank1 && myRank2) &&
        ((myRank1 === r1 && myRank2 === r2) ||
          (myRank1 === r2 && myRank2 === r1)) &&
        (isPair ? true : mySuited === isSuited);

      const pair = pickRepresentativePair(row, col, myCards, remainingDeck);
      const blocked = pair === null;

      if (blocked) {
        cells.push({
          row,
          col,
          label,
          isPair,
          isSuited,
          isMyHand,
          blocked: true,
          eEff: 0,
          zone: 'BLOCKED',
          intensity: 0.08,
        });
        continue;
      }

      if (isMyHand) {
        const zone: MatrixZone =
          currentEEff >= thetaRaise
            ? 'RAISE_ZONE'
            : currentEEff >= thetaCall
              ? 'CALL_CHECK_ZONE'
              : 'FOLD_ZONE';
        const span = Math.max(0.05, thetaRaise - thetaCall);
        const intensity = clamp(
          0.5 + (currentEEff - thetaCall) / (2 * span),
          0.08,
          1
        );
        cells.push({
          row,
          col,
          label,
          isPair,
          isSuited,
          isMyHand: true,
          blocked: false,
          eEff: currentEEff,
          zone,
          intensity,
        });
        continue;
      }

      const v1 = 13 - row;
      const v2 = 13 - col;
      const high = Math.max(v1, v2);
      const low = Math.min(v1, v2);
      const gap = Math.abs(v1 - v2);

      let rawScore = high * 0.036 + low * 0.02;
      if (isPair) rawScore += 0.22 + (high / 13) * 0.14;
      if (isSuited) rawScore += 0.055;
      if (!isPair && gap === 1) rawScore += 0.03;
      if (!isPair && gap >= 4) rawScore -= 0.06;

      const boardInfluence =
        street === 'Pre'
          ? 0
          : (baseProbs.pWinRaw - 0.5) * 0.18 + baseProbs.pDrawPlus * 0.08;

      const escalationFactor =
        raisesOnStreet > 0
          ? computeRaiseEscalationMultiplier(raisesOnStreet)
          : 1;
      const pressurePen =
        (nActive - 2) * 0.02 +
        Math.max(0, escalationFactor - 1) * 0.14 +
        nAiOpp * 0.13 +
        (nTable >= 10 ? 0.02 : 0) -
        (posScore - 0.5) * 0.12;

      const eEff = clamp(rawScore + boardInfluence - pressurePen, 0, 1);

      let zone: MatrixZone;
      if (eEff >= thetaRaise) {
        zone = 'RAISE_ZONE';
      } else if (eEff >= thetaCall) {
        zone = 'CALL_CHECK_ZONE';
      } else {
        zone = 'FOLD_ZONE';
      }

      const span = Math.max(0.05, thetaRaise - thetaCall);
      const intensity = clamp(
        0.5 + (eEff - thetaCall) / (2 * span),
        0.08,
        1
      );

      cells.push({
        row,
        col,
        label,
        isPair,
        isSuited,
        isMyHand: false,
        blocked: false,
        eEff,
        zone,
        intensity,
      });
    }
  }

  return cells;
}

export function computeEngineOutput(
  session: SessionState,
  hand: HandState
): EngineOutput {
  const nTable = normalizeTableSize(session.nTable);
  const btnSeat = normalizeSeatIndex(hand.btnSeat, nTable);

  const nonEliminatedSeats = session.seats.filter((s) => {
    const st = normalizeParticipantStatus(hand.participants[s.seatIndex]?.status);
    return st !== 'eliminated';
  });

  const activeParticipants = Object.values(hand.participants).filter(
    (p) => normalizeParticipantStatus(p.status) === 'active'
  );

  const maxAllowedActive = Math.max(2, Math.min(nTable, nonEliminatedSeats.length));
  const nActive = clamp(
    activeParticipants.length > 0 ? activeParticipants.length : maxAllowedActive,
    2,
    maxAllowedActive
  );

  const validBoard = hand.boardCards.filter(isValidCard).slice(0, 5);
  const safeBoard = [0, 3, 4, 5].includes(validBoard.length)
    ? validBoard
    : validBoard.slice(0, 3);

  const validDead = hand.knownDeadCards.filter((card) => {
    if (!isValidCard(card)) return false;
    if (hand.myCards[0] === card || hand.myCards[1] === card) return false;
    if (safeBoard.includes(card)) return false;
    return true;
  });

  const remainingDeck = getRemainingDeck({
    handCards: hand.myCards,
    boardCards: safeBoard,
    knownDeadCards: validDead,
  });

  const boardNeeded = Math.max(0, 5 - safeBoard.length);
  const maxOppByDeck = Math.max(
    1,
    Math.floor((remainingDeck.length - boardNeeded) / 2)
  );
  const effectiveActive = clamp(nActive, 2, Math.min(nTable, maxOppByDeck + 1));

  const baseProbs = calculateBaseProbabilities({
    myCards: hand.myCards,
    boardCards: safeBoard,
    knownDeadCards: validDead,
    nTable,
    nActive: effectiveActive,
    iterations: 900,
    seed:
      hand.handId * 1009 +
      nTable * 97 +
      effectiveActive * 31 +
      safeBoard.length * 13 +
      hand.events.length * 7,
  });

  const ctx = evaluateContextAndVerdict({
    nTable,
    btnSeat,
    mySeat: hand.mySeat,
    myCards: hand.myCards,
    boardCards: safeBoard,
    street: hand.street,
    seats: session.seats,
    participants: hand.participants,
    events: hand.events,
    playerMemoriesById: session.players,
    probabilities: baseProbs,
  });

  const nonEliminatedCount = Math.max(2, nonEliminatedSeats.length);
  const canEliminateGlobal = nonEliminatedCount > 2;

  const playerInsights: Record<string, PlayerInsightUI> = {};
  for (const seat of session.seats) {
    if (seat.isMe) continue;
    const participant = hand.participants[seat.seatIndex];
    const status = normalizeParticipantStatus(participant?.status);
    const mem =
      session.players[seat.playerId] ??
      createInitialPlayerMemory(seat.playerId, seat.name);

    playerInsights[seat.playerId] = {
      playerId: seat.playerId,
      seatIndex: seat.seatIndex,
      name: seat.name,
      status,
      isAllIn: Boolean(participant?.isAllIn && status === 'active'),
      canEliminate: status !== 'eliminated' && canEliminateGlobal,
      canResume: status === 'eliminated',
      phi: mem.phi,
      styleTag: mem.styleTag,
      effectiveSamples: Number(mem.nHandsDecayed.toFixed(2)),
      nShowdownsTotal: mem.nShowdownsTotal,
      nWinsTotal: mem.nWinsTotal,
    };
  }

  const matrix13x13 = buildReactiveMatrix13x13({
    myCards: hand.myCards,
    boardCards: safeBoard,
    remainingDeck,
    nTable,
    nActive: ctx.nActive,
    street: hand.street,
    handId: hand.handId,
    thetaCall: ctx.verdict.thetaCall,
    thetaRaise: ctx.verdict.thetaRaise,
    posScore: ctx.positions.posScore,
    raisesOnStreet: ctx.raisesOnStreet,
    nAiOpp: ctx.nAiOpp,
    baseProbs,
    currentEEff: ctx.verdict.eEff,
  });

  return {
    nTable: ctx.nTable,
    nActive: ctx.nActive,
    nOpp: ctx.nOpp,
    nAiOpp: ctx.nAiOpp,
    aiMe: ctx.aiMe,
    raisesOnStreet: ctx.raisesOnStreet,
    raiseMultipleLabel: ctx.raiseMultipleLabel,
    suggestAllInSlash: ctx.suggestAllInSlash,
    positions: ctx.positions,
    turnContext: ctx.turnContext,
    probabilities: {
      pWinRaw: baseProbs.pWinRaw,
      pWinAdj: ctx.adjustedProbabilities.pWinAdj,
      pTie: ctx.adjustedProbabilities.pTie,
      pLoseAdj: ctx.adjustedProbabilities.pLoseAdj,
      combinations: baseProbs.combinations,
      pDrawPlus: baseProbs.pDrawPlus,
      myHandStrengthPct: ctx.adjustedProbabilities.myHandStrengthPct,
      oppThreatPct: ctx.adjustedProbabilities.oppThreatPct,
    },
    matrix13x13,
    verdict: ctx.verdict,
    playerInsights,
  };
}

export class PokerStore {
  private session: SessionState;
  private hand: HandState;
  private engine: EngineOutput;
  private storage: Storage | null;
  private awaitingFirstPostResetPick: boolean = false;
  private listeners = new Set<(snapshot: PokerStoreSnapshot) => void>();

  constructor(
    options: {
      initialSession?: SessionState;
      initialHand?: HandState;
      storage?: Storage | null;
      loadSavedSession?: boolean;
    } = {}
  ) {
    this.storage =
      options.storage !== undefined
        ? options.storage
        : typeof globalThis !== 'undefined' && 'localStorage' in globalThis
          ? globalThis.localStorage
          : null;

    const loaded =
      options.initialSession ??
      (options.loadSavedSession !== false
        ? loadSessionFromStorage(this.storage)
        : null);

    this.session = loaded ?? createInitialSession(6, 0);
    const lastShowdown =
      this.session.showdownHistory.length > 0
        ? this.session.showdownHistory[this.session.showdownHistory.length - 1]
        : undefined;
    this.hand =
      options.initialHand ??
      createInitialHand(this.session, {
        handId: (lastShowdown?.handId ?? 0) + 1,
        btnSeat: 0,
        mySeat: this.session.seats.find((s) => s.isMe)?.seatIndex ?? 0,
      });
    this.engine = computeEngineOutput(this.session, this.hand);
  }

  public getSnapshot(): PokerStoreSnapshot {
    return {
      session: this.session,
      hand: this.hand,
      engine: this.engine,
      awaitingFirstPostResetPick: this.awaitingFirstPostResetPick,
      firstActionSeatAfterReset: computeFirstActionSeatAfterBb(
        this.session.nTable,
        this.hand.btnSeat,
        this.hand.mySeat,
        this.hand.street,
        this.hand.participants
      ),
    };
  }

  public consumePostResetFocus(): PokerStoreSnapshot {
    if (!this.awaitingFirstPostResetPick) {
      return this.getSnapshot();
    }
    this.awaitingFirstPostResetPick = false;
    return this.commit(false);
  }

  public subscribe(
    listener: (snapshot: PokerStoreSnapshot) => void
  ): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private commit(persistSession: boolean): PokerStoreSnapshot {
    this.engine = computeEngineOutput(this.session, this.hand);
    if (persistSession) {
      saveSessionToStorage(this.session, this.storage);
    }
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
    return snapshot;
  }

  public setTableSize(nextNTable: number): PokerStoreSnapshot {
    const safeTable = normalizeTableSize(nextNTable);
    const currentMySeat =
      this.hand.mySeat != null && this.hand.mySeat < safeTable
        ? this.hand.mySeat
        : 0;

    const updatedPlayers: Record<string, PlayerMemory> = {
      ...this.session.players,
    };
    const seats = createSeatsForTable(safeTable, currentMySeat, updatedPlayers);

    for (const seat of seats) {
      if (!seat.isMe && !updatedPlayers[seat.playerId]) {
        updatedPlayers[seat.playerId] = createInitialPlayerMemory(
          seat.playerId,
          seat.name
        );
      }
    }

    this.session = {
      ...this.session,
      nTable: safeTable,
      seats,
      players: updatedPlayers,
    };

    const nextParticipants: Record<number, HandParticipant> = {};
    for (const seat of seats) {
      const prevP = this.hand.participants[seat.seatIndex];
      nextParticipants[seat.seatIndex] = prevP
        ? {
            ...prevP,
            seatIndex: seat.seatIndex,
            playerId: seat.playerId,
            status: normalizeParticipantStatus(prevP.status),
          }
        : {
            seatIndex: seat.seatIndex,
            playerId: seat.playerId,
            status: 'active',
            isAllIn: false,
          };
    }

    const safeBtn = getNextBtnSeat(
      normalizeSeatIndex(this.hand.btnSeat, safeTable) - 1,
      safeTable,
      nextParticipants
    );

    this.hand = {
      ...this.hand,
      btnSeat: safeBtn,
      mySeat: currentMySeat,
      participants: nextParticipants,
    };

    return this.commit(true);
  }

  public setMySeat(mySeat: number | null): PokerStoreSnapshot {
    const nTable = this.session.nTable;
    const safeMySeat =
      mySeat != null && mySeat >= 0 && mySeat < nTable
        ? Math.trunc(mySeat)
        : null;

    const nextSeats = createSeatsForTable(
      nTable,
      safeMySeat,
      this.session.players
    );
    const nextPlayers: Record<string, PlayerMemory> = {
      ...this.session.players,
    };
    for (const seat of nextSeats) {
      if (!seat.isMe && !nextPlayers[seat.playerId]) {
        nextPlayers[seat.playerId] = createInitialPlayerMemory(
          seat.playerId,
          seat.name
        );
      }
    }

    this.session = {
      ...this.session,
      seats: nextSeats,
      players: nextPlayers,
    };

    const nextParticipants: Record<number, HandParticipant> = {};
    for (const seat of nextSeats) {
      const prevP = this.hand.participants[seat.seatIndex];
      nextParticipants[seat.seatIndex] = {
        seatIndex: seat.seatIndex,
        playerId: seat.playerId,
        status: normalizeParticipantStatus(prevP?.status),
        isAllIn: Boolean(prevP?.isAllIn),
        foldedOnStreet: prevP?.foldedOnStreet,
        foldedFacingRaise: prevP?.foldedFacingRaise,
        eliminatedOnHandId: prevP?.eliminatedOnHandId,
        eliminatedOnStreet: prevP?.eliminatedOnStreet,
      };
    }

    this.hand = {
      ...this.hand,
      mySeat: safeMySeat,
      participants: nextParticipants,
    };

    return this.commit(true);
  }

  public setBtnSeat(btnSeat: number): PokerStoreSnapshot {
    const safe = normalizeSeatIndex(btnSeat, this.session.nTable);
    const status = normalizeParticipantStatus(
      this.hand.participants[safe]?.status
    );
    const targetBtn =
      status === 'eliminated'
        ? getNextBtnSeat(safe, this.session.nTable, this.hand.participants)
        : safe;

    this.hand = {
      ...this.hand,
      btnSeat: targetBtn,
    };
    return this.commit(false);
  }

  public eliminatePlayer(seatIndex: number): PokerStoreSnapshot {
    const nTable = this.session.nTable;
    const target = normalizeSeatIndex(seatIndex, nTable);
    const nonEliminatedCount = this.session.seats.filter(
      (s) =>
        normalizeParticipantStatus(this.hand.participants[s.seatIndex]?.status) !==
        'eliminated'
    ).length;

    if (nonEliminatedCount <= 2) {
      return this.getSnapshot();
    }

    const currentP = this.hand.participants[target];
    if (!currentP || normalizeParticipantStatus(currentP.status) === 'eliminated') {
      return this.getSnapshot();
    }

    const activeStreet: Exclude<Street, 'Showdown'> =
      this.hand.street === 'Showdown' ? 'River' : this.hand.street;

    const nextParticipants: Record<number, HandParticipant> = {
      ...this.hand.participants,
      [target]: {
        ...currentP,
        status: 'eliminated',
        isAllIn: false,
        eliminatedOnHandId: this.hand.handId,
        eliminatedOnStreet: activeStreet,
      },
    };

    const nextBtn =
      this.hand.btnSeat === target
        ? getNextBtnSeat(target, nTable, nextParticipants)
        : this.hand.btnSeat;

    this.hand = {
      ...this.hand,
      btnSeat: nextBtn,
      participants: nextParticipants,
    };

    return this.commit(true);
  }

  public resumePlayer(
    seatIndex: number,
    options: { resetMemory?: boolean } = {}
  ): PokerStoreSnapshot {
    const nTable = this.session.nTable;
    const target = normalizeSeatIndex(seatIndex, nTable);
    const seatCfg = this.session.seats[target];
    if (!seatCfg) return this.getSnapshot();

    const currentP = this.hand.participants[target] ?? {
      seatIndex: target,
      playerId: seatCfg.playerId,
      status: 'eliminated' as const,
      isAllIn: false,
    };

    if (options.resetMemory && !seatCfg.isMe) {
      this.session = {
        ...this.session,
        players: {
          ...this.session.players,
          [seatCfg.playerId]: createInitialPlayerMemory(
            seatCfg.playerId,
            seatCfg.name
          ),
        },
      };
    }

    this.hand = {
      ...this.hand,
      participants: {
        ...this.hand.participants,
        [target]: {
          ...currentP,
          seatIndex: target,
          playerId: seatCfg.playerId,
          status: 'active',
          isAllIn: false,
          eliminatedOnHandId: undefined,
          eliminatedOnStreet: undefined,
        },
      },
    };

    return this.commit(true);
  }

  public setMyCard(slotIndex: 0 | 1, card: Card | null): PokerStoreSnapshot {
    this.awaitingFirstPostResetPick = false;
    const nextCards: [Card | null, Card | null] = [...this.hand.myCards] as [
      Card | null,
      Card | null,
    ];
    if (card != null) {
      if (!isValidCard(card)) return this.getSnapshot();
      const otherSlot = slotIndex === 0 ? 1 : 0;
      if (
        nextCards[otherSlot] === card ||
        this.hand.boardCards.includes(card)
      ) {
        return this.getSnapshot();
      }
    }
    nextCards[slotIndex] = card;

    this.hand = {
      ...this.hand,
      myCards: nextCards,
    };
    return this.commit(false);
  }

  public setBoardCards(boardCards: readonly Card[]): PokerStoreSnapshot {
    this.awaitingFirstPostResetPick = false;
    const cleaned: Card[] = [];
    for (const c of boardCards) {
      if (!isValidCard(c)) continue;
      if (cleaned.includes(c)) continue;
      if (this.hand.myCards[0] === c || this.hand.myCards[1] === c) continue;
      cleaned.push(c);
      if (cleaned.length === 5) break;
    }

    const nextStreet =
      this.hand.street === 'Showdown'
        ? 'Showdown'
        : inferStreetFromBoard(cleaned.length);

    this.hand = {
      ...this.hand,
      boardCards: cleaned,
      street: nextStreet,
    };

    return this.commit(false);
  }

  public enterMidHand(input: MidHandEntryInput): PokerStoreSnapshot {
    this.awaitingFirstPostResetPick = false;
    const nTable = this.session.nTable;
    const validBoard = input.boardCards.filter(isValidCard).slice(0, 5);
    const street = inferStreetFromBoard(validBoard.length);

    const nextMySeat =
      input.mySeat !== undefined
        ? input.mySeat != null && input.mySeat >= 0 && input.mySeat < nTable
          ? Math.trunc(input.mySeat)
          : null
        : this.hand.mySeat;

    const c0 =
      input.myCards?.[0] && isValidCard(input.myCards[0])
        ? input.myCards[0]
        : this.hand.myCards[0];
    const c1 =
      input.myCards?.[1] && isValidCard(input.myCards[1])
        ? input.myCards[1]
        : this.hand.myCards[1];

    const safeMyCards: [Card | null, Card | null] = [
      c0,
      c1 && c1 !== c0 ? c1 : null,
    ];

    const safeBoard = validBoard.filter(
      (card) => card !== safeMyCards[0] && card !== safeMyCards[1]
    );

    const eliminatedSet = new Set<number>(
      this.session.seats
        .filter(
          (s) =>
            normalizeParticipantStatus(
              this.hand.participants[s.seatIndex]?.status
            ) === 'eliminated'
        )
        .map((s) => s.seatIndex)
    );

    const foldedSet = new Set<number>(
      (input.foldedSeatIndices ?? []).map((idx) =>
        normalizeSeatIndex(idx, nTable)
      )
    );

    const participants = createInitialParticipants(
      this.session.seats,
      foldedSet,
      eliminatedSet
    );
    for (const idx of foldedSet) {
      if (participants[idx] && participants[idx].status !== 'eliminated') {
        participants[idx] = {
          ...participants[idx],
          status: 'folded',
          foldedOnStreet: street === 'Showdown' ? 'River' : street,
        };
      }
    }

    const nextDead = (input.knownDeadCards ?? []).filter(
      (card) =>
        isValidCard(card) &&
        card !== safeMyCards[0] &&
        card !== safeMyCards[1] &&
        !safeBoard.includes(card)
    );

    this.hand = {
      ...this.hand,
      street,
      entryMode: 'MidHandEntry',
      btnSeat:
        input.btnSeat !== undefined
          ? normalizeSeatIndex(input.btnSeat, nTable)
          : this.hand.btnSeat,
      mySeat: nextMySeat,
      myCards: safeMyCards,
      boardCards: safeBoard,
      knownDeadCards: nextDead,
      participants,
      events: [],
    };

    return this.commit(false);
  }

  public recordPlayerAction(input: RecordPlayerActionInput): PokerStoreSnapshot {
    this.awaitingFirstPostResetPick = false;
    const nTable = this.session.nTable;
    const seatIndex = normalizeSeatIndex(input.seatIndex, nTable);
    const seatCfg = this.session.seats[seatIndex];
    if (!seatCfg) return this.getSnapshot();

    const currentParticipant = this.hand.participants[seatIndex] ?? {
      seatIndex,
      playerId: seatCfg.playerId,
      status: 'active' as const,
      isAllIn: false,
    };

    const currentStatus = normalizeParticipantStatus(currentParticipant.status);
    if (currentStatus === 'eliminated') {
      return this.getSnapshot();
    }

    // Игрок в ALL-IN остаётся активным в раздаче, но не может совершать дальнейшие ставки/повышения/сбросы
    if (currentStatus === 'active' && currentParticipant.isAllIn) {
      return this.getSnapshot();
    }

    const eventStreet: Exclude<Street, 'Showdown'> =
      input.street ??
      (this.hand.street === 'Showdown' ? 'River' : this.hand.street);

    const hasPriorRaiseOnStreet = this.hand.events.some(
      (ev) =>
        ev.street === eventStreet &&
        (ev.action === 'RAISE' || ev.action === 'ALL_IN')
    );
    const facingRaise: 0 | 1 =
      input.action === 'RAISE' || input.action === 'ALL_IN' || hasPriorRaiseOnStreet
        ? 1
        : 0;

    const positions = computeSeatPositions(
      nTable,
      this.hand.btnSeat,
      this.hand.mySeat,
      eventStreet,
      this.hand.participants
    );

    const relOrder: RelativeTurnOrder =
      input.relOrder ??
      (this.hand.mySeat == null || positions.myRelPos == null
        ? 'UNKNOWN'
        : normalizeSeatIndex(seatIndex - positions.btn, nTable) <
            positions.myRelPos
          ? 'BEFORE_ME'
          : 'AFTER_ME');

    const newEvent: HandEvent = {
      id: `ev-${this.hand.handId}-${this.hand.events.length + 1}`,
      street: eventStreet,
      seatIndex,
      playerId: seatCfg.playerId,
      action: input.action,
      relOrder,
      facingRaise,
    };

    const nextParticipants: Record<number, HandParticipant> = {
      ...this.hand.participants,
    };

    if (input.action === 'FOLD') {
      const activeCount = Object.values(nextParticipants).filter(
        (p) => normalizeParticipantStatus(p.status) === 'active'
      ).length;
      if (currentStatus === 'active' && activeCount > 2) {
        nextParticipants[seatIndex] = {
          ...currentParticipant,
          status: 'folded',
          isAllIn: false,
          foldedOnStreet: eventStreet,
          foldedFacingRaise: facingRaise,
        };
      }
    } else if (input.action === 'ALL_IN') {
      nextParticipants[seatIndex] = {
        ...currentParticipant,
        status: 'active',
        isAllIn: true,
      };
    } else {
      nextParticipants[seatIndex] = {
        ...currentParticipant,
        status: 'active',
      };
    }

    this.hand = {
      ...this.hand,
      participants: nextParticipants,
      events: [...this.hand.events, newEvent],
    };

    return this.commit(false);
  }

  public completeHand(input: CompleteHandInput = {}): PokerStoreSnapshot {
    this.awaitingFirstPostResetPick = false;
    const endStreet: Exclude<Street, 'Showdown'> =
      this.hand.street === 'Showdown'
        ? inferStreetFromBoard(this.hand.boardCards.length) === 'Showdown'
          ? 'River'
          : (inferStreetFromBoard(this.hand.boardCards.length) as Exclude<
              Street,
              'Showdown'
            >)
        : this.hand.street;

    const completion: HandCompletionInput = {
      handId: this.hand.handId,
      endStreet,
      participants: this.hand.participants,
      events: this.hand.events,
      finalBoardCards: this.hand.boardCards,
      winnerSeatIndices: input.winnerSeatIndices,
      isShowdown: input.isShowdown,
      revealedCardsBySeat: input.revealedCardsBySeat,
    };

    const { updatedPlayers, showdownRecord } = applyHandCompletionToMemory(
      this.session.players,
      this.session.seats,
      completion
    );

    this.session = {
      ...this.session,
      players: updatedPlayers,
      showdownHistory: [...this.session.showdownHistory, showdownRecord],
    };

    if (input.autoStartNextHand) {
      return this.startNewHand();
    }

    this.hand = {
      ...this.hand,
      street: input.isShowdown ? 'Showdown' : this.hand.street,
    };

    return this.commit(true);
  }

  public startNewHand(): PokerStoreSnapshot {
    this.awaitingFirstPostResetPick = false;
    const nTable = this.session.nTable;
    const nextBtn = getNextBtnSeat(
      this.hand.btnSeat,
      nTable,
      this.hand.participants
    );
    const nextHandId = this.hand.handId + 1;

    const eliminatedSeatIndices = this.session.seats
      .filter(
        (s) =>
          normalizeParticipantStatus(
            this.hand.participants[s.seatIndex]?.status
          ) === 'eliminated'
      )
      .map((s) => s.seatIndex);

    this.hand = createInitialHand(this.session, {
      handId: nextHandId,
      btnSeat: nextBtn,
      mySeat: this.hand.mySeat,
      myCards: [null, null],
      boardCards: [],
      knownDeadCards: [],
      entryMode: 'PreflopStart',
      foldedSeatIndices: [],
      eliminatedSeatIndices,
    });

    return this.commit(true);
  }

  public resetFullGame(): PokerStoreSnapshot {
    const nTable = this.session.nTable;
    const mySeat = this.hand.mySeat ?? 0;

    if (this.storage && typeof this.storage.removeItem === 'function') {
      try {
        this.storage.removeItem(SESSION_STORAGE_KEY);
      } catch {
        // Игнорируем ошибку недоступного хранилища
      }
    }

    this.session = createInitialSession(nTable, mySeat);
    this.hand = createInitialHand(this.session, {
      handId: 1,
      btnSeat: 0,
      mySeat,
      myCards: [null, null],
      boardCards: [],
      knownDeadCards: [],
      entryMode: 'PreflopStart',
      foldedSeatIndices: [],
      eliminatedSeatIndices: [],
    });
    this.awaitingFirstPostResetPick = true;

    return this.commit(true);
  }

  public resetPlayerMemory(playerId: string): PokerStoreSnapshot {
    const seat = this.session.seats.find((s) => s.playerId === playerId);
    if (!seat || seat.isMe) return this.getSnapshot();

    this.session = {
      ...this.session,
      players: {
        ...this.session.players,
        [playerId]: createInitialPlayerMemory(playerId, seat.name),
      },
    };

    return this.commit(true);
  }
}