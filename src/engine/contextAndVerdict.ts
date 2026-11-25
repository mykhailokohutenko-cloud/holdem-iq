import type {
  Card,
  HandEvent,
  HandParticipant,
  PlayerAction,
  PlayerMemory,
  RelativeTurnOrder,
  SeatConfig,
  Street,
  VerdictAction,
  VerdictDecision,
} from './types';

export interface BaseProbabilitiesInput {
  pWinRaw: number;
  pTie: number;
  pLoseRaw: number;
  pDrawPlus: number;
  combinations?: Record<string, number>;
}

export interface SeatPositionsResult {
  btn: number;
  sb: number;
  bb: number;
  myRelPos: number | null;
  posScore: number;
}

export interface EvaluateContextInput {
  nTable: number;
  btnSeat: number;
  mySeat: number | null;
  myCards?: readonly [Card | null, Card | null];
  boardCards?: readonly Card[];
  street: Street;
  seats?: readonly SeatConfig[];
  participants: Record<number, HandParticipant>;
  events: readonly HandEvent[];
  playerMemoriesById?: Record<string, PlayerMemory>;
  probabilities: BaseProbabilitiesInput;
}

export interface ContextAndVerdictOutput {
  nTable: number;
  nActive: number;
  nOpp: number;
  nAiOpp: number;
  aiMe: 0 | 1;
  raisesOnStreet: number;
  raiseMultipleLabel: string | null;
  suggestAllInSlash: boolean;
  positions: SeatPositionsResult;
  turnContext: {
    beforeMe: string[];
    afterMe: string[];
    kAfter: number;
    facingRaise: 0 | 1;
    canFreeCheck: boolean;
  };
  adjustedProbabilities: {
    pWinAdj: number;
    pTie: number;
    pLoseAdj: number;
    myHandStrengthPct: number;
    oppThreatPct: number;
  };
  verdict: VerdictDecision;
}

const KAPPA_RE = 0.45;
const DELTA_RE = 0.55;
const TAU_RE = 0.75;
const LAMBDA_AI = 1.75;
const ALPHA_AI = 0.35;
const PI_MAX = 1.85;
const G_MAX = 2.8;
const THETA_AI_1 = 0.08;
const THETA_AI_EXTRA = 0.08;

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normSeat(idx: number, nTable: number): number {
  const safe = Math.max(2, Math.trunc(nTable));
  return ((Math.trunc(idx) % safe) + safe) % safe;
}

function isSeatEligibleForRole(
  seatIndex: number,
  participants: Record<number, HandParticipant>
): boolean {
  const p = participants[seatIndex];
  if (!p) return true;
  return p.status !== 'eliminated' && p.status !== 'sittingOut';
}

export function getNextBtnSeat(
  currentBtn: number,
  nTable: number,
  participants?: Record<number, HandParticipant>
): number {
  const safe = Math.max(2, Math.min(15, Math.trunc(nTable)));
  const start = normSeat(currentBtn, safe);

  if (!participants) {
    return (start + 1) % safe;
  }

  for (let step = 1; step <= safe; step++) {
    const candidate = (start + step) % safe;
    if (isSeatEligibleForRole(candidate, participants)) {
      return candidate;
    }
  }

  return (start + 1) % safe;
}

function findNextEligibleSeat(
  fromSeat: number,
  nTable: number,
  participants: Record<number, HandParticipant>,
  skipSeats: ReadonlySet<number> = new Set()
): number {
  const safe = Math.max(2, Math.min(15, Math.trunc(nTable)));
  const start = normSeat(fromSeat, safe);

  for (let step = 1; step <= safe; step++) {
    const candidate = (start + step) % safe;
    if (
      !skipSeats.has(candidate) &&
      isSeatEligibleForRole(candidate, participants)
    ) {
      return candidate;
    }
  }

  return start;
}

export function computeSeatPositions(
  nTable: number,
  btnSeat: number,
  mySeat: number | null,
  street: Street,
  participants?: Record<number, HandParticipant>
): SeatPositionsResult {
  const safe = Math.max(2, Math.min(15, Math.trunc(nTable)));
  const btn = normSeat(btnSeat, safe);

  let sb: number;
  let bb: number;

  if (participants) {
    sb = findNextEligibleSeat(btn, safe, participants);
    bb = findNextEligibleSeat(sb, safe, participants, new Set([sb]));
  } else {
    sb = (btn + 1) % safe;
    bb = (btn + 2) % safe;
  }

  if (mySeat == null || mySeat < 0 || mySeat >= safe) {
    return {
      btn,
      sb,
      bb,
      myRelPos: null,
      posScore: 0.5,
    };
  }

  const safeMy = Math.trunc(mySeat);
  const myRelPos = (((safeMy - btn) % safe) + safe) % safe;

  let posOrder: number;
  if (street === 'Pre') {
    posOrder =
      myRelPos === 2
        ? safe
        : (((myRelPos - 3) % safe) + safe) % safe + 1;
  } else {
    posOrder = myRelPos === 0 ? safe : myRelPos;
  }

  const posScore = clamp(posOrder / safe, 1 / safe, 1);

  return {
    btn,
    sb,
    bb,
    myRelPos,
    posScore,
  };
}

export function computeRaiseEscalationMultiplier(
  raiseIndexOneBased: number
): number {
  const m = Math.max(1, Math.trunc(raiseIndexOneBased));
  return 1 + KAPPA_RE * (Math.pow(1 + DELTA_RE, m - 1) - 1);
}

export function computeRaiseMultipleLabel(raisesOnStreet: number): string | null {
  const count = Math.max(0, Math.trunc(raisesOnStreet));
  if (count <= 0) return null;
  const power = Math.min(4, count);
  const factor = Math.pow(2, power);
  return `x${factor}`;
}

function getRelOrderWeight(relOrder: RelativeTurnOrder): number {
  if (relOrder === 'AFTER_ME') return 1.18;
  if (relOrder === 'BEFORE_ME') return 0.92;
  return 1.0;
}

function getStreetWeight(street: Exclude<Street, 'Showdown'>): number {
  if (street === 'River') return 1.25;
  if (street === 'Turn') return 1.15;
  if (street === 'Flop') return 1.05;
  return 1.0;
}

function getDrawWeight(street: Street): number {
  if (street === 'Flop') return 0.25;
  if (street === 'Turn') return 0.15;
  return 0;
}

function isAggressiveAction(action: PlayerAction): boolean {
  return action === 'RAISE' || action === 'ALL_IN';
}

export function evaluateContextAndVerdict(
  input: EvaluateContextInput
): ContextAndVerdictOutput {
  const nTable = Math.max(2, Math.min(15, Math.trunc(input.nTable)));
  const activeStreet: Exclude<Street, 'Showdown'> =
    input.street === 'Showdown' ? 'River' : input.street;

  const positions = computeSeatPositions(
    nTable,
    input.btnSeat,
    input.mySeat,
    input.street,
    input.participants
  );

  const activeParticipants = Object.values(input.participants).filter(
    (p) => p.status === 'active'
  );

  const nActive = clamp(
    activeParticipants.length > 0 ? activeParticipants.length : nTable,
    2,
    nTable
  );
  const nOpp = Math.max(1, nActive - 1);

  const aiMe: 0 | 1 =
    input.mySeat != null && input.participants[input.mySeat]?.isAllIn
      ? 1
      : 0;

  const activeOppParticipants = activeParticipants.filter(
    (p) => input.mySeat == null || p.seatIndex !== input.mySeat
  );

  const nAiOpp = activeOppParticipants.filter((p) => Boolean(p.isAllIn)).length;

  const streetEvents = input.events.filter((ev) => ev.street === activeStreet);
  const raiseEventsOnStreet = streetEvents.filter((ev) =>
    isAggressiveAction(ev.action)
  );
  const raisesOnStreet = raiseEventsOnStreet.length;
  const raiseMultipleLabel = computeRaiseMultipleLabel(raisesOnStreet);

  // Отделяем рейзы/ALL-IN от соперников от собственных агрессивных действий игрока «Я»
  const oppRaiseEventsOnStreet = raiseEventsOnStreet.filter(
    (ev) => input.mySeat == null || ev.seatIndex !== input.mySeat
  );

  let raisePressureSum = 0;
  let afterMeRaisePressureSum = 0;
  let afterMeRaisesCount = 0;
  let gOppRaiseTerm = 0;

  oppRaiseEventsOnStreet.forEach((ev, idx) => {
    const m = idx + 1;
    const psiEscal = computeRaiseEscalationMultiplier(m);
    const relW = getRelOrderWeight(ev.relOrder);
    const mem = input.playerMemoriesById?.[ev.playerId];
    const phi = mem ? clamp(mem.phi, -1, 1) : 0;
    const mu = Math.exp(0.35 * phi);
    const allInBoost = ev.action === 'ALL_IN' ? LAMBDA_AI : 1.0;

    const wRe = psiEscal * relW * mu * allInBoost;
    raisePressureSum += wRe;

    if (ev.relOrder === 'AFTER_ME') {
      afterMeRaisePressureSum += wRe;
      afterMeRaisesCount += 1;
    }

    const dampedEscal = Math.pow(psiEscal, TAU_RE);
    gOppRaiseTerm += 0.22 * relW * mu * dampedEscal * allInBoost;
  });

  let gOppCallTerm = 0;
  for (const ev of streetEvents) {
    if (ev.action !== 'CHECK_CALL') continue;
    const isActiveOppEvent =
      input.mySeat == null || ev.seatIndex !== input.mySeat;
    if (!isActiveOppEvent) continue;
    const mem = input.playerMemoriesById?.[ev.playerId];
    const phi = mem ? clamp(mem.phi, -1, 1) : 0;
    gOppCallTerm += 0.06 * getRelOrderWeight(ev.relOrder) * (1 + 0.2 * phi);
  }

  let gOppProfileTerm = 0;
  for (const opp of activeOppParticipants) {
    const mem = input.playerMemoriesById?.[opp.playerId];
    if (!mem) continue;
    const streetFactor =
      activeStreet === 'Pre'
        ? 0.14
        : activeStreet === 'Flop'
          ? 0.18
          : activeStreet === 'Turn'
            ? 0.22
            : 0.25;
    gOppProfileTerm += streetFactor * clamp(mem.phi, -1, 1);
  }

  const streetW = getStreetWeight(activeStreet);
  const baseTablePressure = clamp(
    streetW *
      (0.28 * raisePressureSum +
        0.14 * afterMeRaisePressureSum +
        0.22 * (afterMeRaisesCount / Math.max(1, nTable - 1))),
    0,
    PI_MAX
  );

  const aiPressureDelta =
    nAiOpp > 0
      ? streetW *
        ALPHA_AI *
        activeOppParticipants
          .filter((p) => Boolean(p.isAllIn))
          .reduce((acc, p) => {
            const mem = input.playerMemoriesById?.[p.playerId];
            const phi = mem ? clamp(mem.phi, -1, 1) : 0;
            return acc + LAMBDA_AI * Math.exp(0.35 * phi);
          }, 0)
      : 0;

  const tablePressureEff = clamp(
    baseTablePressure + aiPressureDelta,
    0,
    PI_MAX
  );

  const gOppEff = clamp(
    gOppCallTerm + gOppRaiseTerm + gOppProfileTerm,
    -0.5,
    G_MAX
  );

  const hasOppRaiseOrAllIn = oppRaiseEventsOnStreet.length > 0 || nAiOpp > 0;
  const facingRaise: 0 | 1 = hasOppRaiseOrAllIn ? 1 : 0;
  const canFreeCheck: boolean = facingRaise === 0 && aiMe === 0;

  const multiAllInPenalty =
    nAiOpp > 1 ? 0.05 * Math.max(0, nAiOpp - 1) : 0;

  const pTie = clamp(input.probabilities.pTie, 0, 1);
  const pWinRaw = clamp(input.probabilities.pWinRaw, 0, 1 - pTie);

  const passiveCallFactor =
    activeStreet === 'Pre' && facingRaise === 0 ? 0.55 : 1.0;

  const expFactor = Math.exp(
    (-0.18 * gOppEff - 0.18 * tablePressureEff - multiAllInPenalty) *
      passiveCallFactor +
      0.16 * (positions.posScore - 0.5)
  );

  const pWinAdj = clamp(pWinRaw * expFactor, 0, Math.max(0, 1 - pTie));
  const pLoseAdj = clamp(1 - pWinAdj - pTie, 0, 1);

  const drawLambda = getDrawWeight(input.street);
  const pDrawPlus = clamp(input.probabilities.pDrawPlus, 0, 1);

  const combos = input.probabilities.combinations ?? {};
  const hasMonsterCombo =
    (combos.FOUR_OF_A_KIND ?? 0) >= 0.4 ||
    (combos.STRAIGHT_FLUSH ?? 0) >= 0.3 ||
    (combos.FULL_HOUSE ?? 0) >= 0.65 ||
    (combos.THREE_OF_A_KIND ?? 0) >= 0.75;

  const comboWeighted =
    0.1 * (combos.HIGH_CARD ?? 0) +
    0.32 * (combos.PAIR ?? 0) +
    0.55 * (combos.TWO_PAIR ?? 0) +
    0.78 * (combos.THREE_OF_A_KIND ?? 0) +
    0.86 * (combos.STRAIGHT ?? 0) +
    0.9 * (combos.FLUSH ?? 0) +
    0.96 * (combos.FULL_HOUSE ?? 0) +
    1.0 * (combos.FOUR_OF_A_KIND ?? 0) +
    1.0 * (combos.STRAIGHT_FLUSH ?? 0);

  const readyOrWinBase =
    comboWeighted > 0 ? clamp(comboWeighted, 0, 1) : pWinAdj;
  const myHandStrengthPct = Number(
    (
      100 *
      clamp(
        (1 - drawLambda) * readyOrWinBase +
          drawLambda * clamp(readyOrWinBase + pDrawPlus, 0, 1),
        0,
        1
      )
    ).toFixed(1)
  );

  const monsterBoost = hasMonsterCombo || myHandStrengthPct >= 80 ? 0.18 : 0;
  const eBase = pWinAdj + pTie / Math.max(1, nActive);
  const eEff = clamp(
    eBase + drawLambda * pDrawPlus * (1 - eBase) + monsterBoost,
    0,
    1
  );

  const deltaThetaAi =
    nAiOpp >= 1
      ? THETA_AI_1 +
        THETA_AI_EXTRA * (1 - Math.exp(-Math.max(0, nAiOpp - 1)))
      : 0;

  const thetaCall = clamp(
    0.36 / Math.sqrt(Math.max(2, nActive)) +
      0.1 * tablePressureEff +
      deltaThetaAi +
      (facingRaise === 1 ? 0.24 : 0) -
      0.08 * (positions.posScore - 0.5),
    0.08,
    0.65
  );

  const thetaRaise = clamp(
    0.78 / Math.sqrt(Math.max(2, nActive)) +
      0.12 * tablePressureEff +
      deltaThetaAi +
      (facingRaise === 1 ? 0.26 : 0) -
      0.08 * (positions.posScore - 0.5),
    thetaCall + 0.14,
    0.85
  );

  const thetaAllIn = clamp(thetaRaise + 0.14, 0.58, 0.95);

  const hasIncompleteMyCards =
    input.myCards != null && (!input.myCards[0] || !input.myCards[1]);

  const isDominantNoRaise =
    !hasIncompleteMyCards &&
    facingRaise === 0 &&
    (pWinRaw >= 0.48 || (activeStreet === 'Pre' && eEff >= thetaRaise * 0.92));

  const isStrongMonsterHand =
    !hasIncompleteMyCards &&
    (hasMonsterCombo || myHandStrengthPct >= 75 || pWinAdj >= 0.58);

  const canValueRaiseWithoutMonster =
    !hasIncompleteMyCards &&
    eEff >= thetaRaise &&
    (pWinAdj >= 0.16 || myHandStrengthPct >= 35);

  let action: VerdictAction;
  let reasonCode: string;
  let reasonText: string;
  let isLockedAllIn = false;

  if (aiMe === 1) {
    action = 'CHECK';
    reasonCode = 'LOCKED_ALL_IN';
    reasonText =
      'Вы уже зафиксированы в ALL-IN — активные решения на следующих шагах не требуются, ожидаем борд/вскрытие.';
    isLockedAllIn = true;
  } else if (hasIncompleteMyCards) {
    if (facingRaise === 1 || nAiOpp > 0) {
      action = 'FOLD';
      reasonCode = 'INCOMPLETE_CARDS_FACING_PRESSURE';
      reasonText =
        'Карты «Я» указаны не полностью против рейза/ALL-IN: без готовой оценки руки безопаснее сбросить.';
    } else {
      action = 'CHECK';
      reasonCode = 'INCOMPLETE_CARDS_FREE_CHECK';
      reasonText =
        'Карты «Я» указаны не полностью: при отсутствии рейза можно бесплатно посмотреть следующий шаг.';
    }
  } else if (
    (canValueRaiseWithoutMonster || isDominantNoRaise || isStrongMonsterHand) &&
    (facingRaise === 0 || (nAiOpp === 0 && tablePressureEff < PI_MAX * 0.85))
  ) {
    action = 'RAISE';
    reasonCode = facingRaise === 1 ? 'RERAISE_VALUE' : 'STRONG_EQUITY_RAISE';
    reasonText =
      facingRaise === 1
        ? `Сила руки и потенциал (${Math.max(eEff * 100, myHandStrengthPct).toFixed(1)}%) позволяют ответить повышением с учётом позиции и стола.`
        : `Высокая сила руки и потенциал (${Math.max(eEff * 100, myHandStrengthPct).toFixed(1)}%) против ${nOpp} соперников — выгодно поднять.`;
  } else if (facingRaise === 1 || nAiOpp > 0) {
    if (eEff >= thetaCall || isStrongMonsterHand) {
      action = 'CALL';
      reasonCode = nAiOpp > 0 ? 'CALL_VS_ALL_IN' : 'CALL_VS_RAISE';
      reasonText =
        nAiOpp > 0
          ? `Сильная рука (${Math.max(eEff * 100, myHandStrengthPct).toFixed(1)}%) оправдывает колл против ALL-IN (${nAiOpp} соперн.).`
          : `Сила руки (${Math.max(eEff * 100, myHandStrengthPct).toFixed(1)}%) покрывает давление рейзов (${raisesOnStreet} на этапе).`;
    } else {
      action = 'FOLD';
      reasonCode = nAiOpp > 0 ? 'FOLD_VS_ALL_IN' : 'FOLD_VS_RAISE';
      reasonText =
        nAiOpp > 0
          ? `Сила руки (${(eEff * 100).toFixed(1)}%) ниже порога колла против ALL-IN соперника.`
          : `Давление рейзов и угроза соперников превышают текущую силу и потенциал руки (${(eEff * 100).toFixed(1)}%).`;
    }
  } else {
    if (eEff >= thetaCall || isStrongMonsterHand) {
      action = 'CHECK';
      reasonCode = 'CONTROL_CHECK';
      reasonText =
        'Рейза нет — можно сделать бесплатный чек и контролировать развитие борда без лишнего риска.';
    } else {
      action = 'CHECK';
      reasonCode = 'FREE_CHECK_WEAK';
      reasonText =
        'Рейза нет — бесплатный чек позволяет увидеть следующую карту без потери фишек.';
    }
  }

  const suggestAllInSlash =
    !hasIncompleteMyCards &&
    !isLockedAllIn &&
    eEff >= thetaAllIn &&
    (action === 'RAISE' || (action === 'CALL' && eEff >= thetaRaise));

  const boardCount = input.boardCards?.length ?? 0;
  const boardBaseThreat =
    boardCount >= 5 ? 0.24 : boardCount === 4 ? 0.2 : boardCount === 3 ? 0.16 : 0.12;
  const perOppThreat = clamp(
    boardBaseThreat +
      0.06 * Math.min(3, oppRaiseEventsOnStreet.length) +
      0.16 * Math.min(2, nAiOpp) +
      0.05 * clamp(gOppEff, -0.5, 1.5),
    0.04,
    0.78
  );
  const oppThreatPct = Number(
    (100 * (1 - Math.pow(1 - perOppThreat, nOpp))).toFixed(1)
  );

  const seatNameMap = new Map<number, string>();
  if (input.seats) {
    for (const s of input.seats) {
      const cleanName = s.isMe
        ? 'Я'
        : s.name && !s.name.startsWith('seat-')
          ? s.name
          : `Игрок #${s.seatIndex + 1}`;
      seatNameMap.set(s.seatIndex, cleanName);
    }
  }

  const activeSeatIndices = Object.values(input.participants)
    .filter((p) => p.status === 'active')
    .map((p) => p.seatIndex)
    .sort((a, b) => a - b);

  const beforeMe: string[] = [];
  const afterMe: string[] = [];

  if (input.mySeat != null) {
    const myOrder =
      (((input.mySeat - positions.btn) % nTable) + nTable) % nTable;
    for (const idx of activeSeatIndices) {
      if (idx === input.mySeat) continue;
      const order = (((idx - positions.btn) % nTable) + nTable) % nTable;
      const label = seatNameMap.get(idx) ?? `Игрок #${idx + 1}`;
      if (order < myOrder) beforeMe.push(label);
      else afterMe.push(label);
    }
  }

  const avgPhi =
    activeOppParticipants.length > 0
      ? activeOppParticipants.reduce((sum, p) => {
          const m = input.playerMemoriesById?.[p.playerId];
          return sum + (m ? m.phi : 0);
        }, 0) / activeOppParticipants.length
      : 0;

  const profileNote =
    avgPhi > 0.2
      ? 'Активные соперники склонны к повышенной агрессии'
      : avgPhi < -0.2
        ? 'Активные соперники чаще играют осторожно/пассивно'
        : 'Профили активных соперников близки к нейтральному уровню';

  const tableFactors: string[] = [
    `В игре ${nActive} из ${nTable} мест (${nOpp} соперников)`,
    raisesOnStreet > 0
      ? `Рейзов на улице: ${raisesOnStreet} (${raiseMultipleLabel ?? 'x2'}, множитель ×${computeRaiseEscalationMultiplier(raisesOnStreet).toFixed(2)})`
      : 'Рейзов на текущей улице нет',
    ...(nAiOpp > 0 ? [`ALL-IN у соперников: ${nAiOpp}`] : []),
    profileNote,
  ];

  const nextStepNote = hasIncompleteMyCards
    ? 'Выберите обе карты «Я» для точного расчёта вашей руки против текущего борда и соперников.'
    : isLockedAllIn
      ? 'Вы в ALL-IN — дождитесь открытия оставшихся карт борда и фиксации исхода.'
      : afterMe.length > 0
        ? `После вас в круге ещё ходят: ${afterMe.join(', ')} — возможен ответный рейз или ALL-IN.`
        : 'После вашего слова круг действий на текущей улице завершается.';

  return {
    nTable,
    nActive,
    nOpp,
    nAiOpp,
    aiMe,
    raisesOnStreet,
    raiseMultipleLabel,
    suggestAllInSlash,
    positions,
    turnContext: {
      beforeMe,
      afterMe,
      kAfter: afterMe.length,
      facingRaise,
      canFreeCheck,
    },
    adjustedProbabilities: {
      pWinAdj,
      pTie,
      pLoseAdj,
      myHandStrengthPct,
      oppThreatPct,
    },
    verdict: {
      action,
      reasonCode,
      reasonText,
      eEff,
      thetaCall,
      thetaRaise,
      thetaAllIn,
      suggestAllInSlash,
      raiseMultipleLabel,
      isLockedAllIn,
      explanationLayers: {
        verdictReason: reasonText,
        tableFactors,
        nextStepNote,
      },
    },
  };
}