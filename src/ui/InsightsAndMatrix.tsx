import { useEffect, useMemo, useRef, useState } from 'react';
import { RANK_CHARS, SUITS, getRemainingDeck } from '../engine/deck';
import type {
  Card,
  EngineOutput,
  HandRankClass,
  HandState,
  MatrixCellUI,
  MatrixZone,
  PlayerInsightUI,
  PlayerStyleTag,
  RankChar,
  SessionState,
} from '../engine/types';

export interface InsightsAndMatrixProps {
  session: SessionState;
  hand: HandState;
  engine: EngineOutput;
  isShowdownMode: boolean;
  onToggleShowdownMode: (enabled: boolean) => void;
  selectedWinners: number[];
  onToggleWinner: (seatIndex: number) => void;
  revealedCardsBySeat: Record<number, [Card | null, Card | null]>;
  onSetRevealedCard: (seatIndex: number, slot: 0 | 1, card: Card | null) => void;
  onCompleteHand: (
    winnerSeatIndices: number[],
    isShowdown: boolean,
    revealedCardsBySeat?: Record<number, Card[]>
  ) => void;
  onStartNewHand: () => void;
  onStartNextHand?: () => void;
  onApplyMatrixHand?: (cardA: Card, cardB: Card) => void;
  onSelectMyCard?: (slotIndex: 0 | 1, card: Card | null) => void;
  onResumePlayer: (seatIndex: number, resetMemory?: boolean) => void;
  onResetPlayerMemory: (playerId: string) => void;
}

type ActiveTab = 'matrix' | 'players' | 'summary';
type SummaryMode = 'live' | 'post';

interface ComboDisplayItem {
  key: HandRankClass;
  label: string;
  myPct: number;
  oppPct: number;
}

const STYLE_LABEL_RU: Record<PlayerStyleTag, string> = {
  NEUTRAL: 'Обычный стиль',
  TIGHT_AGG: 'Тайтово-агрессивный',
  TIGHT_PASSIVE: 'Тайтово-пассивный',
  LOOSE_PASSIVE: 'Лузово-пассивный',
  LOOSE_AGG: 'Лузово-агрессивный',
};

const COMBO_META: ReadonlyArray<{
  key: HandRankClass;
  label: string;
  weight: number;
}> = [
  { key: 'PAIR', label: 'Пара', weight: 0.34 },
  { key: 'TWO_PAIR', label: 'Две пары', weight: 0.2 },
  { key: 'THREE_OF_A_KIND', label: 'Сет', weight: 0.12 },
  { key: 'STRAIGHT', label: 'Стрит', weight: 0.1 },
  { key: 'FLUSH', label: 'Флеш', weight: 0.09 },
  { key: 'FULL_HOUSE', label: 'Фулл-хаус', weight: 0.07 },
  { key: 'FOUR_OF_A_KIND', label: 'Каре', weight: 0.04 },
  { key: 'STRAIGHT_FLUSH', label: 'Стрит-флеш', weight: 0.02 },
];

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function getZoneStyle(
  zone: MatrixZone,
  isMyHand: boolean,
  blocked: boolean,
  isIdleWave: boolean,
  waveFactor = 0
): {
  bg: string;
  border: string;
  text: string;
} {
  if (isIdleWave) {
    const waveAlpha = (0.12 + waveFactor * 0.18).toFixed(2);
    const borderAlpha = (0.28 + waveFactor * 0.36).toFixed(2);
    return {
      bg: `rgba(var(--op-matrix-wave-rgb), ${waveAlpha})`,
      border: isMyHand
        ? 'var(--op-accent-gold)'
        : `rgba(var(--op-matrix-wave-rgb), ${borderAlpha})`,
      text: 'var(--op-text-primary)',
    };
  }
  if (blocked) {
    return {
      bg: 'var(--op-matrix-blocked)',
      border: 'var(--op-border-subtle)',
      text: 'var(--op-text-muted)',
    };
  }
  const goldBorder = isMyHand ? 'var(--op-accent-gold)' : undefined;
  if (zone === 'RAISE_ZONE') {
    return {
      bg: 'var(--op-matrix-raise)',
      border: goldBorder ?? 'var(--op-accent-primary)',
      text: 'var(--op-text-primary)',
    };
  }
  if (zone === 'CALL_CHECK_ZONE') {
    return {
      bg: 'var(--op-matrix-call)',
      border: goldBorder ?? 'var(--op-border-active)',
      text: 'var(--op-text-primary)',
    };
  }
  return {
    bg: 'var(--op-matrix-fold)',
    border: goldBorder ?? 'var(--op-border-subtle)',
    text: 'var(--op-text-secondary)',
  };
}

function buildFallbackMatrix13x13(
  hand: HandState,
  engine: EngineOutput,
  remainingDeck: readonly Card[]
): MatrixCellUI[] {
  const cells: MatrixCellUI[] = [];
  const myA = hand.myCards[0];
  const myB = hand.myCards[1];
  const myPairKey =
    myA && myB
      ? `${myA[0]}${myB[0]}${myA[1] === myB[1] ? 's' : 'o'}`
      : null;

  const raises = engine.raisesOnStreet ?? 0;
  const nAiOpp = engine.nAiOpp ?? 0;
  const thetaCall = Math.min(0.45, engine.verdict.thetaCall);
  const thetaRaise = Math.min(
    0.72,
    Math.max(thetaCall + 0.14, engine.verdict.thetaRaise)
  );

  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const r1 = RANK_CHARS[row];
      const r2 = RANK_CHARS[col];
      const isPair = row === col;
      const isSuited = row < col;
      const label = isPair
        ? `${r1}${r2}`
        : isSuited
          ? `${r1}${r2}s`
          : `${r2}${r1}o`;

      const matchingCards = remainingDeck.filter((c) => {
        if (isPair) return c[0] === r1;
        return c[0] === r1 || c[0] === r2;
      });

      const hasPairCandidate = isPair
        ? matchingCards.length >= 2
        : isSuited
          ? SUITS.some(
              (s) =>
                remainingDeck.includes(`${r1}${s}` as Card) &&
                remainingDeck.includes(`${r2}${s}` as Card)
            )
          : matchingCards.some((a) =>
              matchingCards.some(
                (b) => a[0] === r1 && b[0] === r2 && a[1] !== b[1]
              )
            );

      const blocked = !hasPairCandidate;
      const rankScore = (26 - (row + col)) / 24;
      const suitedBonus = isSuited ? 0.07 : 0;
      const pairBonus = isPair ? 0.16 : 0;
      const pressurePenalty = 0.04 * raises + 0.06 * nAiOpp;
      const posAdjust = 0.08 * (engine.positions.posScore - 0.5);

      const eEff = clamp(
        0.22 +
          rankScore * 0.58 +
          suitedBonus +
          pairBonus +
          posAdjust -
          pressurePenalty,
        0.08,
        0.99
      );

      const zone: MatrixZone = blocked
        ? 'BLOCKED'
        : eEff >= thetaRaise
          ? 'RAISE_ZONE'
          : eEff >= thetaCall
            ? 'CALL_CHECK_ZONE'
            : 'FOLD_ZONE';

      const isMyHand =
        Boolean(myPairKey && label === myPairKey) ||
        Boolean(
          myA &&
            myB &&
            ((myA[0] === r1 && myB[0] === r2) ||
              (myA[0] === r2 && myB[0] === r1))
        );

      cells.push({
        row,
        col,
        label,
        isPair,
        isSuited,
        isMyHand,
        blocked,
        eEff,
        zone,
        intensity: clamp(eEff, 0.15, 1),
      });
    }
  }

  return cells;
}

function pickPairForCell(
  cell: MatrixCellUI,
  remainingDeck: readonly Card[],
  myCards: readonly [Card | null, Card | null]
): [Card, Card] | null {
  if (cell.isMyHand && myCards[0] && myCards[1]) {
    return [myCards[0], myCards[1]];
  }

  const r1 = cell.label[0] as RankChar;
  const r2 = cell.label[1] as RankChar;

  if (cell.isPair) {
    const sameRank = remainingDeck.filter((c) => c[0] === r1);
    if (sameRank.length >= 2) {
      return [sameRank[0], sameRank[1]];
    }
    return null;
  }

  if (cell.isSuited) {
    for (const suit of SUITS) {
      const c1 = `${r1}${suit}` as Card;
      const c2 = `${r2}${suit}` as Card;
      if (remainingDeck.includes(c1) && remainingDeck.includes(c2)) {
        return [c1, c2];
      }
    }
    return null;
  }

  const firstCandidates = remainingDeck.filter((c) => c[0] === r1);
  const secondCandidates = remainingDeck.filter((c) => c[0] === r2);
  for (const c1 of firstCandidates) {
    for (const c2 of secondCandidates) {
      if (c1 !== c2 && c1[1] !== c2[1]) {
        return [c1, c2];
      }
    }
  }

  return null;
}

export function InsightsAndMatrix({
  session,
  hand,
  engine,
  isShowdownMode,
  onToggleShowdownMode,
  selectedWinners,
  onToggleWinner,
  revealedCardsBySeat,
  onSetRevealedCard,
  onCompleteHand,
  onStartNewHand,
  onStartNextHand,
  onApplyMatrixHand,
  onSelectMyCard,
  onResumePlayer,
  onResetPlayerMemory,
}: InsightsAndMatrixProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('matrix');
  const [summaryMode, setSummaryMode] = useState<SummaryMode>('live');
  const [hoveredCellLabel, setHoveredCellLabel] = useState<string | null>(null);
  const [revealPickerSeat, setRevealPickerSeat] = useState<{
    seatIndex: number;
    slot: 0 | 1;
    rank: RankChar;
  } | null>(null);

  const hasCalculationsStarted = Boolean(
    hand.myCards[0] ||
      hand.myCards[1] ||
      hand.boardCards.length > 0 ||
      hand.events.length > 0
  );

  const [finalWaveActive, setFinalWaveActive] = useState(false);
  const [wavePhase, setWavePhase] = useState(0);
  const prevCalcStartedRef = useRef<boolean>(hasCalculationsStarted);
  const waveTimerRef = useRef<number | null>(null);

  const isIdleWaveMode = !hasCalculationsStarted || finalWaveActive;

  useEffect(() => {
    const startedNow = !prevCalcStartedRef.current && hasCalculationsStarted;
    prevCalcStartedRef.current = hasCalculationsStarted;

    if (startedNow) {
      setFinalWaveActive(true);
      if (waveTimerRef.current !== null) {
        window.clearTimeout(waveTimerRef.current);
      }
      waveTimerRef.current = window.setTimeout(() => {
        setFinalWaveActive(false);
      }, 1100);
    } else if (!hasCalculationsStarted) {
      setFinalWaveActive(false);
    }
  }, [hasCalculationsStarted]);

  useEffect(() => {
    if (!isIdleWaveMode) return;
    let rafId = 0;
    let lastMs = performance.now();
    let phase = 0;

    const step = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastMs) / 1000));
      lastMs = nowMs;
      phase = (phase + dt * 1.05) % (Math.PI * 20);
      setWavePhase(phase);
      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [isIdleWaveMode]);

  useEffect(() => {
    return () => {
      if (waveTimerRef.current !== null) {
        window.clearTimeout(waveTimerRef.current);
      }
    };
  }, []);

  const remainingDeck = useMemo(
    () =>
      getRemainingDeck({
        handCards: hand.myCards,
        boardCards: hand.boardCards,
        knownDeadCards: hand.knownDeadCards,
      }),
    [hand.boardCards, hand.knownDeadCards, hand.myCards]
  );

  const matrixCells: MatrixCellUI[] = useMemo(() => {
    if (engine.matrix13x13 && engine.matrix13x13.length === 169) {
      return engine.matrix13x13;
    }
    return buildFallbackMatrix13x13(hand, engine, remainingDeck);
  }, [engine, hand, remainingDeck]);

  const myStrengthPct =
    engine.probabilities.myHandStrengthPct ??
    Number((engine.verdict.eEff * 100).toFixed(1));
  const oppThreatPct = engine.probabilities.oppThreatPct ?? 0;

  const comboItems: ComboDisplayItem[] = useMemo(() => {
    const combos = engine.probabilities.combinations;
    const baseOpp = Math.max(0.03, oppThreatPct / 100);
    return COMBO_META.map((meta) => {
      const myVal = clamp((combos?.[meta.key] ?? 0) * 100, 0, 100);
      const oppVal = clamp(
        baseOpp * meta.weight * (1 + 0.12 * (engine.raisesOnStreet ?? 0)) * 100,
        0,
        99.9
      );
      return {
        key: meta.key,
        label: meta.label,
        myPct: Number(myVal.toFixed(1)),
        oppPct: Number(oppVal.toFixed(1)),
      };
    });
  }, [engine.probabilities.combinations, engine.raisesOnStreet, oppThreatPct]);

  const seatRoster = useMemo(() => {
    return Array.from({ length: session.nTable }, (_, seatIndex) => {
      const cfg = session.seats.find((s) => s.seatIndex === seatIndex);
      const participant = hand.participants[seatIndex];
      const playerId =
        cfg?.playerId ?? participant?.playerId ?? `seat-${seatIndex}`;
      const isMe = Boolean(cfg?.isMe || hand.mySeat === seatIndex);
      const mem = session.players[playerId];
      const insight: PlayerInsightUI | undefined = engine.playerInsights[playerId];
      const status = participant?.status ?? insight?.status ?? 'active';
      const isAllIn = Boolean(
        (participant?.isAllIn || insight?.isAllIn) && status === 'active'
      );
      const displayName = isMe
        ? 'Я'
        : cfg?.name && !cfg.name.startsWith('seat-')
          ? cfg.name
          : `Игрок #${seatIndex + 1}`;

      return {
        seatIndex,
        playerId,
        displayName,
        isMe,
        status,
        isAllIn,
        phi: insight?.phi ?? mem?.phi ?? 0,
        styleTag: insight?.styleTag ?? mem?.styleTag ?? ('NEUTRAL' as PlayerStyleTag),
        effectiveSamples: insight?.effectiveSamples ?? mem?.nHandsDecayed ?? 0,
        nShowdownsTotal: insight?.nShowdownsTotal ?? mem?.nShowdownsTotal ?? 0,
        nWinsTotal: insight?.nWinsTotal ?? mem?.nWinsTotal ?? 0,
      };
    });
  }, [
    engine.playerInsights,
    hand.mySeat,
    hand.participants,
    session.nTable,
    session.players,
    session.seats,
  ]);

  const foldedList = seatRoster
    .filter((p) => !p.isMe && p.status === 'folded')
    .map((p) => p.displayName);
  const allInList = seatRoster
    .filter((p) => p.isAllIn)
    .map((p) => p.displayName);
  const raisedSeats = new Set(
    hand.events
      .filter((ev) => ev.action === 'RAISE' || ev.action === 'ALL_IN')
      .map((ev) => ev.seatIndex)
  );
  const raiseList = seatRoster
    .filter((p) => raisedSeats.has(p.seatIndex))
    .map((p) => p.displayName);

  const usedCardsSet = useMemo(() => {
    const s = new Set<Card>();
    if (hand.myCards[0]) s.add(hand.myCards[0]);
    if (hand.myCards[1]) s.add(hand.myCards[1]);
    for (const c of hand.boardCards) s.add(c);
    for (const c of hand.knownDeadCards) s.add(c);
    for (const pair of Object.values(revealedCardsBySeat)) {
      if (pair?.[0]) s.add(pair[0]);
      if (pair?.[1]) s.add(pair[1]);
    }
    return s;
  }, [hand.boardCards, hand.knownDeadCards, hand.myCards, revealedCardsBySeat]);

  function handleCellClick(cell: MatrixCellUI) {
    if (cell.blocked) return;
    const picked = pickPairForCell(cell, remainingDeck, hand.myCards);
    if (!picked) return;
    if (onApplyMatrixHand) {
      onApplyMatrixHand(picked[0], picked[1]);
      return;
    }
    onSelectMyCard?.(0, picked[0]);
    onSelectMyCard?.(1, picked[1]);
  }

  function triggerCompleteHand() {
    const normalizedRevealed: Record<number, Card[]> = {};
    for (const [seatKey, pair] of Object.entries(revealedCardsBySeat)) {
      const idx = Number(seatKey);
      const validPair = (pair ?? []).filter((c): c is Card => Boolean(c));
      if (!Number.isNaN(idx) && validPair.length > 0) {
        normalizedRevealed[idx] = validPair;
      }
    }
    onCompleteHand(selectedWinners, isShowdownMode, normalizedRevealed);
  }

  function triggerStartNextHand() {
    onStartNextHand?.();
    onStartNewHand();
  }

  return (
    <div className="flex min-w-0 flex-col">
      <section
        style={{
          backgroundColor: 'var(--op-bg-surface)',
          borderColor: 'var(--op-border-subtle)',
          color: 'var(--op-text-primary)',
        }}
        className="min-w-0 space-y-3 rounded-2xl border p-3.5 shadow-md"
      >
        <div
          style={{ borderColor: 'var(--op-border-subtle)' }}
          className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'matrix', label: 'Матрица 13×13' },
                {
                  id: 'players',
                  label: `Досье (${seatRoster.filter((p) => !p.isMe).length})`,
                },
                { id: 'summary', label: 'Итог' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={
                  activeTab === tab.id
                    ? {
                        borderColor: 'var(--op-accent-gold)',
                        backgroundColor: 'var(--op-bg-elevated)',
                        color: 'var(--op-accent-gold)',
                      }
                    : {
                        borderColor: 'var(--op-border-subtle)',
                        backgroundColor: 'var(--op-bg-elevated)',
                        color: 'var(--op-text-secondary)',
                      }
                }
                className="whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-bold transition"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div
            style={{ color: 'var(--op-text-secondary)' }}
            className="op-tabular whitespace-nowrap text-[11px]"
          >
            Ходов: {hand.events.length} · ALL-IN: {engine.nAiOpp ?? allInList.length}
          </div>
        </div>

        {activeTab === 'matrix' && (
          <div className="min-w-0 space-y-2.5">
            <div className="flex min-h-[24px] flex-nowrap items-center justify-between gap-2 text-[11px]">
              <span
                style={{ color: 'var(--op-text-secondary)' }}
                className="min-w-0 truncate"
              >
                {!hasCalculationsStarted
                  ? 'Ожидание — волна по матрице'
                  : finalWaveActive
                    ? 'Финальная волна расчётов'
                    : hoveredCellLabel
                      ? `${hoveredCellLabel} · в «Я»`
                      : 'Расчёты по текущим данным'}
              </span>
              <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[10px]">
                <span
                  style={{ color: 'var(--op-stat-me)' }}
                  className="flex items-center gap-1 whitespace-nowrap"
                >
                  <span
                    style={{ backgroundColor: 'var(--op-accent-primary)' }}
                    className="h-2 w-2 shrink-0 rounded-sm"
                  />
                  Рейз
                </span>
                <span
                  style={{ color: 'var(--op-text-secondary)' }}
                  className="flex items-center gap-1 whitespace-nowrap"
                >
                  <span
                    style={{ backgroundColor: 'var(--op-accent-call)' }}
                    className="h-2 w-2 shrink-0 rounded-sm opacity-75"
                  />
                  Колл/Чек
                </span>
                <span
                  style={{ color: 'var(--op-text-secondary)' }}
                  className="flex items-center gap-1 whitespace-nowrap"
                >
                  <span
                    style={{ backgroundColor: 'var(--op-text-muted)' }}
                    className="h-2 w-2 shrink-0 rounded-sm"
                  />
                  Пас/Блок
                </span>
              </div>
            </div>

            <div
              style={{
                gridTemplateColumns: 'repeat(13, minmax(0, 1fr))',
              }}
              className="grid w-full gap-0.5"
            >
              {matrixCells.map((cell) => {
                const diag = cell.row + cell.col;
                const waveFactor = isIdleWaveMode
                  ? (Math.sin(wavePhase - diag * 0.42) + 1) / 2
                  : 0;
                const st = getZoneStyle(
                  cell.zone,
                  cell.isMyHand,
                  cell.blocked,
                  isIdleWaveMode,
                  waveFactor
                );
                return (
                  <button
                    key={`${cell.row}-${cell.col}`}
                    type="button"
                    disabled={cell.blocked && !isIdleWaveMode}
                    onMouseEnter={() =>
                      setHoveredCellLabel(
                        `${cell.label} (${(cell.eEff * 100).toFixed(0)}%)`
                      )
                    }
                    onMouseLeave={() => setHoveredCellLabel(null)}
                    onClick={() => handleCellClick(cell)}
                    style={{
                      backgroundColor: st.bg,
                      borderColor: st.border,
                      color: st.text,
                    }}
                    className={`op-tabular flex h-6 min-w-0 items-center justify-center rounded border text-[9px] font-bold leading-none transition-colors duration-300 ${
                      cell.blocked && !isIdleWaveMode
                        ? 'cursor-not-allowed opacity-45'
                        : 'hover:brightness-105'
                    } ${cell.isMyHand ? 'ring-1 ring-[#F59E0B]' : ''}`}
                  >
                    {cell.label}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                backgroundColor: 'var(--op-bg-elevated)',
                borderColor: 'var(--op-border-subtle)',
              }}
              className="grid grid-cols-2 items-center gap-3 rounded-xl border px-3 py-2"
            >
              <div>
                <div
                  style={{ color: 'var(--op-text-secondary)' }}
                  className="text-[11px] font-medium"
                >
                  Сила и потенциал «Я»
                </div>
                <div
                  style={{ color: 'var(--op-stat-me)' }}
                  className="op-tabular mt-0.5 text-lg font-extrabold"
                >
                  {myStrengthPct.toFixed(1)}%
                </div>
              </div>

              <div className="text-right">
                <div
                  style={{ color: 'var(--op-text-secondary)' }}
                  className="text-[11px] font-medium"
                >
                  Угроза стола / соперников
                </div>
                <div
                  style={{ color: 'var(--op-stat-threat)' }}
                  className="op-tabular mt-0.5 text-sm font-semibold"
                >
                  {oppThreatPct.toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div
                style={{ color: 'var(--op-text-secondary)' }}
                className="flex items-center justify-between text-[11px]"
              >
                <span>Комбинации</span>
                <span>Моё / Стол</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {comboItems.map((item) => (
                  <div
                    key={item.key}
                    style={{
                      backgroundColor: 'var(--op-bg-elevated)',
                      borderColor: 'var(--op-border-subtle)',
                    }}
                    className="flex items-center justify-between rounded-xl border px-2.5 py-1.5 text-xs"
                  >
                    <span className="truncate font-semibold">{item.label}</span>
                    <span className="op-tabular ml-2 shrink-0 font-bold">
                      <span style={{ color: 'var(--op-stat-me)' }}>
                        {item.myPct.toFixed(1)}%
                      </span>
                      <span
                        style={{ color: 'var(--op-text-secondary)' }}
                        className="mx-1"
                      >
                        /
                      </span>
                      <span
                        style={{ color: 'var(--op-text-secondary)' }}
                        className="font-medium"
                      >
                        {item.oppPct.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'players' && (
          <div className="space-y-2">
            {seatRoster
              .filter((p) => !p.isMe)
              .map((p) => (
                <div
                  key={p.playerId}
                  style={{
                    backgroundColor: p.isAllIn
                      ? 'var(--op-btn-surface)'
                      : 'var(--op-bg-elevated)',
                    borderColor: p.isAllIn
                      ? 'var(--op-accent-gold)'
                      : 'var(--op-border-subtle)',
                  }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-2.5 text-xs"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        style={{ color: 'var(--op-text-secondary)' }}
                        className="op-tabular text-[11px] font-bold"
                      >
                        #{p.seatIndex + 1}
                      </span>
                      <span className="font-extrabold">{p.displayName}</span>
                      {p.isAllIn && (
                        <span
                          style={{
                            backgroundColor: 'var(--op-accent-gold-soft)',
                            color: 'var(--op-accent-gold)',
                          }}
                          className="rounded px-1.5 py-0.5 text-[10px] font-black"
                        >
                          ALL-IN
                        </span>
                      )}
                      {p.status === 'eliminated' && (
                        <span
                          style={{
                            backgroundColor: 'var(--op-bg-surface)',
                            color: 'var(--op-text-muted)',
                          }}
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        >
                          Выбыл
                        </span>
                      )}
                      {p.status === 'folded' && !p.isAllIn && (
                        <span
                          style={{ color: 'var(--op-text-muted)' }}
                          className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                        >
                          Пас (FOLD)
                        </span>
                      )}
                    </div>

                    <div
                      style={{ color: 'var(--op-text-secondary)' }}
                      className="op-tabular text-[11px]"
                    >
                      {STYLE_LABEL_RU[p.styleTag]} · Φ:{' '}
                      <strong style={{ color: 'var(--op-text-primary)' }}>
                        {p.phi >= 0 ? `+${p.phi.toFixed(2)}` : p.phi.toFixed(2)}
                      </strong>{' '}
                      · Рук: {p.effectiveSamples.toFixed(1)} · Побед: {p.nWinsTotal}/
                      {p.nShowdownsTotal}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {p.status === 'eliminated' && (
                      <button
                        type="button"
                        onClick={() => onResumePlayer(p.seatIndex, false)}
                        style={{
                          backgroundColor: 'var(--op-bg-surface)',
                          borderColor: 'var(--op-accent-primary)',
                          color: 'var(--op-accent-primary)',
                        }}
                        className="whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-bold hover:brightness-110"
                      >
                        Возобновить
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onResetPlayerMemory(p.playerId)}
                      style={{
                        backgroundColor: 'var(--op-bg-surface)',
                        borderColor: 'var(--op-border-subtle)',
                        color: 'var(--op-text-secondary)',
                      }}
                      className="whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px]"
                    >
                      Сброс профиля
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSummaryMode('live')}
                style={
                  summaryMode === 'live'
                    ? {
                        borderColor: 'var(--op-accent-primary)',
                        backgroundColor: 'var(--op-bg-elevated)',
                        color: 'var(--op-accent-primary)',
                      }
                    : {
                        backgroundColor: 'var(--op-bg-elevated)',
                        borderColor: 'var(--op-border-subtle)',
                        color: 'var(--op-text-secondary)',
                      }
                }
                className="whitespace-nowrap rounded-xl border px-3 py-1 text-xs font-bold transition"
              >
                Во время игры
              </button>
              <button
                type="button"
                onClick={() => setSummaryMode('post')}
                style={
                  summaryMode === 'post'
                    ? {
                        borderColor: 'var(--op-accent-gold)',
                        backgroundColor: 'var(--op-bg-elevated)',
                        color: 'var(--op-accent-gold)',
                      }
                    : {
                        backgroundColor: 'var(--op-bg-elevated)',
                        borderColor: 'var(--op-border-subtle)',
                        color: 'var(--op-text-secondary)',
                      }
                }
                className="whitespace-nowrap rounded-xl border px-3 py-1 text-xs font-bold transition"
              >
                После раздачи / Шоудаун
              </button>
            </div>

            {summaryMode === 'live' ? (
              <div className="space-y-2.5 text-xs">
                <div
                  style={{
                    backgroundColor: 'var(--op-bg-elevated)',
                    borderColor: 'var(--op-border-subtle)',
                  }}
                  className="space-y-1.5 rounded-xl border p-3"
                >
                  <div className="font-bold">Разбор текущей ситуации</div>
                  <p>
                    {engine.verdict.explanationLayers?.verdictReason ??
                      engine.verdict.reasonText}
                  </p>
                  {engine.verdict.explanationLayers?.tableFactors?.map(
                    (factor, idx) => (
                      <div
                        key={idx}
                        style={{ color: 'var(--op-text-secondary)' }}
                        className="text-[11px]"
                      >
                        • {factor}
                      </div>
                    )
                  )}
                  {engine.verdict.explanationLayers?.nextStepNote && (
                    <div
                      style={{ color: 'var(--op-text-secondary)' }}
                      className="pt-1 text-[11px] font-medium"
                    >
                      {engine.verdict.explanationLayers.nextStepNote}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div
                    style={{
                      backgroundColor: 'var(--op-bg-elevated)',
                      borderColor: 'var(--op-border-subtle)',
                    }}
                    className="rounded-xl border p-2.5"
                  >
                    <div
                      style={{ color: 'var(--op-accent-gold)' }}
                      className="text-[11px] font-bold"
                    >
                      В ALL-IN
                    </div>
                    <div className="mt-1 text-xs">
                      {allInList.length > 0 ? allInList.join(', ') : 'нет'}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--op-bg-elevated)',
                      borderColor: 'var(--op-border-subtle)',
                    }}
                    className="rounded-xl border p-2.5"
                  >
                    <div
                      style={{ color: 'var(--op-accent-primary)' }}
                      className="text-[11px] font-bold"
                    >
                      Рейз / ALL-IN на этапе
                    </div>
                    <div className="mt-1 text-xs">
                      {raiseList.length > 0 ? raiseList.join(', ') : 'нет'}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--op-bg-elevated)',
                      borderColor: 'var(--op-border-subtle)',
                    }}
                    className="rounded-xl border p-2.5"
                  >
                    <div
                      style={{ color: 'var(--op-accent-fold)' }}
                      className="text-[11px] font-bold"
                    >
                      Сбросили карты (FOLD)
                    </div>
                    <div className="mt-1 text-xs">
                      {foldedList.length > 0 ? foldedList.join(', ') : 'нет'}
                    </div>
                  </div>

                  <div
                    style={{
                      backgroundColor: 'var(--op-bg-elevated)',
                      borderColor: 'var(--op-border-subtle)',
                    }}
                    className="rounded-xl border p-2.5"
                  >
                    <div
                      style={{ color: 'var(--op-text-secondary)' }}
                      className="text-[11px] font-bold"
                    >
                      Ходят после «Я»
                    </div>
                    <div className="mt-1 text-xs">
                      {engine.turnContext.afterMe.length > 0
                        ? engine.turnContext.afterMe.join(', ')
                        : 'круг завершается после вас'}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div
                  style={{
                    backgroundColor: 'var(--op-bg-elevated)',
                    borderColor: 'var(--op-border-subtle)',
                  }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
                >
                  <div>
                    <div className="font-bold">Фиксация победителя и шоудауна</div>
                    <div
                      style={{ color: 'var(--op-text-secondary)' }}
                      className="text-[11px]"
                    >
                      Колода следующей раздачи изолирована от вскрытых карт прошлых рук
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleShowdownMode(!isShowdownMode)}
                    style={
                      isShowdownMode
                        ? {
                            borderColor: 'var(--op-accent-gold)',
                            backgroundColor: 'var(--op-bg-surface)',
                            color: 'var(--op-accent-gold)',
                          }
                        : {
                            borderColor: 'var(--op-border-subtle)',
                            backgroundColor: 'var(--op-bg-surface)',
                            color: 'var(--op-text-secondary)',
                          }
                    }
                    className="whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition"
                  >
                    {isShowdownMode ? 'Шоудаун: вкл' : 'Без вскрытия'}
                  </button>
                </div>

                <div className="space-y-1.5">
                  <div
                    style={{ color: 'var(--op-text-secondary)' }}
                    className="text-[11px] font-bold"
                  >
                    Победитель(и) раздачи
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {seatRoster
                      .filter((p) => p.status !== 'eliminated')
                      .map((p) => {
                        const picked = selectedWinners.includes(p.seatIndex);
                        return (
                          <button
                            key={p.playerId}
                            type="button"
                            onClick={() => onToggleWinner(p.seatIndex)}
                            style={
                              picked
                                ? {
                                    borderColor: 'var(--op-accent-primary)',
                                    backgroundColor: 'var(--op-bg-surface)',
                                    color: 'var(--op-accent-primary)',
                                  }
                                : {
                                    backgroundColor: 'var(--op-bg-elevated)',
                                    borderColor: 'var(--op-border-subtle)',
                                    color: 'var(--op-text-secondary)',
                                  }
                            }
                            className="whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-bold transition"
                          >
                            #{p.seatIndex + 1} {p.displayName}
                          </button>
                        );
                      })}
                  </div>
                </div>

                {isShowdownMode && (
                  <div
                    style={{
                      backgroundColor: 'var(--op-bg-elevated)',
                      borderColor: 'var(--op-border-subtle)',
                    }}
                    className="space-y-2 rounded-xl border p-3"
                  >
                    <div
                      style={{ color: 'var(--op-text-secondary)' }}
                      className="text-[11px] font-bold"
                    >
                      Вскрытые карты на шоудауне (только в историю и память Φ)
                    </div>
                    {seatRoster
                      .filter((p) => !p.isMe && p.status === 'active')
                      .map((p) => {
                        const pair = revealedCardsBySeat[p.seatIndex] ?? [null, null];
                        return (
                          <div
                            key={p.playerId}
                            className="flex flex-wrap items-center justify-between gap-2"
                          >
                            <span className="font-semibold">
                              #{p.seatIndex + 1} {p.displayName}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {([0, 1] as const).map((slot) => {
                                const c = pair[slot];
                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    onClick={() =>
                                      setRevealPickerSeat({
                                        seatIndex: p.seatIndex,
                                        slot,
                                        rank: (c?.[0] as RankChar) ?? 'A',
                                      })
                                    }
                                    style={{
                                      backgroundColor: 'var(--op-bg-surface)',
                                      borderColor: 'var(--op-border-subtle)',
                                    }}
                                    className="op-tabular flex h-8 min-w-[42px] items-center justify-center rounded-lg border px-2 text-xs font-bold"
                                  >
                                    {c ?? '+'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                    {revealPickerSeat && (
                      <div
                        style={{
                          backgroundColor: 'var(--op-bg-surface)',
                          borderColor: 'var(--op-accent-gold)',
                        }}
                        className="space-y-2 rounded-xl border p-2.5"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span
                            style={{ color: 'var(--op-accent-gold)' }}
                            className="font-bold"
                          >
                            Вскрытая карта — место #{revealPickerSeat.seatIndex + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              onSetRevealedCard(
                                revealPickerSeat.seatIndex,
                                revealPickerSeat.slot,
                                null
                              );
                              setRevealPickerSeat(null);
                            }}
                            style={{ color: 'var(--op-text-secondary)' }}
                          >
                            Очистить
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {RANK_CHARS.map((rk) => (
                            <button
                              key={rk}
                              type="button"
                              onClick={() =>
                                setRevealPickerSeat((prev) =>
                                  prev ? { ...prev, rank: rk } : null
                                )
                              }
                              style={
                                revealPickerSeat.rank === rk
                                  ? {
                                      backgroundColor: 'var(--op-accent-gold)',
                                      color: 'var(--op-bg-base)',
                                    }
                                  : {
                                      backgroundColor: 'var(--op-bg-elevated)',
                                    }
                              }
                              className="h-7 w-7 rounded text-xs font-bold"
                            >
                              {rk}
                            </button>
                          ))}
                        </div>

                        <div className="grid grid-cols-4 gap-1.5">
                          {SUITS.map((suit) => {
                            const candidate = `${revealPickerSeat.rank}${suit}` as Card;
                            const taken = usedCardsSet.has(candidate);
                            return (
                              <button
                                key={suit}
                                type="button"
                                disabled={taken}
                                onClick={() => {
                                  onSetRevealedCard(
                                    revealPickerSeat.seatIndex,
                                    revealPickerSeat.slot,
                                    candidate
                                  );
                                  setRevealPickerSeat(null);
                                }}
                                style={{
                                  backgroundColor: 'var(--op-bg-elevated)',
                                  borderColor: 'var(--op-border-subtle)',
                                }}
                                className="h-8 rounded-lg border text-xs font-bold disabled:opacity-30"
                              >
                                {candidate}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={triggerCompleteHand}
                    style={{
                      backgroundColor: 'var(--op-bg-elevated)',
                      borderColor: 'var(--op-accent-primary)',
                      color: 'var(--op-accent-primary)',
                    }}
                    className="whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-extrabold hover:brightness-110"
                  >
                    Зафиксировать итог и сдвинуть BTN
                  </button>
                  <button
                    type="button"
                    onClick={triggerStartNextHand}
                    style={{
                      backgroundColor: 'var(--op-bg-elevated)',
                      borderColor: 'var(--op-border-subtle)',
                      color: 'var(--op-text-secondary)',
                    }}
                    className="whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold"
                  >
                    Новая раздача без фиксации
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}