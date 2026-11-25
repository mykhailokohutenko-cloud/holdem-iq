import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card, HandState, PlayerAction } from './engine/types';
import {
  type AppLocale,
  detectInitialLocale,
  LOCALE_OPTIONS,
  saveLocale,
  type TranslationKey,
  translate,
} from './i18n';
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
  labelKey: TranslationKey;
}> = [
  { id: 'graphite-emerald', labelKey: 'themeGraphite' },
  { id: 'obsidian-prism', labelKey: 'themeObsidian' },
  { id: 'burgundy-brown', labelKey: 'themeBurgundy' },
  { id: 'espresso-oak', labelKey: 'themeEspresso' },
  { id: 'pastel-sand', labelKey: 'themeSand' },
  { id: 'pastel-sage', labelKey: 'themeSage' },
];

function RoundCountryFlag({ locale }: { locale: AppLocale }) {
  return (
    <span className="inline-flex h-4 w-4 shrink-0 overflow-hidden rounded-full border border-white/15">
      {locale === 'en' && (
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <rect width="24" height="24" fill="#B22234" />
          <path
            d="M0 3h24M0 7h24M0 11h24M0 15h24M0 19h24"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
          <rect width="12" height="13" fill="#3C3B6E" />
        </svg>
      )}
      {locale === 'uk' && (
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <rect width="24" height="12" y="0" fill="#0057B7" />
          <rect width="24" height="12" y="12" fill="#FFD700" />
        </svg>
      )}
      {locale === 'ru' && (
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <rect width="24" height="8" y="0" fill="#FFFFFF" />
          <rect width="24" height="8" y="8" fill="#0039A6" />
          <rect width="24" height="8" y="16" fill="#D52B1E" />
        </svg>
      )}
      {locale === 'de' && (
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <rect width="24" height="8" y="0" fill="#1C1C1C" />
          <rect width="24" height="8" y="8" fill="#DD0000" />
          <rect width="24" height="8" y="16" fill="#FFCE00" />
        </svg>
      )}
      {locale === 'es' && (
        <svg viewBox="0 0 24 24" className="h-full w-full" aria-hidden="true">
          <rect width="24" height="6" y="0" fill="#AA151B" />
          <rect width="24" height="12" y="6" fill="#F1BF00" />
          <rect width="24" height="6" y="18" fill="#AA151B" />
        </svg>
      )}
    </span>
  );
}

export function App() {
  const storeRef = useRef<PokerStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = new PokerStore();
  }
  const store = storeRef.current;

  const [snapshot, setSnapshot] = useState<PokerStoreSnapshot>(() =>
    store.getSnapshot()
  );

  const [locale, setLocale] = useState<AppLocale>(() => detectInitialLocale());
  const [langMenuOpen, setLangMenuOpen] = useState<boolean>(false);
  const langMenuRef = useRef<HTMLDivElement | null>(null);

  const [pulseTheme, setPulseTheme] = useState<PulseThemeId>('graphite-emerald');
  const [rainbowTrimEnabled, setRainbowTrimEnabled] = useState<boolean>(true);
  const [themeMenuOpen, setThemeMenuOpen] = useState<boolean>(false);
  const themeMenuRef = useRef<HTMLDivElement | null>(null);
  const [splashVisible, setSplashVisible] = useState<boolean>(true);

  const t = useCallback(
    (key: TranslationKey) => translate(locale, key),
    [locale]
  );

  useEffect(() => {
    saveLocale(locale);
    document.documentElement.setAttribute('lang', locale);
  }, [locale]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSplashVisible(false);
    }, 650);
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
    if (!langMenuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (
        langMenuRef.current &&
        !langMenuRef.current.contains(e.target as Node)
      ) {
        setLangMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [langMenuOpen]);

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
  const currentThemeLabel = useMemo(() => {
    const found = PULSE_THEME_OPTIONS.find((opt) => opt.id === pulseTheme);
    return t(found?.labelKey ?? 'themeGraphite');
  }, [pulseTheme, t]);

  const currentLocaleOption = useMemo(() => {
    return (
      LOCALE_OPTIONS.find((opt) => opt.id === locale) ?? LOCALE_OPTIONS[0]
    );
  }, [locale]);

  return (
    <div
      data-pulse-theme={pulseTheme}
      data-rainbow-trim={rainbowTrimEnabled ? 'on' : 'off'}
      style={{
        backgroundColor: 'var(--op-bg-base)',
        color: 'var(--op-text-primary)',
      }}
      className={`min-h-screen overflow-x-hidden px-3 py-4 transition-colors duration-200 sm:px-5 ${
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
            {t('splashSubtitle')}
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
            className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 text-xs"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="font-extrabold tracking-tight">HoldemIQ</span>
              <span
                style={{ color: 'var(--op-text-secondary)' }}
                className="hidden max-w-full truncate sm:inline"
              >
                {t('appTagline')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div ref={themeMenuRef} className="relative">
                <button
                  type="button"
                  aria-expanded={themeMenuOpen}
                  aria-label={t('themeAria')}
                  onClick={() => {
                    setThemeMenuOpen((prev) => !prev);
                    setLangMenuOpen(false);
                  }}
                  style={{
                    backgroundColor: 'var(--op-bg-elevated)',
                    borderColor: 'var(--op-border-subtle)',
                    color: 'var(--op-text-primary)',
                  }}
                  className="flex max-w-[200px] items-center gap-1.5 rounded-xl border px-3 py-1 font-bold transition hover:brightness-110"
                >
                  <span
                    style={{ color: 'var(--op-text-secondary)' }}
                    className="shrink-0"
                  >
                    {t('themeLabel')}
                  </span>
                  <span className="truncate">{currentThemeLabel}</span>
                  <span
                    style={{ color: 'var(--op-text-secondary)' }}
                    className="shrink-0 text-[10px]"
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
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition hover:brightness-110"
                        >
                          <span className="truncate">{t(opt.labelKey)}</span>
                          {active && <span className="shrink-0">•</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div ref={langMenuRef} className="relative">
                <button
                  type="button"
                  aria-expanded={langMenuOpen}
                  aria-label={t('languageAria')}
                  onClick={() => {
                    setLangMenuOpen((prev) => !prev);
                    setThemeMenuOpen(false);
                  }}
                  style={{
                    backgroundColor: 'var(--op-bg-elevated)',
                    borderColor: 'var(--op-border-subtle)',
                    color: 'var(--op-text-primary)',
                  }}
                  className="flex max-w-[190px] items-center gap-1.5 rounded-xl border px-3 py-1 font-bold transition hover:brightness-110"
                >
                  <span
                    style={{ color: 'var(--op-text-secondary)' }}
                    className="truncate"
                  >
                    {t('languageLabel')}
                  </span>
                  <RoundCountryFlag locale={locale} />
                  <span className="shrink-0">{currentLocaleOption.code}</span>
                  <span
                    style={{ color: 'var(--op-text-secondary)' }}
                    className="shrink-0 text-[10px]"
                  >
                    ▾
                  </span>
                </button>

                {langMenuOpen && (
                  <div
                    role="listbox"
                    style={{
                      backgroundColor: 'var(--op-bg-surface)',
                      borderColor: 'var(--op-border-subtle)',
                    }}
                    className="absolute right-0 z-50 mt-1.5 w-44 max-w-[calc(100vw-2rem)] rounded-xl border p-1"
                  >
                    {LOCALE_OPTIONS.map((opt) => {
                      const active = opt.id === locale;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setLocale(opt.id);
                            setLangMenuOpen(false);
                          }}
                          style={{
                            backgroundColor: active
                              ? 'var(--op-bg-elevated)'
                              : 'transparent',
                            color: active
                              ? 'var(--op-accent-gold)'
                              : 'var(--op-text-primary)',
                          }}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold transition hover:brightness-110"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <RoundCountryFlag locale={opt.id} />
                            <span className="truncate">{opt.label}</span>
                          </span>
                          {active && <span className="shrink-0">•</span>}
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
                className="max-w-[180px] truncate whitespace-nowrap rounded-xl border px-3 py-1 font-semibold transition"
              >
                {rainbowTrimEnabled ? t('trimOn') : t('trimOff')}
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
                locale={locale}
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
                locale={locale}
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
                  locale={locale}
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