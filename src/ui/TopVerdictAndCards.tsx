import { useEffect, useRef, useState } from 'react';
import { RANK_CHARS, SUITS } from '../engine/deck';
import type {
  Card,
  EngineOutput,
  HandState,
  RankChar,
  SessionState,
  Suit,
  VerdictAction,
} from '../engine/types';

export interface TopVerdictAndCardsProps {
  session: SessionState;
  hand: HandState;
  engine: EngineOutput;
  autoFocusBoardOnStreetClose?: boolean;
  onAcknowledgeBoardAutoFocus?: () => void;
  onSelectMyCard: (slotIndex: 0 | 1, card: Card | null) => void;
  onSetBoardCards: (cards: Card[]) => void;
  onEnterMidHand: (boardCards: Card[]) => void;
  onStartNewHand: () => void;
  onResetFullGame: () => void;
  onSetTableSize: (nTable: number) => void;
}

type ActiveCardPicker =
  | { target: 'my'; slot: 0 | 1; autoChain: boolean }
  | {
      target: 'board';
      slot: number;
      targetCount: 3 | 4 | 5;
      autoChain: boolean;
      midHand?: boolean;
    }
  | null;

const TABLE_SIZE_OPTIONS: ReadonlyArray<number> = Array.from(
  { length: 14 },
  (_, i) => i + 2
);

const ORDERED_RANKS: ReadonlyArray<RankChar> = [...RANK_CHARS].reverse();

const SUIT_SYMBOLS: Record<Suit, { symbol: string; label: string; color: string }> = {
  s: { symbol: '♠', label: 'Пики', color: '#34D399' },
  h: { symbol: '♥', label: 'Червы', color: '#F43F5E' },
  d: { symbol: '♦', label: 'Бубны', color: '#38BDF8' },
  c: { symbol: '♣', label: 'Трефы', color: '#10B981' },
};

const VERDICT_LABEL_RU: Record<VerdictAction, string> = {
  FOLD: 'ПАС (FOLD)',
  CHECK: 'ЧЕК (CHECK)',
  CALL: 'КОЛЛ (CALL)',
  RAISE: 'РЕЙЗ (RAISE)',
};

function getVerdictColor(action: VerdictAction): string {
  if (action === 'RAISE') return 'var(--op-accent-primary)';
  if (action === 'CALL') return 'var(--op-accent-call)';
  if (action === 'FOLD') return 'var(--op-accent-fold)';
  return 'var(--op-accent-check)';
}

function formatCardText(card: Card | null | undefined): string {
  if (!card) return '+';
  const rank = card[0] as RankChar;
  const suit = card[1] as Suit;
  return `${rank}${SUIT_SYMBOLS[suit]?.symbol ?? suit}`;
}

function makeEmptyBoardSlots(): Array<Card | null> {
  return [null, null, null, null, null];
}

export function TopVerdictAndCards({
  session,
  hand,
  engine,
  autoFocusBoardOnStreetClose = false,
  onAcknowledgeBoardAutoFocus,
  onSelectMyCard,
  onSetBoardCards,
  onEnterMidHand,
  onStartNewHand,
  onResetFullGame,
  onSetTableSize,
}: TopVerdictAndCardsProps) {
  const [picker, setPicker] = useState<ActiveCardPicker>(null);
  const [renderedPicker, setRenderedPicker] = useState<ActiveCardPicker>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  const [pendingRank, setPendingRank] = useState<RankChar>('A');
  const [pendingSuit, setPendingSuit] = useState<Suit>('s');
  const [desiredBoardSlots, setDesiredBoardSlots] = useState<0 | 3 | 4 | 5>(0);
  const [boardSlotsState, setBoardSlotsState] = useState<Array<Card | null>>(() =>
    makeEmptyBoardSlots()
  );
  const [isMidHandSetupActive, setIsMidHandSetupActive] = useState(false);
  const [tableSizeMenuOpen, setTableSizeMenuOpen] = useState(false);

  const rankWheelRef = useRef<HTMLDivElement | null>(null);
  const cardPickerSectionRef = useRef<HTMLDivElement | null>(null);
  const tableSizeMenuRef = useRef<HTMLDivElement | null>(null);
  const prevHandIdRef = useRef<number>(hand.handId);

  useEffect(() => {
    if (picker) {
      setRenderedPicker(picker);
      const raf = window.requestAnimationFrame(() => {
        setPickerVisible(true);
      });
      return () => window.cancelAnimationFrame(raf);
    }

    setPickerVisible(false);
    const timer = window.setTimeout(() => {
      setRenderedPicker(null);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [picker]);

  useEffect(() => {
    if (!tableSizeMenuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (
        tableSizeMenuRef.current &&
        !tableSizeMenuRef.current.contains(e.target as Node)
      ) {
        setTableSizeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [tableSizeMenuOpen]);

  useEffect(() => {
    if (prevHandIdRef.current !== hand.handId) {
      prevHandIdRef.current = hand.handId;
      setBoardSlotsState(makeEmptyBoardSlots());
      setDesiredBoardSlots(0);
      setIsMidHandSetupActive(false);
      setPicker(null);
      return;
    }

    if (picker !== null) {
      return;
    }

    if (hand.boardCards.length > 0) {
      setBoardSlotsState((prev) => {
        const next = [...prev];
        for (let i = 0; i < Math.min(5, hand.boardCards.length); i++) {
          const c = hand.boardCards[i];
          if (c && !next.includes(c)) {
            const emptyIdx = next.findIndex((item) => item === null);
            if (emptyIdx !== -1 && emptyIdx >= i) {
              next[emptyIdx] = c;
            } else if (next[i] === null) {
              next[i] = c;
            }
          }
        }
        return next;
      });
    }
  }, [hand.boardCards, hand.handId, picker]);

  const usedCards = new Set<Card>([
    ...(hand.myCards[0] ? [hand.myCards[0]] : []),
    ...(hand.myCards[1] ? [hand.myCards[1]] : []),
    ...boardSlotsState.filter((c): c is Card => Boolean(c)),
    ...hand.boardCards.filter((c): c is Card => Boolean(c)),
  ]);

  function syncPickerDraftToSlot(
    next: ActiveCardPicker,
    currentSlots: Array<Card | null> = boardSlotsState
  ) {
    if (!next) return;
    const existing =
      next.target === 'my'
        ? hand.myCards[next.slot]
        : currentSlots[next.slot] ?? hand.boardCards[next.slot] ?? null;
    if (existing) {
      setPendingRank(existing[0] as RankChar);
      setPendingSuit(existing[1] as Suit);
    } else {
      setPendingRank('A');
      setPendingSuit('s');
    }
  }

  function openMyCardSlot(slot: 0 | 1) {
    if (picker?.target === 'my' && picker.slot === slot) {
      setPicker(null);
      return;
    }
    const next: ActiveCardPicker = {
      target: 'my',
      slot,
      autoChain: slot === 0 && !hand.myCards[1],
    };
    setPicker(next);
    syncPickerDraftToSlot(next);
  }

  function openBoardSlot(
    slot: number,
    targetCount?: 3 | 4 | 5,
    slotsOverride?: Array<Card | null>,
    midHandFlag?: boolean
  ) {
    const slotsToUse = slotsOverride ?? boardSlotsState;
    const resolvedTarget: 3 | 4 | 5 =
      targetCount ??
      (picker?.target === 'board'
        ? picker.targetCount
        : desiredBoardSlots === 5 ||
            desiredBoardSlots === 4 ||
            desiredBoardSlots === 3
          ? desiredBoardSlots
          : hand.boardCards.length >= 5
            ? 5
            : hand.boardCards.length === 4
              ? 4
              : 3);

    if (
      picker?.target === 'board' &&
      picker.slot === slot &&
      targetCount === undefined
    ) {
      setPicker(null);
      return;
    }

    const isMid =
      midHandFlag ??
      (picker?.target === 'board' ? Boolean(picker.midHand) : isMidHandSetupActive);

    setDesiredBoardSlots(resolvedTarget);
    const next: ActiveCardPicker = {
      target: 'board',
      slot,
      targetCount: resolvedTarget,
      autoChain: slot < resolvedTarget - 1,
      midHand: isMid,
    };
    setPicker(next);
    syncPickerDraftToSlot(next, slotsToUse);
  }

  useEffect(() => {
    if (!autoFocusBoardOnStreetClose) return;

    const filledCount = boardSlotsState.filter((c): c is Card => Boolean(c)).length;
    const nextTargetCount: 3 | 4 | 5 =
      filledCount < 3 ? 3 : filledCount < 4 ? 4 : 5;
    const startSlot =
      nextTargetCount === 3 ? 0 : nextTargetCount === 4 ? 3 : 4;

    const nextSlots = [...boardSlotsState];
    const firstEmptyInTarget = nextSlots
      .slice(0, nextTargetCount)
      .findIndex((c) => c === null);
    const resolvedSlot =
      firstEmptyInTarget !== -1 ? firstEmptyInTarget : startSlot;

    setDesiredBoardSlots(nextTargetCount);
    const nextPicker: ActiveCardPicker = {
      target: 'board',
      slot: resolvedSlot,
      targetCount: nextTargetCount,
      autoChain: resolvedSlot < nextTargetCount - 1,
    };
    setPicker(nextPicker);
    syncPickerDraftToSlot(nextPicker, nextSlots);

    window.requestAnimationFrame(() => {
      cardPickerSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    });

    onAcknowledgeBoardAutoFocus?.();
  }, [
    autoFocusBoardOnStreetClose,
    boardSlotsState,
    onAcknowledgeBoardAutoFocus,
  ]);

  useEffect(() => {
    if (!picker || !rankWheelRef.current) return;
    const idx = ORDERED_RANKS.indexOf(pendingRank);
    if (idx >= 0) {
      rankWheelRef.current.scrollTop = Math.max(0, (idx - 1) * 32);
    }
  }, [picker, pendingRank]);

  function getCurrentlyEditedCard(): Card | null {
    if (!picker) return null;
    if (picker.target === 'my') {
      return hand.myCards[picker.slot] ?? null;
    }
    return boardSlotsState[picker.slot] ?? hand.boardCards[picker.slot] ?? null;
  }

  function pushBoardSlotsToStore(
    slots: Array<Card | null>,
    limitCount: number,
    asMidHand = isMidHandSetupActive
  ) {
    const activeCards = slots
      .slice(0, limitCount)
      .filter((c): c is Card => Boolean(c));
    if (asMidHand && activeCards.length >= 3) {
      onEnterMidHand(activeCards);
      setIsMidHandSetupActive(false);
    } else {
      onSetBoardCards(activeCards);
    }
  }

  function commitSuitAndAdvance(suit: Suit) {
    if (!picker) return;
    const candidate = `${pendingRank}${suit}` as Card;
    const currentEdited = getCurrentlyEditedCard();

    if (usedCards.has(candidate) && candidate !== currentEdited) {
      return;
    }

    setPendingSuit(suit);

    if (picker.target === 'my') {
      onSelectMyCard(picker.slot, candidate);
      const nextMySlot: 0 | 1 | null =
        picker.slot === 0 && !hand.myCards[1] ? 1 : null;

      if (nextMySlot !== null) {
        setPicker({
          target: 'my',
          slot: nextMySlot,
          autoChain: false,
        });
        setPendingRank('A');
        setPendingSuit('s');
        return;
      }

      setPicker(null);
      return;
    }

    const updatedSlots = [...boardSlotsState];
    updatedSlots[picker.slot] = candidate;

    let nextEmptySlot: number | null = null;
    for (let i = picker.slot + 1; i < picker.targetCount; i++) {
      if (!updatedSlots[i]) {
        nextEmptySlot = i;
        break;
      }
    }
    if (nextEmptySlot === null) {
      for (let i = 0; i < picker.targetCount; i++) {
        if (!updatedSlots[i] && i !== picker.slot) {
          nextEmptySlot = i;
          break;
        }
      }
    }

    const nextPickerState: ActiveCardPicker =
      nextEmptySlot !== null
        ? {
            target: 'board',
            slot: nextEmptySlot,
            targetCount: picker.targetCount,
            autoChain: nextEmptySlot < picker.targetCount - 1,
            midHand: picker.midHand,
          }
        : null;

    setBoardSlotsState(updatedSlots);
    setDesiredBoardSlots(picker.targetCount);
    setPicker(nextPickerState);
    if (nextEmptySlot !== null) {
      setPendingRank('A');
      setPendingSuit('s');
    }
    pushBoardSlotsToStore(updatedSlots, picker.targetCount, picker.midHand);
  }

  function clearCurrentPickerSlot() {
    if (!picker) return;
    if (picker.target === 'my') {
      onSelectMyCard(picker.slot, null);
    } else {
      const updatedSlots = [...boardSlotsState];
      updatedSlots[picker.slot] = null;
      setBoardSlotsState(updatedSlots);
      pushBoardSlotsToStore(updatedSlots, picker.targetCount, false);
    }
    setPicker(null);
  }

  function applyBoardPreset(targetCount: 0 | 3 | 4 | 5) {
    setDesiredBoardSlots(targetCount);
    if (targetCount === 0) {
      setPicker(null);
      setIsMidHandSetupActive(false);
      setBoardSlotsState(makeEmptyBoardSlots());
      onSetBoardCards([]);
      return;
    }

    const trimmedSlots = boardSlotsState.map((c, idx) =>
      idx < targetCount ? c : null
    );
    setBoardSlotsState(trimmedSlots);
    pushBoardSlotsToStore(trimmedSlots, targetCount);

    const firstEmptyInTarget = trimmedSlots
      .slice(0, targetCount)
      .findIndex((c) => c === null);
    const safeSlot =
      firstEmptyInTarget !== -1 ? firstEmptyInTarget : targetCount - 1;
    openBoardSlot(safeSlot, targetCount, trimmedSlots, false);
  }

  function handleMidHandStart() {
    const activeBoard = boardSlotsState.filter((c): c is Card => Boolean(c));
    if (activeBoard.length >= 3) {
      const nextCount: 3 | 4 | 5 =
        activeBoard.length >= 5 ? 5 : activeBoard.length === 4 ? 4 : 3;
      setDesiredBoardSlots(nextCount);
      setIsMidHandSetupActive(false);
      setPicker(null);
      onEnterMidHand(activeBoard.slice(0, 5));
      return;
    }

    setIsMidHandSetupActive(true);
    setDesiredBoardSlots(5);
    const firstEmpty = boardSlotsState.slice(0, 5).findIndex((c) => c === null);
    const startSlot = firstEmpty !== -1 ? firstEmpty : 0;
    openBoardSlot(startSlot, 5, boardSlotsState, true);
  }

  const verdictColor = getVerdictColor(engine.verdict.action);
  const boardCount = hand.boardCards.length;
  const activeStageCount = Math.max(boardCount, desiredBoardSlots);
  const showBoardSlots = activeStageCount > 0 || picker?.target === 'board';
  const boardSlotsCount =
    picker?.target === 'board'
      ? Math.max(activeStageCount, picker.targetCount)
      : activeStageCount;
  const raisesCount = engine.raisesOnStreet ?? 0;
  const raiseMultiple = engine.raiseMultipleLabel;
  const showAllInSlash = Boolean(engine.verdict.suggestAllInSlash);

  const activeModalPicker = picker ?? renderedPicker;
  const modalContextLabel = activeModalPicker
    ? activeModalPicker.target === 'my'
      ? 'Рука «Я» (2 карты)'
      : activeModalPicker.midHand
        ? `С середины (5 карт борда)`
        : activeModalPicker.targetCount === 3
          ? 'Флоп (3 карты)'
          : activeModalPicker.targetCount === 4
            ? 'Тёрн (4 карты)'
            : 'Ривер (5 карт)'
    : '';

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
        <div className="flex flex-wrap items-center gap-2">
          <div ref={tableSizeMenuRef} className="relative">
            <button
              type="button"
              aria-expanded={tableSizeMenuOpen}
              aria-label="Выбор количества игроков за столом"
              onClick={() => setTableSizeMenuOpen((prev) => !prev)}
              style={{
                backgroundColor: 'var(--op-bg-elevated)',
                borderColor: tableSizeMenuOpen
                  ? 'var(--op-accent-gold)'
                  : 'var(--op-border-subtle)',
                color: 'var(--op-text-primary)',
              }}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1 text-xs font-bold transition hover:brightness-110"
            >
              <span
                style={{ color: 'var(--op-text-secondary)' }}
                className="font-normal"
              >
                Стол:
              </span>
              <span className="op-tabular">{session.nTable}</span>
              <span
                style={{ color: 'var(--op-text-secondary)' }}
                className="text-[10px]"
              >
                ▾
              </span>
            </button>

            {tableSizeMenuOpen && (
              <div
                role="listbox"
                style={{
                  backgroundColor: 'var(--op-bg-surface)',
                  borderColor: 'var(--op-border-subtle)',
                }}
                className="absolute left-0 z-50 mt-1.5 w-44 max-w-[calc(100vw-2rem)] rounded-xl border p-1.5"
              >
                <div
                  style={{ color: 'var(--op-text-secondary)' }}
                  className="mb-1 px-1 text-[10px] font-semibold"
                >
                  Мест за столом (2–15)
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {TABLE_SIZE_OPTIONS.map((n) => {
                    const active = n === session.nTable;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onSetTableSize(n);
                          setTableSizeMenuOpen(false);
                        }}
                        style={
                          active
                            ? {
                                backgroundColor: 'var(--op-accent-gold-soft)',
                                borderColor: 'var(--op-accent-gold)',
                                color: 'var(--op-accent-gold)',
                              }
                            : {
                                backgroundColor: 'var(--op-bg-elevated)',
                                borderColor: 'var(--op-border-subtle)',
                                color: 'var(--op-text-primary)',
                              }
                        }
                        className="op-tabular flex h-7 items-center justify-center rounded-lg border text-xs font-bold transition hover:brightness-110"
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <span
            style={{
              backgroundColor: 'var(--op-bg-elevated)',
              borderColor: 'var(--op-border-subtle)',
              color: 'var(--op-stat-me)',
            }}
            className="op-tabular whitespace-nowrap rounded-xl border px-2.5 py-1 text-xs font-semibold"
          >
            В игре: {engine.nActive}/{session.nTable}
          </span>

          <span
            style={{
              backgroundColor: 'var(--op-bg-elevated)',
              borderColor: 'var(--op-border-subtle)',
              color: 'var(--op-text-secondary)',
            }}
            className="whitespace-nowrap rounded-xl border px-2.5 py-1 text-xs"
          >
            Этап:{' '}
            <strong style={{ color: 'var(--op-text-primary)' }}>
              {hand.street === 'Pre'
                ? 'Префлоп'
                : hand.street === 'Flop'
                  ? 'Флоп'
                  : hand.street === 'Turn'
                    ? 'Тёрн'
                    : hand.street === 'River'
                      ? 'Ривер'
                      : 'Вскрытие'}
            </strong>
          </span>

          <span
            style={{
              backgroundColor: 'var(--op-bg-elevated)',
              borderColor: 'var(--op-border-subtle)',
              color: 'var(--op-text-secondary)',
            }}
            className="op-tabular whitespace-nowrap rounded-xl border px-2.5 py-1 text-xs"
          >
            BTN #{engine.positions.btn + 1} · SB #{engine.positions.sb + 1} · BB #
            {engine.positions.bb + 1}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setPicker(null);
              setDesiredBoardSlots(0);
              setIsMidHandSetupActive(false);
              setBoardSlotsState(makeEmptyBoardSlots());
              onResetFullGame();
            }}
            style={{
              backgroundColor: 'var(--op-bg-elevated)',
              borderColor: 'var(--op-border-subtle)',
              color: 'var(--op-text-secondary)',
            }}
            className="whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-semibold transition hover:brightness-110"
          >
            Полный сброс
          </button>
          <button
            type="button"
            onClick={() => {
              setPicker(null);
              setDesiredBoardSlots(0);
              setIsMidHandSetupActive(false);
              setBoardSlotsState(makeEmptyBoardSlots());
              onStartNewHand();
            }}
            style={{
              backgroundColor: 'var(--op-bg-elevated)',
              borderColor: 'var(--op-accent-primary)',
              color: 'var(--op-accent-primary)',
            }}
            className="whitespace-nowrap rounded-xl border px-3 py-1.5 text-xs font-bold transition hover:brightness-110"
          >
            Новая раздача (BTN →)
          </button>
        </div>
      </div>

      {raisesCount > 0 && (
        <div
          style={{
            backgroundColor: 'var(--op-accent-gold-soft)',
            borderColor: 'var(--op-accent-gold)',
          }}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-1.5 text-xs"
        >
          <span
            style={{ color: 'var(--op-accent-gold)' }}
            className="op-tabular font-semibold"
          >
            Серия рейзов на этапе: +{raisesCount}
            {raiseMultiple ? ` (${raiseMultiple})` : ''}
          </span>
          <span
            style={{ color: 'var(--op-text-secondary)' }}
            className="text-[11px]"
          >
            Учитывается в давлении и сужении диапазонов соперников
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-center">
        <div
          style={{
            borderColor: verdictColor,
            backgroundColor: 'var(--op-bg-elevated)',
          }}
          className="rounded-2xl border p-3 md:col-span-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              style={{ color: 'var(--op-text-secondary)' }}
              className="text-[11px] font-bold uppercase tracking-wider"
            >
              Рекомендация
            </span>
            {raiseMultiple && (
              <span
                style={{
                  backgroundColor: 'var(--op-bg-surface)',
                  borderColor: 'var(--op-accent-gold)',
                  color: 'var(--op-accent-gold)',
                }}
                className="op-tabular rounded-md border px-2 py-0.5 text-[11px] font-extrabold"
              >
                {raiseMultiple}
              </span>
            )}
          </div>
          <div
            style={{ color: verdictColor }}
            className="mt-1 flex flex-wrap items-baseline gap-1.5 text-xl font-extrabold tracking-tight"
          >
            <span>{VERDICT_LABEL_RU[engine.verdict.action]}</span>
            {showAllInSlash && (
              <>
                <span style={{ color: 'var(--op-text-secondary)' }}>/</span>
                <span
                  style={{ color: 'var(--op-accent-gold)' }}
                  className="font-black"
                >
                  ALL-IN
                </span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed">
            {engine.verdict.reasonText}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 md:col-span-5">
          <div
            style={{
              backgroundColor: 'var(--op-bg-elevated)',
              borderColor: 'var(--op-border-subtle)',
            }}
            className="rounded-xl border p-2.5 text-center"
          >
            <div
              style={{ color: 'var(--op-text-secondary)' }}
              className="text-[11px]"
            >
              Победа
            </div>
            <div
              style={{ color: 'var(--op-stat-me)' }}
              className="op-tabular mt-0.5 text-base font-extrabold"
            >
              {(engine.probabilities.pWinAdj * 100).toFixed(1)}%
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'var(--op-bg-elevated)',
              borderColor: 'var(--op-border-subtle)',
            }}
            className="rounded-xl border p-2.5 text-center"
          >
            <div
              style={{ color: 'var(--op-text-secondary)' }}
              className="text-[11px]"
            >
              Ничья
            </div>
            <div
              style={{ color: 'var(--op-accent-call)' }}
              className="op-tabular mt-0.5 text-base font-bold"
            >
              {(engine.probabilities.pTie * 100).toFixed(1)}%
            </div>
          </div>
          <div
            style={{
              backgroundColor: 'var(--op-bg-elevated)',
              borderColor: 'var(--op-border-subtle)',
            }}
            className="rounded-xl border p-2.5 text-center"
          >
            <div
              style={{ color: 'var(--op-text-secondary)' }}
              className="text-[11px]"
            >
              Проигрыш
            </div>
            <div
              style={{ color: 'var(--op-accent-fold)' }}
              className="op-tabular mt-0.5 text-base font-bold"
            >
              {(engine.probabilities.pLoseAdj * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      <div
        ref={cardPickerSectionRef}
        style={{
          backgroundColor: 'var(--op-bg-elevated)',
          borderColor: 'var(--op-border-subtle)',
        }}
        className="space-y-2.5 rounded-xl border p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              style={{ color: 'var(--op-text-secondary)' }}
              className="whitespace-nowrap text-xs font-semibold"
            >
              Мои карты:
            </span>
            {([0, 1] as const).map((slot) => {
              const card = hand.myCards[slot];
              const isActiveSlot = picker?.target === 'my' && picker.slot === slot;
              const suitColor = card
                ? SUIT_SYMBOLS[card[1] as Suit]?.color
                : undefined;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => openMyCardSlot(slot)}
                  style={{
                    backgroundColor: 'var(--op-bg-surface)',
                    borderColor: isActiveSlot
                      ? 'var(--op-accent-gold)'
                      : card
                        ? 'var(--op-accent-gold)'
                        : 'var(--op-border-subtle)',
                    boxShadow: isActiveSlot
                      ? '0 0 0 2px var(--op-accent-gold)'
                      : undefined,
                    color: card && suitColor ? suitColor : 'var(--op-text-primary)',
                  }}
                  className={`op-tabular flex h-10 min-w-[46px] items-center justify-center rounded-xl border px-2.5 text-sm font-extrabold transition ${
                    !card ? 'border-dashed' : ''
                  }`}
                >
                  {formatCardText(card)}
                </button>
              );
            })}
            {(hand.myCards[0] || hand.myCards[1]) && (
              <button
                type="button"
                onClick={() => {
                  onSelectMyCard(0, null);
                  onSelectMyCard(1, null);
                  setPicker(null);
                }}
                style={{
                  backgroundColor: 'var(--op-bg-surface)',
                  borderColor: 'var(--op-border-subtle)',
                  color: 'var(--op-text-secondary)',
                }}
                className="whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px]"
              >
                Сброс
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <span
              style={{ color: 'var(--op-text-secondary)' }}
              className="mr-1 whitespace-nowrap text-xs"
            >
              Борд:
            </span>
            {([0, 3, 4, 5] as const).map((cnt) => {
              const activePreset =
                cnt === 0 ? activeStageCount === 0 : activeStageCount === cnt;
              return (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => applyBoardPreset(cnt)}
                  style={
                    activePreset
                      ? {
                          backgroundColor: 'var(--op-bg-surface)',
                          borderColor: 'var(--op-accent-primary)',
                          color: 'var(--op-accent-primary)',
                        }
                      : {
                          backgroundColor: 'var(--op-bg-surface)',
                          borderColor: 'var(--op-border-subtle)',
                          color: 'var(--op-text-secondary)',
                        }
                  }
                  className="whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
                >
                  {cnt === 0
                    ? 'Префлоп (0)'
                    : cnt === 3
                      ? 'Флоп (3)'
                      : cnt === 4
                        ? 'Тёрн (4)'
                        : 'Ривер (5)'}
                </button>
              );
            })}
            <button
              type="button"
              onClick={handleMidHandStart}
              style={{
                backgroundColor:
                  isMidHandSetupActive || hand.entryMode === 'MidHandEntry'
                    ? 'var(--op-accent-gold-soft)'
                    : 'var(--op-bg-surface)',
                borderColor: 'var(--op-accent-gold)',
                color: 'var(--op-accent-gold)',
              }}
              className="whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition"
            >
              С середины
            </button>
          </div>
        </div>

        {showBoardSlots && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              style={{ color: 'var(--op-text-secondary)' }}
              className="whitespace-nowrap text-xs font-semibold"
            >
              Карты борда:
            </span>
            {Array.from({ length: boardSlotsCount }, (_, idx) => {
              const card = boardSlotsState[idx] ?? null;
              const isActiveSlot =
                picker?.target === 'board' && picker.slot === idx;
              const suitColor = card
                ? SUIT_SYMBOLS[card[1] as Suit]?.color
                : undefined;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => openBoardSlot(idx)}
                  style={{
                    backgroundColor: 'var(--op-bg-surface)',
                    borderColor: isActiveSlot
                      ? 'var(--op-accent-gold)'
                      : card
                        ? 'var(--op-accent-primary)'
                        : 'var(--op-border-subtle)',
                    boxShadow: isActiveSlot
                      ? '0 0 0 2px var(--op-accent-gold)'
                      : undefined,
                    color: card && suitColor ? suitColor : 'var(--op-text-primary)',
                  }}
                  className={`op-tabular flex h-10 min-w-[46px] items-center justify-center rounded-xl border px-2.5 text-sm font-extrabold transition ${
                    !card ? 'border-dashed' : ''
                  }`}
                >
                  {formatCardText(card)}
                </button>
              );
            })}
          </div>
        )}

        {activeModalPicker && (
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-md transition-opacity duration-200 ease-out sm:static sm:inset-auto sm:z-auto sm:block sm:bg-transparent sm:p-0 sm:backdrop-blur-none ${
              pickerVisible
                ? 'opacity-100'
                : 'pointer-events-none opacity-0 sm:pointer-events-auto sm:opacity-100'
            }`}
          >
            <div
              onClick={() => setPicker(null)}
              className="fixed inset-0 sm:hidden"
              aria-hidden="true"
            />
            <div
              style={{
                backgroundColor: 'var(--op-bg-surface)',
                borderColor: 'var(--op-border-subtle)',
              }}
              className={`relative z-10 w-full max-w-md space-y-2.5 rounded-2xl border p-3.5 transition-all duration-200 ease-out sm:max-w-none sm:rounded-xl sm:p-3 sm:scale-100 ${
                pickerVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                    <span>
                      {activeModalPicker.target === 'my'
                        ? `Карта «Я» #${activeModalPicker.slot + 1}`
                        : `Карта борда #${activeModalPicker.slot + 1}`}
                    </span>
                    <span
                      style={{
                        backgroundColor: 'var(--op-accent-gold-soft)',
                        color: 'var(--op-accent-gold)',
                      }}
                      className="rounded-md px-1.5 py-0.5 text-[10px] font-bold sm:hidden"
                    >
                      {modalContextLabel}
                    </span>
                  </div>
                  <div
                    style={{ color: 'var(--op-text-secondary)' }}
                    className="text-[11px]"
                  >
                    {activeModalPicker.autoChain
                      ? 'Выбери номинал и масть — дальше перейдёт само'
                      : 'Выбери номинал и масть — закроется после выбора'}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={clearCurrentPickerSlot}
                    style={{
                      backgroundColor: 'var(--op-bg-elevated)',
                      borderColor: 'var(--op-border-subtle)',
                      color: 'var(--op-text-secondary)',
                    }}
                    className="whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px]"
                  >
                    Очистить слот
                  </button>
                  <button
                    type="button"
                    onClick={() => setPicker(null)}
                    style={{
                      backgroundColor: 'var(--op-bg-elevated)',
                      borderColor: 'var(--op-border-subtle)',
                      color: 'var(--op-text-secondary)',
                    }}
                    className="whitespace-nowrap rounded-lg border px-2.5 py-1 text-[11px]"
                  >
                    Закрыть
                  </button>
                </div>
              </div>

              {/* Быстрый переход между слотами набора внутри модального окна на телефоне */}
              <div className="flex flex-wrap items-center gap-1.5 sm:hidden">
                {activeModalPicker.target === 'my'
                  ? ([0, 1] as const).map((slotIdx) => {
                      const card = hand.myCards[slotIdx];
                      const isCurrent = activeModalPicker.slot === slotIdx;
                      return (
                        <button
                          key={slotIdx}
                          type="button"
                          onClick={() => {
                            const nextState: ActiveCardPicker = {
                              target: 'my',
                              slot: slotIdx,
                              autoChain: slotIdx === 0 && !hand.myCards[1],
                            };
                            setPicker(nextState);
                            syncPickerDraftToSlot(nextState);
                          }}
                          style={
                            isCurrent
                              ? {
                                  backgroundColor: 'var(--op-accent-gold-soft)',
                                  borderColor: 'var(--op-accent-gold)',
                                  color: 'var(--op-accent-gold)',
                                }
                              : {
                                  backgroundColor: 'var(--op-bg-elevated)',
                                  borderColor: 'var(--op-border-subtle)',
                                  color: 'var(--op-text-primary)',
                                }
                          }
                          className="op-tabular rounded-lg border px-2.5 py-1 text-[11px] font-bold"
                        >
                          Я {slotIdx + 1}: {formatCardText(card)}
                        </button>
                      );
                    })
                  : Array.from(
                      { length: activeModalPicker.targetCount },
                      (_, slotIdx) => {
                        const card = boardSlotsState[slotIdx] ?? null;
                        const isCurrent = activeModalPicker.slot === slotIdx;
                        return (
                          <button
                            key={slotIdx}
                            type="button"
                            onClick={() => {
                              const nextState: ActiveCardPicker = {
                                target: 'board',
                                slot: slotIdx,
                                targetCount: activeModalPicker.targetCount,
                                autoChain:
                                  slotIdx < activeModalPicker.targetCount - 1,
                                midHand: activeModalPicker.midHand,
                              };
                              setPicker(nextState);
                              syncPickerDraftToSlot(nextState);
                            }}
                            style={
                              isCurrent
                                ? {
                                    backgroundColor:
                                      'var(--op-accent-gold-soft)',
                                    borderColor: 'var(--op-accent-gold)',
                                    color: 'var(--op-accent-gold)',
                                  }
                                : {
                                    backgroundColor: 'var(--op-bg-elevated)',
                                    borderColor: 'var(--op-border-subtle)',
                                    color: 'var(--op-text-primary)',
                                  }
                            }
                            className="op-tabular rounded-lg border px-2 py-1 text-[11px] font-bold"
                          >
                            {slotIdx + 1}: {formatCardText(card)}
                          </button>
                        );
                      }
                    )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
                <div className="sm:col-span-5">
                  <div
                    style={{ color: 'var(--op-text-secondary)' }}
                    className="mb-1 text-[11px]"
                  >
                    1. Номинал (сверху вниз: A → 2)
                  </div>
                  <div
                    ref={rankWheelRef}
                    style={{
                      backgroundColor: 'var(--op-bg-base)',
                      borderColor: 'var(--op-border-subtle)',
                    }}
                    className="hq-scroll max-h-[124px] snap-y snap-mandatory overflow-y-auto rounded-xl border p-1 sm:max-h-[108px]"
                  >
                    {ORDERED_RANKS.map((rank) => {
                      const selected = pendingRank === rank;
                      return (
                        <button
                          key={rank}
                          type="button"
                          onClick={() => setPendingRank(rank)}
                          style={
                            selected
                              ? {
                                  backgroundColor: 'var(--op-accent-gold-soft)',
                                  color: 'var(--op-accent-gold)',
                                }
                              : undefined
                          }
                          className="flex h-8 w-full snap-center items-center justify-center rounded-lg text-xs font-bold transition"
                        >
                          {rank}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2 sm:col-span-7">
                  <div
                    style={{ color: 'var(--op-text-secondary)' }}
                    className="text-[11px]"
                  >
                    2. Нажми масть
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SUITS.map((suit) => {
                      const meta = SUIT_SYMBOLS[suit];
                      const candidate = `${pendingRank}${suit}` as Card;
                      const currentEdited = getCurrentlyEditedCard();
                      const isTaken =
                        usedCards.has(candidate) && candidate !== currentEdited;
                      const isSelected = pendingSuit === suit;
                      return (
                        <button
                          key={suit}
                          type="button"
                          disabled={isTaken}
                          onClick={() => commitSuitAndAdvance(suit)}
                          style={{
                            color: meta.color,
                            backgroundColor: 'var(--op-bg-elevated)',
                            borderColor: isSelected
                              ? 'var(--op-accent-gold)'
                              : 'var(--op-border-subtle)',
                          }}
                          className={`flex h-9 items-center justify-between rounded-xl border px-2.5 text-xs font-bold transition ${
                            isTaken ? 'cursor-not-allowed opacity-30' : ''
                          }`}
                        >
                          <span>
                            {pendingRank}
                            {meta.symbol}
                          </span>
                          <span
                            style={{ color: 'var(--op-text-secondary)' }}
                            className="text-[11px] font-medium"
                          >
                            {meta.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}