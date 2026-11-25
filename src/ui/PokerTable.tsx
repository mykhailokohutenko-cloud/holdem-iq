import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  EngineOutput,
  HandParticipant,
  HandState,
  PlayerAction,
  PlayerInsightUI,
  PlayerStyleTag,
  SeatConfig,
  SessionState,
} from '../engine/types';
import {
  type AppLocale,
  formatPlayerDisplayName,
  type TranslationKey,
  translate,
  translatePlayerAction,
  translateStyleTag,
} from '../i18n';

export interface PokerTableProps {
  locale?: AppLocale;
  session: SessionState;
  hand: HandState;
  engine: EngineOutput;
  awaitingFirstPostResetPick?: boolean;
  firstActionSeatAfterReset?: number | null;
  onConsumeFirstPostResetPick?: () => void;
  onConsumePostResetFocus?: () => void;
  onRecordAction: (seatIndex: number, action: PlayerAction) => void;
  onSetButtonSeat: (seatIndex: number) => void;
  onSetMySeat: (seatIndex: number) => void;
  onEliminatePlayer: (seatIndex: number) => void;
  onResumePlayer: (seatIndex: number, resetMemory?: boolean) => void;
  onResetPlayerMemory: (playerId: string) => void;
  onToggleWinner: (seatIndex: number) => void;
  selectedWinners: number[];
  isShowdownMode: boolean;
  onToggleShowdownMode: (enabled: boolean) => void;
  onCompleteHand: () => void;
  onStreetRoundCompleted?: () => void;
  onBettingRoundComplete?: () => void;
}

function computeOvalSeatCoords(
  index: number,
  total: number
): { leftPct: number; topPct: number } {
  const safeTotal = Math.max(2, total);
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / safeTotal;
  const rx = safeTotal >= 12 ? 43 : safeTotal >= 7 ? 41.5 : 39;
  const ry = safeTotal >= 12 ? 38 : safeTotal >= 7 ? 36.5 : 33;
  return {
    leftPct: 50 + rx * Math.cos(angle),
    topPct: 50 + ry * Math.sin(angle),
  };
}

export function PokerTable({
  locale = 'en',
  session,
  hand,
  engine,
  awaitingFirstPostResetPick = false,
  firstActionSeatAfterReset = null,
  onConsumeFirstPostResetPick,
  onConsumePostResetFocus,
  onRecordAction,
  onSetButtonSeat,
  onSetMySeat,
  onEliminatePlayer,
  onResumePlayer,
  onResetPlayerMemory,
  onToggleWinner,
  selectedWinners,
  isShowdownMode,
  onToggleShowdownMode,
  onCompleteHand,
  onStreetRoundCompleted,
  onBettingRoundComplete,
}: PokerTableProps) {
  const t = (key: TranslationKey) => translate(locale, key);

  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [roundClosedBeforeNextBoard, setRoundClosedBeforeNextBoard] =
    useState(false);
  const [btnPulse, setBtnPulse] = useState(false);

  const prevBtnRef = useRef<number>(engine.positions.btn);
  const prevStreetRef = useRef<string>(hand.street);
  const prevBoardLenRef = useRef<number>(hand.boardCards.length);
  const prevEventsLenRef = useRef<number>(hand.events.length);
  const prevHandIdRef = useRef<number>(hand.handId);

  useEffect(() => {
    if (prevBtnRef.current !== engine.positions.btn) {
      prevBtnRef.current = engine.positions.btn;
      setBtnPulse(true);
      const t = window.setTimeout(() => setBtnPulse(false), 380);
      return () => window.clearTimeout(t);
    }
  }, [engine.positions.btn]);

  useEffect(() => {
    const handChanged = prevHandIdRef.current !== hand.handId;
    const streetChanged = prevStreetRef.current !== hand.street;
    const boardChanged = hand.boardCards.length !== prevBoardLenRef.current;
    const handResetOrNew = hand.events.length < prevEventsLenRef.current;

    if (handChanged) {
      prevHandIdRef.current = hand.handId;
      prevStreetRef.current = hand.street;
      prevBoardLenRef.current = hand.boardCards.length;
      prevEventsLenRef.current = hand.events.length;
      setSelectedSeat(null);
      setRoundClosedBeforeNextBoard(false);
      return;
    }

    if (streetChanged || boardChanged || handResetOrNew) {
      prevStreetRef.current = hand.street;
      prevBoardLenRef.current = hand.boardCards.length;
      prevEventsLenRef.current = hand.events.length;
      setSelectedSeat(null);
      setRoundClosedBeforeNextBoard(false);
      return;
    }

    prevStreetRef.current = hand.street;
    prevBoardLenRef.current = hand.boardCards.length;
    prevEventsLenRef.current = hand.events.length;
  }, [hand.boardCards.length, hand.events.length, hand.handId, hand.street]);

  const nonEliminatedCount = useMemo(() => {
    let count = 0;
    for (let i = 0; i < session.nTable; i++) {
      const status = hand.participants[i]?.status ?? 'active';
      if (status !== 'eliminated') count += 1;
    }
    return count;
  }, [hand.participants, session.nTable]);

  function canActInCurrentRound(
    seatIndex: number,
    participantsOverride?: Record<number, HandParticipant>
  ): boolean {
    if (seatIndex < 0 || seatIndex >= session.nTable) return false;
    const map = participantsOverride ?? hand.participants;
    const p: HandParticipant | undefined = map[seatIndex];
    const status = p?.status ?? 'active';
    if (
      status === 'eliminated' ||
      status === 'sittingOut' ||
      status === 'folded'
    ) {
      return false;
    }
    if (p?.isAllIn) {
      return false;
    }
    return true;
  }

  function getRoundStartAnchorSeat(): number {
    const n = session.nTable;
    if (hand.street === 'Pre') {
      return (engine.positions.bb + 1) % n;
    }
    return (engine.positions.btn + 1) % n;
  }

  function findFirstActionSeatInRound(
    participantsOverride?: Record<number, HandParticipant>
  ): number | null {
    if (
      hand.street === 'Pre' &&
      firstActionSeatAfterReset !== null &&
      canActInCurrentRound(firstActionSeatAfterReset, participantsOverride)
    ) {
      return firstActionSeatAfterReset;
    }

    const n = session.nTable;
    const start = getRoundStartAnchorSeat();

    for (let step = 0; step < n; step++) {
      const candidate = (start + step) % n;
      if (canActInCurrentRound(candidate, participantsOverride)) {
        return candidate;
      }
    }

    return null;
  }

  function findNextActionSeatAfter(
    fromSeat: number,
    participantsOverride?: Record<number, HandParticipant>
  ): number | null {
    const n = session.nTable;
    for (let step = 1; step <= n; step++) {
      const candidate = (fromSeat + step) % n;
      if (canActInCurrentRound(candidate, participantsOverride)) {
        return candidate;
      }
    }
    return null;
  }

  function hasRoundCompletedAfterAction(
    actingSeat: number,
    action: PlayerAction,
    nextParticipants: Record<number, HandParticipant>
  ): boolean {
    const actionableSeats: number[] = [];
    for (let i = 0; i < session.nTable; i++) {
      if (canActInCurrentRound(i, nextParticipants)) {
        actionableSeats.push(i);
      }
    }

    if (actionableSeats.length <= 1) {
      return true;
    }

    const currentStreet = hand.street === 'Showdown' ? 'River' : hand.street;
    const streetEvents = hand.events.filter((ev) => ev.street === currentStreet);

    let cycleStartIdx = 0;
    for (let i = streetEvents.length - 1; i >= 0; i--) {
      const ev = streetEvents[i];
      if (ev.action === 'RAISE' || ev.action === 'ALL_IN') {
        cycleStartIdx = i + 1;
        break;
      }
    }

    const actedSeats = new Set<number>();
    for (let i = cycleStartIdx; i < streetEvents.length; i++) {
      actedSeats.add(streetEvents[i].seatIndex);
    }
    actedSeats.add(actingSeat);

    if (action === 'RAISE' || action === 'ALL_IN') {
      return false;
    }

    return actionableSeats.every((seatIdx) => actedSeats.has(seatIdx));
  }

  function handleSeatClick(seatIndex: number) {
    if (awaitingFirstPostResetPick) {
      onConsumeFirstPostResetPick?.();
      onConsumePostResetFocus?.();
      const firstSeat = findFirstActionSeatInRound();
      setSelectedSeat(firstSeat ?? seatIndex);
      return;
    }

    const currentStreet = hand.street === 'Showdown' ? 'River' : hand.street;
    const hasActionsOnCurrentStreet = hand.events.some(
      (ev) => ev.street === currentStreet
    );

    if (!hasActionsOnCurrentStreet && selectedSeat === null) {
      const firstInStreet = findFirstActionSeatInRound();
      if (firstInStreet !== null) {
        setSelectedSeat(firstInStreet);
        return;
      }
    }

    if (selectedSeat === seatIndex) {
      setSelectedSeat(null);
      return;
    }

    setSelectedSeat(seatIndex);
  }

  function handleActionClick(seatIndex: number, action: PlayerAction) {
    if (!canActInCurrentRound(seatIndex)) {
      return;
    }

    const prevPart = hand.participants[seatIndex] ?? {
      seatIndex,
      playerId: `seat-${seatIndex}`,
      status: 'active' as const,
    };

    const nextParticipants: Record<number, HandParticipant> = {
      ...hand.participants,
      [seatIndex]:
        action === 'FOLD'
          ? { ...prevPart, status: 'folded', isAllIn: false }
          : action === 'ALL_IN'
            ? { ...prevPart, status: 'active', isAllIn: true }
            : { ...prevPart, status: 'active' },
    };

    onRecordAction(seatIndex, action);

    if (hasRoundCompletedAfterAction(seatIndex, action, nextParticipants)) {
      setRoundClosedBeforeNextBoard(true);
      setSelectedSeat(null);
      onStreetRoundCompleted?.();
      onBettingRoundComplete?.();
      return;
    }

    const nextSeat = findNextActionSeatAfter(seatIndex, nextParticipants);
    setSelectedSeat(nextSeat);
  }

  const activeSeatConfig: SeatConfig | null = useMemo(() => {
    if (selectedSeat === null) return null;
    return (
      session.seats.find((s) => s.seatIndex === selectedSeat) ?? {
        seatIndex: selectedSeat,
        playerId: `seat-${selectedSeat}`,
        name: formatPlayerDisplayName(
          locale,
          undefined,
          selectedSeat,
          selectedSeat === hand.mySeat
        ),
        isMe: selectedSeat === hand.mySeat,
      }
    );
  }, [hand.mySeat, selectedSeat, session.seats, locale]);

  const activeParticipant: HandParticipant | undefined =
    selectedSeat !== null ? hand.participants[selectedSeat] : undefined;

  const activeStatus = activeParticipant?.status ?? 'active';
  const activeIsAllIn = Boolean(
    activeParticipant?.isAllIn && activeStatus === 'active'
  );
  const activeCanAct =
    selectedSeat !== null && canActInCurrentRound(selectedSeat);

  const canMarkWinnerHere =
    selectedSeat !== null &&
    activeStatus !== 'eliminated' &&
    (isShowdownMode || roundClosedBeforeNextBoard || hand.street === 'Showdown');

  const isCompactSeats = session.nTable >= 10;
  const useMobileGrid = session.nTable >= 7;

  const handLabelClean = t('handNumberPrefix');
  const seatLabelClean = t('seatPrefix');

  function renderSeatCard(seatIndex: number, compactMobileGrid = false) {
    const seatCfg = session.seats.find((s) => s.seatIndex === seatIndex);
    const participant = hand.participants[seatIndex];
    const status = participant?.status ?? 'active';
    const isEliminated = status === 'eliminated';
    const isFolded = status === 'folded';
    const isAllIn = Boolean(participant?.isAllIn && status === 'active');
    const isMe = Boolean(seatCfg?.isMe || hand.mySeat === seatIndex);
    const isBtn = engine.positions.btn === seatIndex;
    const isSb = engine.positions.sb === seatIndex;
    const isBb = engine.positions.bb === seatIndex;
    const isSelected = selectedSeat === seatIndex;
    const isWinner = selectedWinners.includes(seatIndex);

    const playerId =
      seatCfg?.playerId ?? participant?.playerId ?? `seat-${seatIndex}`;
    const insight: PlayerInsightUI | undefined =
      engine.playerInsights[playerId];
    const mem = session.players[playerId];
    const styleTag: PlayerStyleTag =
      insight?.styleTag ?? mem?.styleTag ?? 'NEUTRAL';
    const displayName = formatPlayerDisplayName(
      locale,
      seatCfg?.name ?? mem?.name,
      seatIndex,
      isMe
    );

    const lastEvent = [...hand.events]
      .reverse()
      .find((ev) => ev.seatIndex === seatIndex);

    const cardSolidStyle = isAllIn
      ? {
          backgroundColor: 'var(--op-btn-surface)',
          borderColor: 'var(--op-accent-gold)',
          color: 'var(--op-text-primary)',
          boxShadow: '0 0 0 1px var(--op-accent-gold)',
        }
      : isEliminated
        ? {
            backgroundColor: 'var(--op-bg-base)',
            borderColor: 'var(--op-border-subtle)',
            color: 'var(--op-text-muted)',
          }
        : isWinner
          ? {
              backgroundColor: 'var(--op-bg-elevated)',
              borderColor: 'var(--op-accent-primary)',
              boxShadow: '0 0 0 1px var(--op-accent-primary)',
            }
          : isSelected
            ? {
                backgroundColor: 'var(--op-bg-elevated)',
                borderColor: 'var(--op-border-active)',
                boxShadow: '0 0 0 1px var(--op-border-active)',
              }
            : isMe
              ? {
                  backgroundColor: 'var(--op-bg-elevated)',
                  borderColor: 'var(--op-accent-gold)',
                }
              : {
                  backgroundColor: 'var(--op-bg-elevated)',
                  borderColor: 'var(--op-border-subtle)',
                };

    return (
      <button
        type="button"
        onClick={() => handleSeatClick(seatIndex)}
        style={{
          ...cardSolidStyle,
          opacity: isFolded ? 0.52 : 1,
        }}
        className={`${
          compactMobileGrid
            ? 'w-full px-2 py-1.5 text-[10px]'
            : isCompactSeats
              ? 'w-[86px] px-1.5 py-1 text-[10px]'
              : 'w-[114px] sm:w-[128px] px-2.5 py-2 text-[11px]'
        } relative flex min-w-0 flex-col items-start rounded-xl border text-left transition hover:brightness-110`}
      >
        <div className="flex w-full items-center justify-end gap-0.5 leading-tight">
          {isBtn && (
            <span
              style={{
                backgroundColor: 'var(--op-chip-btn-bg)',
                color: 'var(--op-chip-btn-text)',
              }}
              className={`rounded px-1 text-[9px] font-black ${
                btnPulse ? 'scale-110' : ''
              }`}
            >
              BTN
            </span>
          )}
          {isSb && (
            <span
              style={{
                backgroundColor: 'var(--op-bg-surface)',
                borderColor: 'var(--op-accent-call)',
                color: 'var(--op-accent-call)',
              }}
              className="rounded border px-1 text-[9px] font-bold"
            >
              SB
            </span>
          )}
          {isBb && (
            <span
              style={{
                backgroundColor: 'var(--op-accent-gold-soft)',
                borderColor: 'var(--op-accent-gold)',
                color: 'var(--op-accent-gold)',
              }}
              className="rounded border px-1 text-[9px] font-bold"
            >
              BB
            </span>
          )}
        </div>

        <div className="mt-0.5 w-full truncate font-extrabold leading-tight">
          {displayName}
        </div>

        <div className="mt-0.5 w-full truncate font-bold leading-tight">
          {isEliminated ? (
            <span style={{ color: 'var(--op-text-muted)' }}>
              {t('seatEliminated')}
            </span>
          ) : isAllIn ? (
            <span
              style={{ color: 'var(--op-accent-gold)' }}
              className="font-black tracking-wide"
            >
              ALL-IN
            </span>
          ) : isFolded ? (
            <span style={{ color: 'var(--op-text-muted)' }}>
              {t('seatFolded')}
            </span>
          ) : isWinner ? (
            <span style={{ color: 'var(--op-accent-primary)' }}>
              {t('seatWinner')}
            </span>
          ) : lastEvent ? (
            <span
              style={{
                color:
                  lastEvent.action === 'RAISE'
                    ? 'var(--op-accent-primary)'
                    : lastEvent.action === 'FOLD'
                      ? 'var(--op-text-muted)'
                      : 'var(--op-accent-call)',
              }}
            >
              {translatePlayerAction(locale, lastEvent.action)}
            </span>
          ) : (
            <span style={{ color: 'var(--op-text-secondary)' }}>
              {t('seatInPlay')}
            </span>
          )}
        </div>

        {!isMe && !isCompactSeats && !compactMobileGrid && (
          <div
            style={{ color: 'var(--op-text-secondary)' }}
            className="mt-0.5 w-full truncate text-[10px] leading-tight"
          >
            {translateStyleTag(locale, styleTag)}
          </div>
        )}
      </button>
    );
  }

  return (
    <section
      style={{
        backgroundColor: 'var(--op-bg-surface)',
        borderColor: 'var(--op-border-subtle)',
        color: 'var(--op-text-primary)',
      }}
      className="min-w-0 space-y-3 rounded-2xl border p-3.5"
    >
      <div
        style={{ borderColor: 'var(--op-border-subtle)' }}
        className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5"
      >
        <div className="min-w-0">
          <h2 className="break-words text-sm font-bold">
            {t('tableTitlePrefix')} ({session.nTable} {t('tableSeatsSuffix')} ·{' '}
            {t('tableActiveSuffix')} {engine.nActive})
          </h2>
          <p
            style={{ color: 'var(--op-text-secondary)' }}
            className="break-words text-[11px]"
          >
            {t('tableHint')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleShowdownMode(!isShowdownMode)}
            style={
              isShowdownMode
                ? {
                    borderColor: 'var(--op-accent-gold)',
                    backgroundColor: 'var(--op-accent-gold-soft)',
                    color: 'var(--op-accent-gold)',
                  }
                : {
                    borderColor: 'var(--op-border-subtle)',
                    backgroundColor: 'var(--op-bg-elevated)',
                    color: 'var(--op-text-secondary)',
                  }
            }
            className="max-w-full truncate rounded-xl border px-3 py-1.5 text-xs font-semibold transition"
          >
            {isShowdownMode ? t('showdownOnBtn') : t('showdownBtn')}
          </button>

          <button
            type="button"
            onClick={onCompleteHand}
            style={{
              borderColor: 'var(--op-accent-primary)',
              backgroundColor: 'var(--op-bg-elevated)',
              color: 'var(--op-accent-primary)',
            }}
            className="max-w-full truncate rounded-xl border px-3 py-1.5 text-xs font-bold transition hover:brightness-110"
          >
            {t('completeHandBtn')}
          </button>
        </div>
      </div>

      {useMobileGrid && (
        <div
          style={{
            background:
              'radial-gradient(ellipse at 50% 42%, var(--op-table-felt) 0%, var(--op-table-felt-deep) 100%)',
            borderColor: 'var(--op-border-subtle)',
          }}
          className="space-y-2.5 rounded-2xl border p-2.5 md:hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span
              style={{
                backgroundColor: 'var(--op-bg-surface)',
                borderColor: 'var(--op-accent-gold)',
                color: 'var(--op-accent-gold)',
              }}
              className="max-w-full truncate rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            >
              {handLabelClean} {hand.handId}
            </span>
            <div className="op-tabular text-[11px] font-bold">
              {t('activeCountLabel')} {engine.nActive} · {t('opponentsCountLabel')}{' '}
              {engine.nOpp}
            </div>
            {(engine.nAiOpp ?? 0) > 0 && (
              <div
                style={{ color: 'var(--op-accent-gold)' }}
                className="op-tabular text-[10px] font-extrabold"
              >
                {t('allInCountLabel')} {engine.nAiOpp}
              </div>
            )}
          </div>

          <div
            className={`grid gap-1.5 ${
              session.nTable >= 12 ? 'grid-cols-3' : 'grid-cols-2'
            }`}
          >
            {Array.from({ length: session.nTable }, (_, seatIndex) => (
              <div key={seatIndex} className="min-w-0">
                {renderSeatCard(seatIndex, true)}
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className={`relative mx-auto h-[350px] w-full sm:h-[380px] ${
          useMobileGrid ? 'hidden md:block' : 'block'
        }`}
      >
        <div
          style={{
            background:
              'radial-gradient(ellipse at 50% 42%, var(--op-table-felt) 0%, var(--op-table-felt-deep) 100%)',
            borderColor: 'var(--op-border-active)',
          }}
          className="absolute inset-x-[6%] inset-y-[16%] rounded-[999px] border-2"
        />
        <div
          style={{ borderColor: 'var(--op-border-subtle)' }}
          className="pointer-events-none absolute inset-x-[8%] inset-y-[18%] rounded-[999px] border"
        />

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span
            style={{
              backgroundColor: 'var(--op-bg-surface)',
              borderColor: 'var(--op-accent-gold)',
              color: 'var(--op-accent-gold)',
            }}
            className="max-w-[200px] truncate rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          >
            {handLabelClean} {hand.handId}
          </span>
          <div className="op-tabular mt-1 max-w-[220px] truncate text-xs font-bold">
            {t('activeCountLabel')} {engine.nActive} · {t('opponentsCountLabel')}{' '}
            {engine.nOpp}
          </div>
          {(engine.nAiOpp ?? 0) > 0 && (
            <div
              style={{ color: 'var(--op-accent-gold)' }}
              className="op-tabular mt-0.5 max-w-[200px] truncate text-[11px] font-extrabold"
            >
              {t('inAllInCountLabel')} {engine.nAiOpp}
            </div>
          )}
        </div>

        {Array.from({ length: session.nTable }, (_, seatIndex) => {
          const { leftPct, topPct } = computeOvalSeatCoords(
            seatIndex,
            session.nTable
          );
          const participant = hand.participants[seatIndex];
          const isFolded = (participant?.status ?? 'active') === 'folded';

          return (
            <div
              key={seatIndex}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: `translate(-50%, -50%) ${
                  isFolded ? 'scale(0.95)' : 'scale(1)'
                }`,
                transition: 'transform 200ms ease-in-out',
              }}
              className="absolute z-10"
            >
              {renderSeatCard(seatIndex, false)}
            </div>
          );
        })}
      </div>

      {activeSeatConfig && selectedSeat !== null && (
        <div
          style={{
            backgroundColor: 'var(--op-bg-elevated)',
            borderColor: 'var(--op-border-subtle)',
          }}
          className="min-w-0 space-y-2.5 rounded-xl border p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 break-words text-xs font-bold">
              {seatLabelClean} {selectedSeat + 1}:{' '}
              <span style={{ color: 'var(--op-accent-gold)' }}>
                {formatPlayerDisplayName(
                  locale,
                  activeSeatConfig.name,
                  selectedSeat,
                  Boolean(activeSeatConfig.isMe || hand.mySeat === selectedSeat)
                )}
              </span>
              {activeIsAllIn && (
                <span
                  style={{
                    backgroundColor: 'var(--op-accent-gold-soft)',
                    color: 'var(--op-accent-gold)',
                  }}
                  className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-black"
                >
                  ALL-IN
                </span>
              )}
              {activeStatus === 'eliminated' && (
                <span
                  style={{
                    backgroundColor: 'var(--op-bg-surface)',
                    color: 'var(--op-text-secondary)',
                  }}
                  className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold"
                >
                  {t('seatEliminated')}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedSeat(null)}
              style={{
                backgroundColor: 'var(--op-bg-surface)',
                borderColor: 'var(--op-border-subtle)',
                color: 'var(--op-text-secondary)',
              }}
              className="max-w-full truncate rounded-lg border px-2.5 py-1 text-[11px]"
            >
              {t('closeBtn')}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(['FOLD', 'CHECK_CALL', 'RAISE', 'ALL_IN'] as const).map((act) => (
              <button
                key={act}
                type="button"
                disabled={!activeCanAct}
                onClick={() => handleActionClick(selectedSeat, act)}
                style={
                  !activeCanAct
                    ? {
                        backgroundColor: 'var(--op-bg-base)',
                        borderColor: 'var(--op-border-subtle)',
                        color: 'var(--op-text-muted)',
                      }
                    : act === 'ALL_IN'
                      ? {
                          backgroundColor: 'var(--op-accent-gold-soft)',
                          borderColor: 'var(--op-accent-gold)',
                          color: 'var(--op-accent-gold)',
                        }
                      : act === 'FOLD'
                        ? {
                            backgroundColor: 'var(--op-bg-surface)',
                            borderColor: 'var(--op-accent-fold)',
                            color: 'var(--op-accent-fold)',
                          }
                        : act === 'RAISE'
                          ? {
                              backgroundColor: 'var(--op-bg-surface)',
                              borderColor: 'var(--op-accent-primary)',
                              color: 'var(--op-accent-primary)',
                            }
                          : {
                              backgroundColor: 'var(--op-bg-surface)',
                              borderColor: 'var(--op-accent-call)',
                              color: 'var(--op-accent-call)',
                            }
                }
                className={`max-w-full truncate rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  !activeCanAct
                    ? 'cursor-not-allowed opacity-40'
                    : 'hover:brightness-110'
                }`}
              >
                {translatePlayerAction(locale, act)}
              </button>
            ))}
          </div>

          <div
            style={{ borderColor: 'var(--op-border-subtle)' }}
            className="flex flex-wrap items-center gap-1.5 border-t pt-2"
          >
            <button
              type="button"
              onClick={() => onSetButtonSeat(selectedSeat)}
              style={{
                backgroundColor: 'var(--op-bg-surface)',
                borderColor: 'var(--op-accent-gold)',
                color: 'var(--op-accent-gold)',
              }}
              className="max-w-full truncate rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold hover:brightness-110"
            >
              {t('setBtnAction')}
            </button>

            <button
              type="button"
              onClick={() => onSetMySeat(selectedSeat)}
              style={{
                backgroundColor: 'var(--op-bg-surface)',
                borderColor: 'var(--op-border-subtle)',
                color: 'var(--op-text-primary)',
              }}
              className="max-w-full truncate rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold hover:brightness-110"
            >
              {t('sitHereAction')}
            </button>

            {canMarkWinnerHere && (
              <button
                type="button"
                onClick={() => onToggleWinner(selectedSeat)}
                style={{
                  backgroundColor: 'var(--op-bg-surface)',
                  borderColor: 'var(--op-accent-primary)',
                  color: 'var(--op-accent-primary)',
                }}
                className="max-w-full truncate rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition hover:brightness-110"
              >
                {selectedWinners.includes(selectedSeat)
                  ? t('winnerSelectedAction')
                  : t('markWinnerAction')}
              </button>
            )}

            {activeStatus === 'eliminated' ? (
              <button
                type="button"
                onClick={() => onResumePlayer(selectedSeat, false)}
                style={{
                  backgroundColor: 'var(--op-bg-surface)',
                  borderColor: 'var(--op-accent-primary)',
                  color: 'var(--op-accent-primary)',
                }}
                className="max-w-full truncate rounded-lg border px-2.5 py-1.5 text-[11px] font-bold hover:brightness-110"
              >
                {t('resumePlayerAction')}
              </button>
            ) : (
              <button
                type="button"
                disabled={nonEliminatedCount <= 2}
                onClick={() => onEliminatePlayer(selectedSeat)}
                style={{
                  backgroundColor: 'var(--op-bg-surface)',
                  borderColor: 'var(--op-border-subtle)',
                  color: 'var(--op-text-secondary)',
                }}
                className={`max-w-full truncate rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold ${
                  nonEliminatedCount <= 2
                    ? 'cursor-not-allowed opacity-40'
                    : 'hover:brightness-110'
                }`}
              >
                {t('eliminatePlayerAction')}
              </button>
            )}

            {!(activeSeatConfig.isMe || hand.mySeat === selectedSeat) && (
              <button
                type="button"
                onClick={() => onResetPlayerMemory(activeSeatConfig.playerId)}
                style={{
                  backgroundColor: 'var(--op-bg-surface)',
                  borderColor: 'var(--op-border-subtle)',
                  color: 'var(--op-text-secondary)',
                }}
                className="max-w-full truncate rounded-lg border px-2.5 py-1.5 text-[11px]"
              >
                {t('resetProfileAction')}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}