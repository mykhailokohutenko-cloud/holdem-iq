export type Suit = 's' | 'h' | 'd' | 'c';

export type RankChar =
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | 'T'
  | 'J'
  | 'Q'
  | 'K'
  | 'A';

export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export type Card = `${RankChar}${Suit}`;

export type Street = 'Pre' | 'Flop' | 'Turn' | 'River' | 'Showdown';

export type PlayerAction = 'FOLD' | 'CHECK_CALL' | 'RAISE' | 'ALL_IN';

export type VerdictAction = 'FOLD' | 'CHECK' | 'CALL' | 'RAISE';

export type RelativeTurnOrder = 'BEFORE_ME' | 'AFTER_ME' | 'UNKNOWN';

export type ParticipantStatus = 'active' | 'folded' | 'eliminated' | 'sittingOut';

export type PlayerStyleTag =
  | 'NEUTRAL'
  | 'TIGHT_AGG'
  | 'TIGHT_PASSIVE'
  | 'LOOSE_PASSIVE'
  | 'LOOSE_AGG';

export type HandRankClass =
  | 'HIGH_CARD'
  | 'PAIR'
  | 'TWO_PAIR'
  | 'THREE_OF_A_KIND'
  | 'STRAIGHT'
  | 'FLUSH'
  | 'FULL_HOUSE'
  | 'FOUR_OF_A_KIND'
  | 'STRAIGHT_FLUSH';

export type MatrixZone =
  | 'RAISE_ZONE'
  | 'CALL_CHECK_ZONE'
  | 'FOLD_ZONE'
  | 'BLOCKED';

export interface SeatConfig {
  seatIndex: number;
  playerId: string;
  name: string;
  isMe: boolean;
}

export interface HandParticipant {
  seatIndex: number;
  playerId: string;
  status: ParticipantStatus;
  isAllIn?: boolean;
  foldedOnStreet?: Exclude<Street, 'Showdown'>;
  foldedFacingRaise?: 0 | 1;
  eliminatedOnHandId?: number;
  eliminatedOnStreet?: Exclude<Street, 'Showdown'>;
}

export interface HandEvent {
  id: string;
  street: Exclude<Street, 'Showdown'>;
  seatIndex: number;
  playerId: string;
  action: PlayerAction;
  relOrder: RelativeTurnOrder;
  facingRaise: 0 | 1;
}

export interface PlayerMemory {
  playerId: string;
  name: string;
  nHandsDecayed: number;
  nFlopDecayed: number;
  nTurnDecayed: number;
  nRiverDecayed: number;
  nRaiseDecayed: number;
  nCcDecayed: number;
  nFoldDecayed: number;
  nFoldToRaiseDecayed: number;
  nShowdownsTotal: number;
  nWinsTotal: number;
  nRevDecayed: number;
  sQDecayed: number;
  phi: number;
  styleTag: PlayerStyleTag;
}

export interface ShowdownRecord {
  handId: number;
  street: Exclude<Street, 'Showdown'>;
  isShowdown: boolean;
  winnerSeatIndices: number[];
  revealedCardsBySeat?: Record<number, Card[]>;
  timestamp?: number;
}

export interface SessionState {
  sessionId: string;
  nTable: number;
  seats: SeatConfig[];
  players: Record<string, PlayerMemory>;
  showdownHistory: ShowdownRecord[];
}

export interface HandState {
  handId: number;
  street: Street;
  entryMode: 'PreflopStart' | 'MidHandEntry';
  btnSeat: number;
  mySeat: number | null;
  myCards: [Card | null, Card | null];
  boardCards: Card[];
  knownDeadCards: Card[];
  participants: Record<number, HandParticipant>;
  events: HandEvent[];
}

export interface PlayerInsightUI {
  playerId: string;
  seatIndex: number;
  name: string;
  status: ParticipantStatus;
  isAllIn: boolean;
  canEliminate: boolean;
  canResume: boolean;
  phi: number;
  styleTag: PlayerStyleTag;
  effectiveSamples: number;
  nShowdownsTotal: number;
  nWinsTotal: number;
}

export interface MatrixCellUI {
  row: number;
  col: number;
  label: string;
  isPair: boolean;
  isSuited: boolean;
  isMyHand: boolean;
  blocked: boolean;
  eEff: number;
  zone: MatrixZone;
  intensity: number;
}

export interface VerdictDecision {
  action: VerdictAction;
  reasonCode: string;
  reasonText: string;
  eEff: number;
  thetaCall: number;
  thetaRaise: number;
  thetaAllIn?: number;
  suggestAllInSlash?: boolean;
  raiseMultipleLabel?: string | null;
  isLockedAllIn?: boolean;
  explanationLayers?: {
    verdictReason: string;
    tableFactors: string[];
    nextStepNote: string;
  };
}

export interface EngineOutput {
  nTable: number;
  nActive: number;
  nOpp: number;
  nAiOpp?: number;
  aiMe?: 0 | 1;
  raisesOnStreet?: number;
  raiseMultipleLabel?: string | null;
  suggestAllInSlash?: boolean;
  positions: {
    btn: number;
    sb: number;
    bb: number;
    myRelPos: number | null;
    posScore: number;
  };
  turnContext: {
    beforeMe: string[];
    afterMe: string[];
    kAfter: number;
    facingRaise: 0 | 1;
    canFreeCheck: boolean;
  };
  probabilities: {
    pWinRaw: number;
    pWinAdj: number;
    pTie: number;
    pLoseAdj: number;
    combinations: Record<HandRankClass, number>;
    pDrawPlus: number;
    myHandStrengthPct?: number;
    oppThreatPct?: number;
  };
  matrix13x13?: MatrixCellUI[];
  verdict: VerdictDecision;
  playerInsights: Record<string, PlayerInsightUI>;
}