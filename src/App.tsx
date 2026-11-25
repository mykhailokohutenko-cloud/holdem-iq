import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card, HandState, PlayerAction } from './engine/types';
import { GoldChips3D } from './pulse/GoldChips3D';
import { PulseGradientFrame } from './pulse/PulseSurface';
import { PokerStore, type PokerStoreSnapshot } from './state/store';
import { InsightsAndMatrix } from './ui/InsightsAndMatrix';
import { PokerTable } from './ui/PokerTable';
import { TopVerdictAndCards } from './ui/TopVerdictAndCards';

export type PulseThemeId =
  | 'graphite-emerald'
  | 'obsidian-prism'
  | 'burgundy-brown'
  | 'espresso-oak'
  | 'pastel-sand'
  | 'pastel-sage';

const PULSE_THEME_OPTIONS: ReadonlyArray<{
  id: PulseThemeId;
  label: string;
}> = [
  { id: 'graphite-emerald', label: 'Графит' },
  { id: 'obsidian-prism', label: 'Обсидан' },
  { id: 'burgundy-brown', label: 'Бордо' },
  { id: 'espresso-oak', label: 'Эспрессо' },
  { id: 'pastel-sand', label: 'Песок' },
  { id: 'pastel-sage', label: 'Шалфей' },
];

export function App() {
  const storeRef = useRef<PokerStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new PokerStore();
  }
  const store = storeRef.current;

  const [snapshot, setSnapshot] = useState<PokerStoreSnapshot>(() =>
    store.getSnapshot()
  );

  const [pulseTheme, setPulseTheme] = useState<PulseThemeId>('graphite-emerald');
  const [rainbowTrimEnabled, setRainbowTrimEnabled] = useState<boolean>(true);
  const [themeMenuOpen, setThemeMenuOpen] = useState<boolean>(false);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const [splashVisible, setSplashVisible] = useState<boolean>(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSplashVisible(false);
    }, 950);
    return () => window.clearTimeout(timer);
  }, []);

  const [awaitingFirstPostResetPick, setAwaitingFirstPostResetPick] =
    useState(false);
  const [firstActionSeatAfterReset, setFirstActionSeatAfterReset] = useState<
    number | null
  >(null);
  const [autoFocusBoardOnStreetClose, setAutoFocusBoardOnStreetClose] =
    useState(false);
  const [isShowdownMode, setIsShowdownMode] = useState(false);
  const [selectedWinners, setSelectedWinners] = useState<number[]>([]);
  const [revealedCardsBySeat, setRevealedCardsBySeat] = useState<
    Record<number, [Card | null, Card | null]>
  >({});

  useEffect(() => {
    document.documentElement.setAttribute('data-pulse-theme', pulseTheme);
    document.documentElement.setAttribute(
      'data-rainbow-trim',
      rainbowTrimEnabled ? 'on' : 'off'
    );
  }, [pulseTheme, rainbowTrimEnabled]);

  useEffect(() => {
    if (!themeMenuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (
        themeMenuRef.current &&
        !themeMenuRef.current.contains(e.target as Node)
      ) {
        setThemeMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [themeMenuOpen]);

  useEffect(() => {
    return store.subscribe((nextSnap) => {
      setSnapshot(nextSnap);
    });
  }, [store]);

  const computeFirstSeatAfterBb = useCallback(
    (eng: PokerStoreSnapshot['engine'], h: HandState, nTable: number): number => {
      const start = (eng.positions.bb + 1) % nTable;
      for (let step = 0; step < nTable; step++) {
        const candidate = (start + step) % nTable;
        const p = h.participants[candidate];
        const status = p?.status ?? 'active';
        if (status !== 'eliminated' && status !== 'sittingOut') {
          return candidate;
        }
      }
      return start;
    },
    []
  );

  const handleSelectMyCard = useCallback(
    (slotIndex: 0 | 1, card: Card | null) => {
      store.setMyCard(slotIndex, card);
    },
    [store]
  );

  const handleSetBoardCards = useCallback(
    (cards: Card[]) => {
      store.setBoardCards(cards);
    },
    [store]
  );

  const handleEnterMidHand = useCallback(
    (boardCards: Card[]) => {
      store.enterMidHand({ boardCards });
      setAutoFocusBoardOnStreetClose(false);
    },
    [store]
  );

  const handleStartNewHand = useCallback(() => {
    store.startNewHand();
    setAwaitingFirstPostResetPick(false);
    setFirstActionSeatAfterReset(null);
    setAutoFocusBoardOnStreetClose(false);
    setIsShowdownMode(false);
    setSelectedWinners([]);
    setRevealedCardsBySeat({});
  }, [store]);

  const handleResetFullGame = useCallback(() => {
    const nextSnap = store.resetFullGame();
    setSnapshot(nextSnap);
    const firstSeat = computeFirstSeatAfterBb(
      nextSnap.engine,
      nextSnap.hand,
      nextSnap.session.nTable
    );
    setFirstActionSeatAfterReset(firstSeat);
    setAwaitingFirstPostResetPick(true);
    setAutoFocusBoardOnStreetClose(false);
    setIsShowdownMode(false);
    setSelectedWinners([]);
    setRevealedCardsBySeat({});
  }, [computeFirstSeatAfterBb, store]);

  const handleSetTableSize = useCallback(
    (nTable: number) => {
      store.setTableSize(nTable);
      setAwaitingFirstPostResetPick(false);
      setFirstActionSeatAfterReset(null);
      setSelectedWinners([]);
      setRevealedCardsBySeat({});
    },
    [store]
  );

  const handleConsumeFirstPostResetPick = useCallback(() => {
    setAwaitingFirstPostResetPick(false);
  }, []);

  const handleRecordAction = useCallback(
    (seatIndex: number, action: PlayerAction) => {
      setAwaitingFirstPostResetPick(false);
      store.recordPlayerAction({ seatIndex, action });
    },
    [store]
  );

  const handleSetButtonSeat = useCallback(
    (seatIndex: number) => {
      store.setBtnSeat(seatIndex);
    },
    [store]
  );

  const handleSetMySeat = useCallback(
    (seatIndex: number) => {
      store.setMySeat(seatIndex);
    },
    [store]
  );

  const handleEliminatePlayer = useCallback(
    (seatIndex: number) => {
      store.eliminatePlayer(seatIndex);
    },
    [store]
  );

  const handleResumePlayer = useCallback(
    (seatIndex: number, resetMemory = false) => {
      store.resumePlayer(seatIndex, { resetMemory });
    },
    [store]
  );

  const handleResetPlayerMemory = useCallback(
    (playerId: string) => {
      store.resetPlayerMemory(playerId);
    },
    [store]
  );

  const handleToggleWinner = useCallback((seatIndex: number) => {
    setSelectedWinners((prev) =>
      prev.includes(seatIndex)
        ? prev.filter((s) => s !== seatIndex)
        : [...prev, seatIndex]
    );
  }, []);

  const handleSetRevealedCard = useCallback(
    (seatIndex: number, slot: 0 | 1, card: Card | null) => {
      setRevealedCardsBySeat((prev) => {
        const currentPair: [Card | null, Card | null] = prev[seatIndex] ?? [
          null,
          null,
        ];
        const nextPair: [Card | null, Card | null] = [...currentPair] as [
          Card | null,
          Card | null,
        ];
        nextPair[slot] = card;
        return {
          ...prev,
          [seatIndex]: nextPair,
        };
      });
    },
    []
  );

  const handleCompleteHand = useCallback(
    (
      winnerSeatIndicesArg?: number[],
      isShowdownArg?: boolean,
      revealedArg?: Record<number, Card[]>
    ) => {
      const winners =
        winnerSeatIndicesArg && winnerSeatIndicesArg.length > 0
          ? winnerSeatIndicesArg
          : selectedWinners.length > 0
            ? selectedWinners
            : [snapshot.engine.positions.btn];
      const showdown = isShowdownArg ?? isShowdownMode;

      const normalizedRevealed: Record<number, Card[]> = {};
      if (revealedArg) {
        for (const [k, list] of Object.entries(revealedArg)) {
          const seatIdx = Number(k);
          const clean = (list ?? []).filter((c): c is Card => Boolean(c));
          if (!Number.isNaN(seatIdx) && clean.length > 0) {
            normalizedRevealed[seatIdx] = clean;
          }
        }
      } else {
        for (const [k, pair] of Object.entries(revealedCardsBySeat)) {
          const seatIdx = Number(k);
          const clean = (pair ?? []).filter((c): c is Card => Boolean(c));
          if (!Number.isNaN(seatIdx) && clean.length > 0) {
            normalizedRevealed[seatIdx] = clean;
          }
        }
      }

      store.completeHand({
        winnerSeatIndices: winners,
        isShowdown: showdown,
        revealedCardsBySeat: normalizedRevealed,
        autoStartNextHand: true,
      });

      setAwaitingFirstPostResetPick(false);
      setFirstActionSeatAfterReset(null);
      setAutoFocusBoardOnStreetClose(false);
      setIsShowdownMode(false);
      setSelectedWinners([]);
      setRevealedCardsBySeat({});
    },
    [
      isShowdownMode,
      revealedCardsBySeat,
      selectedWinners,
      snapshot.engine.positions.btn,
      store,
    ]
  );

  const handleStreetRoundCompleted = useCallback(() => {
    setAutoFocusBoardOnStreetClose(true);
  }, []);

  const handleAcknowledgeBoardAutoFocus = useCallback(() => {
    setAutoFocusBoardOnStreetClose(false);
  }, []);

  const handleApplyMatrixHand = useCallback(
    (cardA: Card, cardB: Card) => {
      store.setMyCard(0, cardA);
      store.setMyCard(1, cardB);
    },
    [store]
  );

  const activeWinners = useMemo(() => selectedWinners, [selectedWinners]);
  const currentThemeLabel =
    PULSE_THEME_OPTIONS.find((opt) => opt.id === pulseTheme)?.label ?? 'Графит';

  return (
    <div
      data-pulse-theme={pulseTheme}
      data-rainbow-trim={rainbowTrimEnabled ? 'on' : 'off'}
      style={{
        backgroundColor: 'var(--op-bg-base)',
        color: 'var(--op-text-primary)',
      }}
      className={`min-h-screen px-3 py-4 transition-colors duration-200 sm:px-5 ${
        rainbowTrimEnabled ? '' : 'op-glow-disabled'
      }`}
    >
      {splashVisible && (
        <div
          style={{
            backgroundColor: 'var(--op-bg-base)',
            color: 'var(--op-text-primary)',
          }}
          className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 transition-opacity duration-300"
        >
          <div
            style={{
              borderColor: 'var(--op-accent-gold)',
              boxShadow: '0 0 24px var(--op-accent-gold-soft)',
            }}
            className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 text-lg font-black tracking-tight"
          >
            <span style={{ color: 'var(--op-accent-gold)' }}>IQ</span>
          </div>
          <div className="text-sm font-extrabold tracking-wide">HoldemIQ</div>
          <div
            style={{ color: 'var(--op-text-secondary)' }}
            className="text-[11px]"
          >
            Локальный покерный движок
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1440px] space-y-4">
        <PulseGradientFrame mode="ambient">
          <header
            style={{
              backgroundColor: 'var(--op-bg-surface)',
              borderColor: 'var(--op-border-subtle)',
            }}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold tracking-tight">HoldemIQ</span>
              <span
                style={{ color: 'var(--op-text-secondary)' }}
                className="hidden sm:inline"
              >
                Локальный покерный движок и интерфейс
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div ref={themeMenuRef} className="relative">
                <button
                  type="button"
                  aria-expanded={themeMenuOpen}
                  aria-label="Выбор темы оформления"
                  onClick={() => setThemeMenuOpen((prev) => !prev)}
                  style={{
                    backgroundColor: 'var(--op-bg-elevated)',
                    borderColor: 'var(--op-border-subtle)',
                    color: 'var(--op-text-primary)',
                  }}
                  className="flex items-center gap-2 rounded-xl border px-3 py-1 font-bold transition hover:brightness-110"
                >
                  <span style={{ color: 'var(--op-text-secondary)' }}>Тема:</span>
                  <span>{currentThemeLabel}</span>
                  <span
                    style={{ color: 'var(--op-text-secondary)' }}
                    className="text-[10px]"
                  >
                    ▾
                  </span>
                </button>

                {themeMenuOpen && (
                  <div
                    role="listbox"
                    style={{
                      backgroundColor: 'var(--op-bg-surface)',
                      borderColor: 'var(--op-border-subtle)',
                    }}
                    className="absolute left-0 z-50 mt-1.5 w-44 max-w-[calc(100vw-2rem)] rounded-xl border p-1 sm:left-auto sm:right-0"
                  >
                    {PULSE_THEME_OPTIONS.map((opt) => {
                      const active = opt.id === pulseTheme;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setPulseTheme(opt.id);
                            setThemeMenuOpen(false);
                          }}
                          style={{
                            backgroundColor: active
                              ? 'var(--op-bg-elevated)'
                              : 'transparent',
                            color: active
                              ? 'var(--op-accent-gold)'
                              : 'var(--op-text-primary)',
                          }}
                          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition hover:brightness-110"
                        >
                          <span>{opt.label}</span>
                          {active && <span>•</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setRainbowTrimEnabled((prev) => !prev)}
                style={{
                  backgroundColor: rainbowTrimEnabled
                    ? 'var(--op-bg-elevated)'
                    : 'var(--op-btn-surface)',
                  borderColor: rainbowTrimEnabled
                    ? 'var(--op-accent-gold)'
                    : 'var(--op-border-subtle)',
                  color: rainbowTrimEnabled
                    ? 'var(--op-accent-gold)'
                    : 'var(--op-text-secondary)',
                }}
                className="whitespace-nowrap rounded-xl border px-3 py-1 font-semibold transition"
              >
                Окантовка: {rainbowTrimEnabled ? 'вкл' : 'выкл'}
              </button>
            </div>
          </header>
        </PulseGradientFrame>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
          <div className="min-w-0 space-y-4 lg:col-span-7">
            <PulseGradientFrame
              mode="pulse"
              pulseKey={`${snapshot.hand.handId}-${snapshot.hand.street}-${snapshot.engine.verdict.action}`}
            >
              <TopVerdictAndCards
                session={snapshot.session}
                hand={snapshot.hand}
                engine={snapshot.engine}
                autoFocusBoardOnStreetClose={autoFocusBoardOnStreetClose}
                onAcknowledgeBoardAutoFocus={handleAcknowledgeBoardAutoFocus}
                onSelectMyCard={handleSelectMyCard}
                onSetBoardCards={handleSetBoardCards}
                onEnterMidHand={handleEnterMidHand}
                onStartNewHand={handleStartNewHand}
                onResetFullGame={handleResetFullGame}
                onSetTableSize={handleSetTableSize}
              />
            </PulseGradientFrame>

            <PulseGradientFrame mode="ambient">
              <PokerTable
                session={snapshot.session}
                hand={snapshot.hand}
                engine={snapshot.engine}
                awaitingFirstPostResetPick={awaitingFirstPostResetPick}
                firstActionSeatAfterReset={firstActionSeatAfterReset}
                onConsumeFirstPostResetPick={handleConsumeFirstPostResetPick}
                onRecordAction={handleRecordAction}
                onSetButtonSeat={handleSetButtonSeat}
                onSetMySeat={handleSetMySeat}
                onEliminatePlayer={handleEliminatePlayer}
                onResumePlayer={handleResumePlayer}
                onResetPlayerMemory={handleResetPlayerMemory}
                onToggleWinner={handleToggleWinner}
                selectedWinners={activeWinners}
                isShowdownMode={isShowdownMode}
                onToggleShowdownMode={setIsShowdownMode}
                onCompleteHand={() => handleCompleteHand()}
                onStreetRoundCompleted={handleStreetRoundCompleted}
              />
            </PulseGradientFrame>
          </div>

          <div className="min-w-0 lg:col-span-5">
            <div className="flex h-full flex-col gap-3">
              <PulseGradientFrame mode="ambient" className="shrink-0">
                <InsightsAndMatrix
                  session={snapshot.session}
                  hand={snapshot.hand}
                  engine={snapshot.engine}
                  isShowdownMode={isShowdownMode}
                  onToggleShowdownMode={setIsShowdownMode}
                  selectedWinners={activeWinners}
                  onToggleWinner={handleToggleWinner}
                  revealedCardsBySeat={revealedCardsBySeat}
                  onSetRevealedCard={handleSetRevealedCard}
                  onCompleteHand={handleCompleteHand}
                  onStartNewHand={handleStartNewHand}
                  onApplyMatrixHand={handleApplyMatrixHand}
                  onResumePlayer={handleResumePlayer}
                  onResetPlayerMemory={handleResetPlayerMemory}
                />
              </PulseGradientFrame>

              <PulseGradientFrame
                mode="ambient"
                className="hidden min-h-[156px] flex-1 lg:flex lg:flex-col"
              >
                <GoldChips3D
                  count={3}
                  chipSize={62}
                  street={snapshot.hand.street}
                  actionSignal={
                    snapshot.hand.events.length > 0
                      ? snapshot.hand.events[snapshot.hand.events.length - 1]
                          .action
                      : 'IDLE'
                  }
                  eventSeq={snapshot.hand.events.length}
                  style={{
                    backgroundColor: 'var(--op-bg-surface)',
                    borderColor: 'var(--op-border-subtle)',
                    height: '100%',
                    minHeight: '156px',
                  }}
                />
              </PulseGradientFrame>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;