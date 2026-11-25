import type { PlayerAction, PlayerStyleTag, VerdictAction } from './engine/types';

export type AppLocale = 'en' | 'uk' | 'ru' | 'de' | 'es';

export interface LocaleOption {
  id: AppLocale;
  code: string;
  label: string;
}

export const LOCALE_OPTIONS: ReadonlyArray<LocaleOption> = [
  { id: 'en', code: 'EN', label: 'English' },
  { id: 'uk', code: 'UK', label: 'Українська' },
  { id: 'ru', code: 'RU', label: 'Русский' },
  { id: 'de', code: 'DE', label: 'Deutsch' },
  { id: 'es', code: 'ES', label: 'Español' },
];

const STORAGE_KEY = 'holdemiq_locale_v1';

const TRANSLATIONS = {
  en: {
    appTagline: 'Local poker engine & UI',
    splashSubtitle: 'Local poker engine',
    themeLabel: 'Theme:',
    themeAria: 'Select color theme',
    languageLabel: 'Language:',
    languageAria: 'Select language',
    trimOn: 'Trim: on',
    trimOff: 'Trim: off',
    themeGraphite: 'Graphite',
    themeObsidian: 'Obsidian',
    themeBurgundy: 'Burgundy',
    themeEspresso: 'Espresso',
    themeSand: 'Sand',
    themeSage: 'Sage',

    tableAria: 'Select number of players at the table',
    tableLabel: 'Table:',
    tableSeatsTitle: 'Table seats (2–15)',
    inPlayLabel: 'In play:',
    stageLabel: 'Stage:',
    stagePre: 'Preflop',
    stageFlop: 'Flop',
    stageTurn: 'Turn',
    stageRiver: 'River',
    stageShowdown: 'Showdown',
    resetFullGame: 'Full reset',
    startNewHand: 'New hand (BTN →)',
    raiseStreakPrefix: 'Raise streak on street:',
    raiseStreakHint: 'Factored into pressure and opponent range narrowing',
    recommendationLabel: 'Recommendation',
    winLabel: 'Win',
    tieLabel: 'Tie',
    loseLabel: 'Lose',
    myCardsLabel: 'My cards:',
    clearBtn: 'Clear',
    boardLabel: 'Board:',
    boardPreflop: 'Preflop (0)',
    boardFlop: 'Flop (3)',
    boardTurn: 'Turn (4)',
    boardRiver: 'River (5)',
    midHandBtn: 'Mid-hand',
    boardCardsLabel: 'Board cards:',
    suitSpades: 'Spades',
    suitHearts: 'Hearts',
    suitDiamonds: 'Diamonds',
    suitClubs: 'Clubs',
    verdictFold: 'FOLD',
    verdictCheck: 'CHECK',
    verdictCall: 'CALL',
    verdictRaise: 'RAISE',
    pickerContextMy: '“Me” hand (2 cards)',
    pickerContextMidHand: 'Mid-hand (5 board cards)',
    pickerContextFlop: 'Flop (3 cards)',
    pickerContextTurn: 'Turn (4 cards)',
    pickerContextRiver: 'River (5 cards)',
    pickerMyTitlePrefix: '“Me” card',
    pickerBoardTitlePrefix: 'Board card',
    pickerAutoChainHint: 'Pick rank and suit — advances automatically',
    pickerSingleHint: 'Pick rank and suit — closes after selection',
    clearSlotBtn: 'Clear slot',
    closeBtn: 'Close',
    meShort: 'Me',
    stepRankLabel: '1. Rank (top to bottom: A → 2)',
    stepSuitLabel: '2. Tap suit',

    styleNeutral: 'Neutral style',
    styleTightAgg: 'Tight-aggressive',
    styleTightPassive: 'Tight-passive',
    styleLoosePassive: 'Loose-passive',
    styleLooseAgg: 'Loose-aggressive',
    actionFold: 'Fold (FOLD)',
    actionCheckCall: 'Check / Call',
    actionRaise: 'Raise (RAISE)',
    actionAllIn: 'ALL-IN',
    tableTitlePrefix: 'Table',
    tableSeatsSuffix: 'seats',
    tableActiveSuffix: 'in play',
    tableHint: 'Tap a seat for action, ALL-IN, elimination, winner mark, or role change',
    showdownOnBtn: 'Showdown: on',
    showdownBtn: 'Showdown',
    completeHandBtn: 'Complete hand',
    handNumberPrefix: 'Hand',
    activeCountLabel: 'Active:',
    opponentsCountLabel: 'Opponents:',
    allInCountLabel: 'ALL-IN:',
    inAllInCountLabel: 'In ALL-IN:',
    seatEliminated: 'Eliminated',
    seatFolded: 'Fold (FOLD)',
    seatWinner: 'Winner',
    seatInPlay: 'In play',
    seatPrefix: 'Seat',
    playerDefaultPrefix: 'Player',
    setBtnAction: 'Set BTN',
    sitHereAction: 'I sit here',
    winnerSelectedAction: 'Winner (selected)',
    markWinnerAction: 'Mark as winner',
    resumePlayerAction: 'Resume',
    eliminatePlayerAction: 'Eliminate',
    resetProfileAction: 'Reset profile',

    comboPair: 'Pair',
    comboTwoPair: 'Two pair',
    comboThreeOfAKind: 'Three of a kind',
    comboStraight: 'Straight',
    comboFlush: 'Flush',
    comboFullHouse: 'Full house',
    comboFourOfAKind: 'Four of a kind',
    comboStraightFlush: 'Straight flush',
    tabMatrix: 'Matrix 13×13',
    tabPlayersPrefix: 'Dossier',
    tabSummary: 'Summary',
    movesCountLabel: 'Moves:',
    matrixIdleStatus: 'Idle — wave across matrix',
    matrixFinalWaveStatus: 'Final calculation wave',
    matrixInMeSuffix: '· into “Me”',
    matrixActiveStatus: 'Calculations from current data',
    legendRaise: 'Raise',
    legendCallCheck: 'Call/Check',
    legendFoldBlock: 'Fold/Block',
    myStrengthLabel: '“Me” strength & potential',
    oppThreatLabel: 'Table / opponent threat',
    combosTitle: 'Combinations',
    combosRatio: 'Mine / Table',
    dossierHandsLabel: 'Hands:',
    dossierWinsLabel: 'Wins:',
    summaryLiveTab: 'In-game',
    summaryPostTab: 'Post-hand / Showdown',
    situationAnalysisTitle: 'Current situation breakdown',
    inAllInTitle: 'In ALL-IN',
    noneLabel: 'none',
    streetRaisesTitle: 'Raise / ALL-IN on street',
    foldedPlayersTitle: 'Folded cards (FOLD)',
    actsAfterMeTitle: 'Acts after “Me”',
    roundEndsAfterYou: 'round ends after you',
    showdownLockTitle: 'Lock winner & showdown',
    showdownDeckIsolationNote: 'Next hand deck is isolated from revealed cards of past hands',
    noShowdownBtn: 'No showdown',
    winnersTitle: 'Hand winner(s)',
    revealedCardsTitle: 'Revealed showdown cards (history & Φ memory only)',
    revealedCardSeatPrefix: 'Revealed card — seat',
    clearShortBtn: 'Clear',
    commitHandBtn: 'Commit result & advance BTN',
    newHandNoCommitBtn: 'New hand without commit',

    reasonIncompleteHand: '“Me” cards are incomplete: calculation runs in basic mode.',
    reasonIncompleteFreeStep:
      '“Me” cards are incomplete: with no raise facing, you can see the next step for free.',
    reasonRaiseVsAggression: 'Strong equity advantage even against opponent raises.',
    reasonCallVsRaise: 'Hand equity and draw potential justify continuing against a raise.',
    reasonFoldVsRaise: 'Win probability is below the threshold to continue against a raise.',
    reasonValueRaise: 'Strong hand strength and win odds — aggression is favorable.',
    reasonFreeCheckSolid: 'Solid odds with no extra risk — you can see the next card for free.',
    reasonCallPreflopEntry: 'Odds are sufficient to enter the pot preflop.',
    reasonFreeCheckLow: 'Weak odds, but the next card is available for free.',
    reasonFoldLowEquity: 'Insufficient odds given position and active player count.',
  },
  uk: {
    appTagline: 'Локальний покерний рушій та інтерфейс',
    splashSubtitle: 'Локальний покерний рушій',
    themeLabel: 'Тема:',
    themeAria: 'Вибір теми оформлення',
    languageLabel: 'Мова:',
    languageAria: 'Вибір мови інтерфейсу',
    trimOn: 'Окантовка: увімк',
    trimOff: 'Окантовка: вимк',
    themeGraphite: 'Графіт',
    themeObsidian: 'Обсидіан',
    themeBurgundy: 'Бордо',
    themeEspresso: 'Еспресо',
    themeSand: 'Пісок',
    themeSage: 'Шавлія',

    tableAria: 'Вибір кількості гравців за столом',
    tableLabel: 'Стіл:',
    tableSeatsTitle: 'Місць за столом (2–15)',
    inPlayLabel: 'У грі:',
    stageLabel: 'Етап:',
    stagePre: 'Префлоп',
    stageFlop: 'Флоп',
    stageTurn: 'Тьорн',
    stageRiver: 'Рівер',
    stageShowdown: 'Розкриття',
    resetFullGame: 'Повне скидання',
    startNewHand: 'Нова роздача (BTN →)',
    raiseStreakPrefix: 'Серія рейзів на етапі:',
    raiseStreakHint: 'Враховується у тиску та звуженні діапазонів суперників',
    recommendationLabel: 'Рекомендація',
    winLabel: 'Перемога',
    tieLabel: 'Нічия',
    loseLabel: 'Програш',
    myCardsLabel: 'Мої карти:',
    clearBtn: 'Скинути',
    boardLabel: 'Борд:',
    boardPreflop: 'Префлоп (0)',
    boardFlop: 'Флоп (3)',
    boardTurn: 'Тьорн (4)',
    boardRiver: 'Рівер (5)',
    midHandBtn: 'Із середини',
    boardCardsLabel: 'Карти борду:',
    suitSpades: 'Піки',
    suitHearts: 'Черви',
    suitDiamonds: 'Бубни',
    suitClubs: 'Трефи',
    verdictFold: 'ПАС (FOLD)',
    verdictCheck: 'ЧЕК (CHECK)',
    verdictCall: 'КОЛЛ (CALL)',
    verdictRaise: 'РЕЙЗ (RAISE)',
    pickerContextMy: 'Рука «Я» (2 карти)',
    pickerContextMidHand: 'Із середини (5 карт борду)',
    pickerContextFlop: 'Флоп (3 карти)',
    pickerContextTurn: 'Тьорн (4 карти)',
    pickerContextRiver: 'Рівер (5 карти)',
    pickerMyTitlePrefix: 'Карта «Я»',
    pickerBoardTitlePrefix: 'Карта борду',
    pickerAutoChainHint: 'Обери номінал і масть — далі перейде само',
    pickerSingleHint: 'Обери номінал і масть — закриється після вибору',
    clearSlotBtn: 'Очистити слот',
    closeBtn: 'Закрити',
    meShort: 'Я',
    stepRankLabel: '1. Номінал (зверху вниз: A → 2)',
    stepSuitLabel: '2. Натисни масть',

    styleNeutral: 'Звичайний стиль',
    styleTightAgg: 'Тайтово-агресивний',
    styleTightPassive: 'Тайтово-пасивний',
    styleLoosePassive: 'Лузово-пасивний',
    styleLooseAgg: 'Лузово-агресивний',
    actionFold: 'Пас (FOLD)',
    actionCheckCall: 'Чек / Колл',
    actionRaise: 'Рейз (RAISE)',
    actionAllIn: 'ALL-IN',
    tableTitlePrefix: 'Стіл',
    tableSeatsSuffix: 'місць',
    tableActiveSuffix: 'у грі',
    tableHint: 'Натисни на місце для дії, ALL-IN, вибування, позначки переможця або зміни ролей',
    showdownOnBtn: 'Шоудаун: увімк',
    showdownBtn: 'Шоудаун',
    completeHandBtn: 'Завершити роздачу',
    handNumberPrefix: 'Роздача',
    activeCountLabel: 'Активних:',
    opponentsCountLabel: 'Суперників:',
    allInCountLabel: 'ALL-IN:',
    inAllInCountLabel: 'У ALL-IN:',
    seatEliminated: 'Вибув',
    seatFolded: 'Пас (FOLD)',
    seatWinner: 'Переможець',
    seatInPlay: 'У грі',
    seatPrefix: 'Місце',
    playerDefaultPrefix: 'Гравець',
    setBtnAction: 'Поставити BTN',
    sitHereAction: 'Я сиджу тут',
    winnerSelectedAction: 'Переможець (вибр.)',
    markWinnerAction: 'Позначити переможцем',
    resumePlayerAction: 'Відновити',
    eliminatePlayerAction: 'Вибув із гри',
    resetProfileAction: 'Скинути профіль',

    comboPair: 'Пара',
    comboTwoPair: 'Дві пари',
    comboThreeOfAKind: 'Сет',
    comboStraight: 'Стріт',
    comboFlush: 'Флеш',
    comboFullHouse: 'Фул-хаус',
    comboFourOfAKind: 'Каре',
    comboStraightFlush: 'Стріт-флеш',
    tabMatrix: 'Матриця 13×13',
    tabPlayersPrefix: 'Досьє',
    tabSummary: 'Підсумок',
    movesCountLabel: 'Ходів:',
    matrixIdleStatus: 'Очікування — хвиля по матриці',
    matrixFinalWaveStatus: 'Фінальна хвиля розрахунків',
    matrixInMeSuffix: '· у «Я»',
    matrixActiveStatus: 'Розрахунки за поточними даними',
    legendRaise: 'Рейз',
    legendCallCheck: 'Колл/Чек',
    legendFoldBlock: 'Пас/Блок',
    myStrengthLabel: 'Сила та потенціал «Я»',
    oppThreatLabel: 'Загроза столу / суперників',
    combosTitle: 'Комбінації',
    combosRatio: 'Моє / Стіл',
    dossierHandsLabel: 'Рук:',
    dossierWinsLabel: 'Перемог:',
    summaryLiveTab: 'Під час гри',
    summaryPostTab: 'Після роздачі / Шоудаун',
    situationAnalysisTitle: 'Розбір поточної ситуації',
    inAllInTitle: 'У ALL-IN',
    noneLabel: 'немає',
    streetRaisesTitle: 'Рейз / ALL-IN на етапі',
    foldedPlayersTitle: 'Скинули карти (FOLD)',
    actsAfterMeTitle: 'Ходять після «Я»',
    roundEndsAfterYou: 'раунд завершується після вас',
    showdownLockTitle: 'Фіксація переможця та шоудауну',
    showdownDeckIsolationNote: 'Колода наступної роздачі ізольована від відкритих карт минулих рук',
    noShowdownBtn: 'Без розкриття',
    winnersTitle: 'Переможець(ці) роздачі',
    revealedCardsTitle: 'Відкриті карти на шоудауні (лише в історію та пам’ять Φ)',
    revealedCardSeatPrefix: 'Відкрита карта — місце',
    clearShortBtn: 'Очистити',
    commitHandBtn: 'Зафіксувати підсумок і зсунути BTN',
    newHandNoCommitBtn: 'Нова роздача без фіксації',

    reasonIncompleteHand: 'Карти «Я» вказані не повністю: розрахунок працює у базовому режимі.',
    reasonIncompleteFreeStep:
      'Карти «Я» вказані не повністю: за відсутності рейзу можна безкоштовно подивитися наступний крок.',
    reasonRaiseVsAggression: 'Сильна перевага за шансами навіть проти рейзу суперників.',
    reasonCallVsRaise: 'Шансів руки та потенціалу посилення вистачає для продовження проти рейзу.',
    reasonFoldVsRaise: 'Ймовірність перемоги нижча за поріг продовження проти рейзу.',
    reasonValueRaise: 'Висока сила руки та шанси на перемогу — вигідно проявити агресію.',
    reasonFreeCheckSolid: 'Непогані шанси без зайвого ризику — можна безкоштовно подивитися карту.',
    reasonCallPreflopEntry: 'Шансів достатньо для входу в роздачу на префлопі.',
    reasonFreeCheckLow: 'Слабкі шанси, але наступний хід доступний безкоштовно.',
    reasonFoldLowEquity: 'Недостатні шанси з урахуванням позиції та кількості активних гравців.',
  },
  ru: {
    appTagline: 'Локальный покерный движок и интерфейс',
    splashSubtitle: 'Локальный покерный движок',
    themeLabel: 'Тема:',
    themeAria: 'Выбор темы оформления',
    languageLabel: 'Язык:',
    languageAria: 'Выбор языка интерфейса',
    trimOn: 'Окантовка: вкл',
    trimOff: 'Окантовка: выкл',
    themeGraphite: 'Графит',
    themeObsidian: 'Обсидан',
    themeBurgundy: 'Бордо',
    themeEspresso: 'Эспрессо',
    themeSand: 'Песок',
    themeSage: 'Шалфей',

    tableAria: 'Выбор количества игроков за столом',
    tableLabel: 'Стол:',
    tableSeatsTitle: 'Мест за столом (2–15)',
    inPlayLabel: 'В игре:',
    stageLabel: 'Этап:',
    stagePre: 'Префлоп',
    stageFlop: 'Флоп',
    stageTurn: 'Тёрн',
    stageRiver: 'Ривер',
    stageShowdown: 'Вскрытие',
    resetFullGame: 'Полный сброс',
    startNewHand: 'Новая раздача (BTN →)',
    raiseStreakPrefix: 'Серия рейзов на этапе:',
    raiseStreakHint: 'Учитывается в давлении и сужении диапазонов соперников',
    recommendationLabel: 'Рекомендация',
    winLabel: 'Победа',
    tieLabel: 'Ничья',
    loseLabel: 'Проигрыш',
    myCardsLabel: 'Мои карты:',
    clearBtn: 'Сброс',
    boardLabel: 'Борд:',
    boardPreflop: 'Префлоп (0)',
    boardFlop: 'Флоп (3)',
    boardTurn: 'Тёрн (4)',
    boardRiver: 'Ривер (5)',
    midHandBtn: 'С середины',
    boardCardsLabel: 'Карты борда:',
    suitSpades: 'Пики',
    suitHearts: 'Червы',
    suitDiamonds: 'Бубны',
    suitClubs: 'Трефы',
    verdictFold: 'ПАС (FOLD)',
    verdictCheck: 'ЧЕК (CHECK)',
    verdictCall: 'КОЛЛ (CALL)',
    verdictRaise: 'РЕЙЗ (RAISE)',
    pickerContextMy: 'Рука «Я» (2 карты)',
    pickerContextMidHand: 'С середины (5 карт борда)',
    pickerContextFlop: 'Флоп (3 карты)',
    pickerContextTurn: 'Тёрн (4 карты)',
    pickerContextRiver: 'Ривер (5 карт)',
    pickerMyTitlePrefix: 'Карта «Я»',
    pickerBoardTitlePrefix: 'Карта борда',
    pickerAutoChainHint: 'Выбери номинал и масть — дальше перейдёт само',
    pickerSingleHint: 'Выбери номинал и масть — закроется после выбора',
    clearSlotBtn: 'Очистить слот',
    closeBtn: 'Закрыть',
    meShort: 'Я',
    stepRankLabel: '1. Номинал (сверху вниз: A → 2)',
    stepSuitLabel: '2. Нажми масть',

    styleNeutral: 'Обычный стиль',
    styleTightAgg: 'Тайтово-агрессивный',
    styleTightPassive: 'Тайтово-пассивный',
    styleLoosePassive: 'Лузово-пассивный',
    styleLooseAgg: 'Лузово-агрессивный',
    actionFold: 'Пас (FOLD)',
    actionCheckCall: 'Чек / Колл',
    actionRaise: 'Рейз (RAISE)',
    actionAllIn: 'ALL-IN',
    tableTitlePrefix: 'Стол',
    tableSeatsSuffix: 'мест',
    tableActiveSuffix: 'в игре',
    tableHint: 'Нажми на место для действия, ALL-IN, выбывания, отметки победителя или смены ролей',
    showdownOnBtn: 'Шоудаун: вкл',
    showdownBtn: 'Шоудаун',
    completeHandBtn: 'Завершить раздачу',
    handNumberPrefix: 'Раздача',
    activeCountLabel: 'Активных:',
    opponentsCountLabel: 'Соперников:',
    allInCountLabel: 'ALL-IN:',
    inAllInCountLabel: 'В ALL-IN:',
    seatEliminated: 'Выбыл',
    seatFolded: 'Пас (FOLD)',
    seatWinner: 'Победитель',
    seatInPlay: 'В игре',
    seatPrefix: 'Место',
    playerDefaultPrefix: 'Игрок',
    setBtnAction: 'Поставить BTN',
    sitHereAction: 'Я сижу здесь',
    winnerSelectedAction: 'Победитель (выбр.)',
    markWinnerAction: 'Отметить победителем',
    resumePlayerAction: 'Возобновить',
    eliminatePlayerAction: 'Выбыл из игры',
    resetProfileAction: 'Сброс профиля',

    comboPair: 'Пара',
    comboTwoPair: 'Две пары',
    comboThreeOfAKind: 'Сет',
    comboStraight: 'Стрит',
    comboFlush: 'Флеш',
    comboFullHouse: 'Фулл-хаус',
    comboFourOfAKind: 'Каре',
    comboStraightFlush: 'Стрит-флеш',
    tabMatrix: 'Матрица 13×13',
    tabPlayersPrefix: 'Досье',
    tabSummary: 'Итог',
    movesCountLabel: 'Ходов:',
    matrixIdleStatus: 'Ожидание — волна по матрице',
    matrixFinalWaveStatus: 'Финальная волна расчётов',
    matrixInMeSuffix: '· в «Я»',
    matrixActiveStatus: 'Расчёты по текущим данным',
    legendRaise: 'Рейз',
    legendCallCheck: 'Колл/Чек',
    legendFoldBlock: 'Пас/Блок',
    myStrengthLabel: 'Сила и потенциал «Я»',
    oppThreatLabel: 'Угроза стола / соперников',
    combosTitle: 'Комбинации',
    combosRatio: 'Моё / Стол',
    dossierHandsLabel: 'Рук:',
    dossierWinsLabel: 'Побед:',
    summaryLiveTab: 'Во время игры',
    summaryPostTab: 'После раздачи / Шоудаун',
    situationAnalysisTitle: 'Разбор текущей ситуации',
    inAllInTitle: 'В ALL-IN',
    noneLabel: 'нет',
    streetRaisesTitle: 'Рейз / ALL-IN на этапе',
    foldedPlayersTitle: 'Сбросили карты (FOLD)',
    actsAfterMeTitle: 'Ходят после «Я»',
    roundEndsAfterYou: 'круг завершается после вас',
    showdownLockTitle: 'Фиксация победителя и шоудауну',
    showdownDeckIsolationNote: 'Колода следующей раздачи изолирована от вскрытых карт прошлых рук',
    noShowdownBtn: 'Без вскрытия',
    winnersTitle: 'Победитель(и) раздачи',
    revealedCardsTitle: 'Вскрытые карты на шоудауне (только в историю и память Φ)',
    revealedCardSeatPrefix: 'Вскрытая карта — место',
    clearShortBtn: 'Очистить',
    commitHandBtn: 'Зафиксировать итог и сдвинуть BTN',
    newHandNoCommitBtn: 'Новая раздача без фиксации',

    reasonIncompleteHand: 'Карты «Я» указаны не полностью: расчёт работает в базовом режиме.',
    reasonIncompleteFreeStep:
      'Карты «Я» указаны не полностью: при отсутствии рейза можно бесплатно посмотреть следующий шаг.',
    reasonRaiseVsAggression: 'Сильное преимущество по шансам даже против рейза соперников.',
    reasonCallVsRaise: 'Шансов руки и потенциала усиления хватает для продолжения против рейза.',
    reasonFoldVsRaise: 'Вероятность победы ниже порога продолжения против рейза.',
    reasonValueRaise: 'Высокая сила руки и шансы на победу — выгодно проявить агрессию.',
    reasonFreeCheckSolid: 'Неплохие шансы без лишнего риска — можно бесплатно посмотреть карту.',
    reasonCallPreflopEntry: 'Шансов достаточно для входа в раздачу на префлопе.',
    reasonFreeCheckLow: 'Слабые шансы, но следующий ход доступен бесплатно.',
    reasonFoldLowEquity: 'Недостаточные шансы с учётом позиции и числа активных игроков.',
  },
  de: {
    appTagline: 'Lokale Poker-Engine & Oberfläche',
    splashSubtitle: 'Lokale Poker-Engine',
    themeLabel: 'Design:',
    themeAria: 'Farbdesign wählen',
    languageLabel: 'Sprache:',
    languageAria: 'Sprache wählen',
    trimOn: 'Rand: an',
    trimOff: 'Rand: aus',
    themeGraphite: 'Graphit',
    themeObsidian: 'Obsidian',
    themeBurgundy: 'Bordeaux',
    themeEspresso: 'Espresso',
    themeSand: 'Sand',
    themeSage: 'Salbei',

    tableAria: 'Anzahl der Spieler am Tisch wählen',
    tableLabel: 'Tisch:',
    tableSeatsTitle: 'Plätze am Tisch (2–15)',
    inPlayLabel: 'Im Spiel:',
    stageLabel: 'Phase:',
    stagePre: 'Preflop',
    stageFlop: 'Flop',
    stageTurn: 'Turn',
    stageRiver: 'River',
    stageShowdown: 'Showdown',
    resetFullGame: 'Komplett-Reset',
    startNewHand: 'Neue Hand (BTN →)',
    raiseStreakPrefix: 'Raise-Serie in der Phase:',
    raiseStreakHint: 'Fließt in Druck und Range-Eingrenzung der Gegner ein',
    recommendationLabel: 'Empfehlung',
    winLabel: 'Sieg',
    tieLabel: 'Remis',
    loseLabel: 'Verlust',
    myCardsLabel: 'Meine Karten:',
    clearBtn: 'Leeren',
    boardLabel: 'Board:',
    boardPreflop: 'Preflop (0)',
    boardFlop: 'Flop (3)',
    boardTurn: 'Turn (4)',
    boardRiver: 'River (5)',
    midHandBtn: 'Mitten in Hand',
    boardCardsLabel: 'Board-Karten:',
    suitSpades: 'Pik',
    suitHearts: 'Herz',
    suitDiamonds: 'Karo',
    suitClubs: 'Kreuz',
    verdictFold: 'FOLD',
    verdictCheck: 'CHECK',
    verdictCall: 'CALL',
    verdictRaise: 'RAISE',
    pickerContextMy: '„Ich“-Hand (2 Karten)',
    pickerContextMidHand: 'Mitten in Hand (5 Board-Karten)',
    pickerContextFlop: 'Flop (3 Karten)',
    pickerContextTurn: 'Turn (4 Karten)',
    pickerContextRiver: 'River (5 Karten)',
    pickerMyTitlePrefix: '„Ich“-Karte',
    pickerBoardTitlePrefix: 'Board-Karte',
    pickerAutoChainHint: 'Wert und Farbe wählen — rückt automatisch weiter',
    pickerSingleHint: 'Wert und Farbe wählen — schließt nach Auswahl',
    clearSlotBtn: 'Slot leeren',
    closeBtn: 'Schließen',
    meShort: 'Ich',
    stepRankLabel: '1. Rang (oben nach unten: A → 2)',
    stepSuitLabel: '2. Farbe antippen',

    styleNeutral: 'Neutraler Stil',
    styleTightAgg: 'Tight-aggressiv',
    styleTightPassive: 'Tight-passiv',
    styleLoosePassive: 'Loose-passiv',
    styleLooseAgg: 'Loose-aggressiv',
    actionFold: 'Fold (FOLD)',
    actionCheckCall: 'Check / Call',
    actionRaise: 'Raise (RAISE)',
    actionAllIn: 'ALL-IN',
    tableTitlePrefix: 'Tisch',
    tableSeatsSuffix: 'Plätze',
    tableActiveSuffix: 'im Spiel',
    tableHint: 'Platz antippen für Aktion, ALL-IN, Ausscheiden, Gewinner oder Rollenwechsel',
    showdownOnBtn: 'Showdown: an',
    showdownBtn: 'Showdown',
    completeHandBtn: 'Hand beenden',
    handNumberPrefix: 'Hand',
    activeCountLabel: 'Aktiv:',
    opponentsCountLabel: 'Gegner:',
    allInCountLabel: 'ALL-IN:',
    inAllInCountLabel: 'Im ALL-IN:',
    seatEliminated: 'Ausgeschieden',
    seatFolded: 'Fold (FOLD)',
    seatWinner: 'Gewinner',
    seatInPlay: 'Im Spiel',
    seatPrefix: 'Platz',
    playerDefaultPrefix: 'Spieler',
    setBtnAction: 'BTN setzen',
    sitHereAction: 'Ich sitze hier',
    winnerSelectedAction: 'Gewinner (gewählt)',
    markWinnerAction: 'Als Gewinner markieren',
    resumePlayerAction: 'Wieder aufnehmen',
    eliminatePlayerAction: 'Ausscheiden',
    resetProfileAction: 'Profil zurücksetzen',

    comboPair: 'Paar',
    comboTwoPair: 'Zwei Paare',
    comboThreeOfAKind: 'Drilling',
    comboStraight: 'Straße',
    comboFlush: 'Flush',
    comboFullHouse: 'Full House',
    comboFourOfAKind: 'Vierling',
    comboStraightFlush: 'Straight Flush',
    tabMatrix: 'Matrix 13×13',
    tabPlayersPrefix: 'Dossier',
    tabSummary: 'Fazit',
    movesCountLabel: 'Züge:',
    matrixIdleStatus: 'Bereit — Welle über Matrix',
    matrixFinalWaveStatus: 'Finale Berechnungswelle',
    matrixInMeSuffix: '· in „Ich“',
    matrixActiveStatus: 'Berechnungen aus aktuellen Daten',
    legendRaise: 'Raise',
    legendCallCheck: 'Call/Check',
    legendFoldBlock: 'Fold/Block',
    myStrengthLabel: '„Ich“-Stärke & Potenzial',
    oppThreatLabel: 'Tisch- / Gegnergefahr',
    combosTitle: 'Kombinationen',
    combosRatio: 'Ich / Tisch',
    dossierHandsLabel: 'Hände:',
    dossierWinsLabel: 'Siege:',
    summaryLiveTab: 'Im Spiel',
    summaryPostTab: 'Nach Hand / Showdown',
    situationAnalysisTitle: 'Aktuelle Situationsanalyse',
    inAllInTitle: 'Im ALL-IN',
    noneLabel: 'keine',
    streetRaisesTitle: 'Raise / ALL-IN in Phase',
    foldedPlayersTitle: 'Gefoldet (FOLD)',
    actsAfterMeTitle: 'Nach „Ich“ am Zug',
    roundEndsAfterYou: 'Runde endet nach Ihnen',
    showdownLockTitle: 'Gewinner & Showdown festlegen',
    showdownDeckIsolationNote: 'Deck der nächsten Hand ist von aufgedeckten Karten früherer Hände getrennt',
    noShowdownBtn: 'Kein Showdown',
    winnersTitle: 'Gewinner der Hand',
    revealedCardsTitle: 'Aufgedeckte Showdown-Karten (nur Historie & Φ-Speicher)',
    revealedCardSeatPrefix: 'Aufgedeckte Karte — Platz',
    clearShortBtn: 'Leeren',
    commitHandBtn: 'Ergebnis sichern & BTN weiter',
    newHandNoCommitBtn: 'Neue Hand ohne Sichern',

    reasonIncompleteHand: '„Ich“-Karten sind unvollständig: Berechnung läuft im Basismodus.',
    reasonIncompleteFreeStep:
      '„Ich“-Karten sind unvollständig: ohne Raise können Sie den nächsten Schritt kostenlos sehen.',
    reasonRaiseVsAggression: 'Starker Equity-Vorteil selbst gegen gegnerische Raises.',
    reasonCallVsRaise: 'Handstärke und Draw-Potenzial reichen zum Mitgehen gegen ein Raise.',
    reasonFoldVsRaise: 'Gewinnwahrscheinlichkeit liegt unter der Schwelle gegen ein Raise.',
    reasonValueRaise: 'Hohe Handstärke und Gewinnchancen — Aggression lohnt sich.',
    reasonFreeCheckSolid: 'Solide Chancen ohne zusätzliches Risiko — nächste Karte gratis ansehen.',
    reasonCallPreflopEntry: 'Chancen reichen für den Einstieg in die Hand preflop.',
    reasonFreeCheckLow: 'Schwache Chancen, aber die nächste Karte ist kostenlos.',
    reasonFoldLowEquity: 'Unzureichende Chancen angesichts Position und aktiver Spielerzahl.',
  },
  es: {
    appTagline: 'Motor local de póker e interfaz',
    splashSubtitle: 'Motor local de póker',
    themeLabel: 'Tema:',
    themeAria: 'Seleccionar tema',
    languageLabel: 'Idioma:',
    languageAria: 'Seleccionar idioma',
    trimOn: 'Borde: activado',
    trimOff: 'Borde: desactivado',
    themeGraphite: 'Grafito',
    themeObsidian: 'Obsidiana',
    themeBurgundy: 'Burdeos',
    themeEspresso: 'Espresso',
    themeSand: 'Arena',
    themeSage: 'Salvia',

    tableAria: 'Seleccionar número de jugadores en la mesa',
    tableLabel: 'Mesa:',
    tableSeatsTitle: 'Asientos en mesa (2–15)',
    inPlayLabel: 'En juego:',
    stageLabel: 'Fase:',
    stagePre: 'Preflop',
    stageFlop: 'Flop',
    stageTurn: 'Turn',
    stageRiver: 'River',
    stageShowdown: 'Showdown',
    resetFullGame: 'Reinicio total',
    startNewHand: 'Nueva mano (BTN →)',
    raiseStreakPrefix: 'Racha de subidas en la fase:',
    raiseStreakHint: 'Se considera en la presión y reducción de rangos rivales',
    recommendationLabel: 'Recomendación',
    winLabel: 'Victoria',
    tieLabel: 'Empate',
    loseLabel: 'Derrota',
    myCardsLabel: 'Mis cartas:',
    clearBtn: 'Limpiar',
    boardLabel: 'Mesa:',
    boardPreflop: 'Preflop (0)',
    boardFlop: 'Flop (3)',
    boardTurn: 'Turn (4)',
    boardRiver: 'River (5)',
    midHandBtn: 'A mitad de mano',
    boardCardsLabel: 'Cartas de mesa:',
    suitSpades: 'Picas',
    suitHearts: 'Corazones',
    suitDiamonds: 'Diamantes',
    suitClubs: 'Tréboles',
    verdictFold: 'FOLD',
    verdictCheck: 'CHECK',
    verdictCall: 'CALL',
    verdictRaise: 'RAISE',
    pickerContextMy: 'Mano «Yo» (2 cartas)',
    pickerContextMidHand: 'A mitad de mano (5 cartas de mesa)',
    pickerContextFlop: 'Flop (3 cartas)',
    pickerContextTurn: 'Turn (4 cartas)',
    pickerContextRiver: 'River (5 cartas)',
    pickerMyTitlePrefix: 'Carta «Yo»',
    pickerBoardTitlePrefix: 'Carta de mesa',
    pickerAutoChainHint: 'Elige valor y palo — avanza automáticamente',
    pickerSingleHint: 'Elige valor y palo — se cierra al elegir',
    clearSlotBtn: 'Vaciar casilla',
    closeBtn: 'Cerrar',
    meShort: 'Yo',
    stepRankLabel: '1. Valor (arriba a abajo: A → 2)',
    stepSuitLabel: '2. Toca el palo',

    styleNeutral: 'Estilo neutral',
    styleTightAgg: 'Tight-agresivo',
    styleTightPassive: 'Tight-pasivo',
    styleLoosePassive: 'Loose-pasivo',
    styleLooseAgg: 'Loose-agresivo',
    actionFold: 'Fold (FOLD)',
    actionCheckCall: 'Check / Call',
    actionRaise: 'Raise (RAISE)',
    actionAllIn: 'ALL-IN',
    tableTitlePrefix: 'Mesa',
    tableSeatsSuffix: 'asientos',
    tableActiveSuffix: 'en juego',
    tableHint: 'Toca un asiento para acción, ALL-IN, eliminación, ganador o cambio de roles',
    showdownOnBtn: 'Showdown: activado',
    showdownBtn: 'Showdown',
    completeHandBtn: 'Completar mano',
    handNumberPrefix: 'Mano',
    activeCountLabel: 'Activos:',
    opponentsCountLabel: 'Rivales:',
    allInCountLabel: 'ALL-IN:',
    inAllInCountLabel: 'En ALL-IN:',
    seatEliminated: 'Eliminado',
    seatFolded: 'Fold (FOLD)',
    seatWinner: 'Ganador',
    seatInPlay: 'En juego',
    seatPrefix: 'Asiento',
    playerDefaultPrefix: 'Jugador',
    setBtnAction: 'Asignar BTN',
    sitHereAction: 'Estoy aquí',
    winnerSelectedAction: 'Ganador (elegido)',
    markWinnerAction: 'Marcar ganador',
    resumePlayerAction: 'Reanudar',
    eliminatePlayerAction: 'Eliminar',
    resetProfileAction: 'Reiniciar perfil',

    comboPair: 'Pareja',
    comboTwoPair: 'Doble pareja',
    comboThreeOfAKind: 'Trío',
    comboStraight: 'Escalera',
    comboFlush: 'Color',
    comboFullHouse: 'Full',
    comboFourOfAKind: 'Póquer',
    comboStraightFlush: 'Escalera de color',
    tabMatrix: 'Matriz 13×13',
    tabPlayersPrefix: 'Perfil',
    tabSummary: 'Resumen',
    movesCountLabel: 'Jugadas:',
    matrixIdleStatus: 'En espera — onda en matriz',
    matrixFinalWaveStatus: 'Onda final de cálculo',
    matrixInMeSuffix: '· en «Yo»',
    matrixActiveStatus: 'Cálculos con datos actuales',
    legendRaise: 'Raise',
    legendCallCheck: 'Call/Check',
    legendFoldBlock: 'Fold/Bloq',
    myStrengthLabel: 'Fuerza y potencial de «Yo»',
    oppThreatLabel: 'Amenaza de mesa / rivales',
    combosTitle: 'Combinaciones',
    combosRatio: 'Mías / Mesa',
    dossierHandsLabel: 'Manos:',
    dossierWinsLabel: 'Victorias:',
    summaryLiveTab: 'En juego',
    summaryPostTab: 'Post-mano / Showdown',
    situationAnalysisTitle: 'Análisis de la situación actual',
    inAllInTitle: 'En ALL-IN',
    noneLabel: 'ninguno',
    streetRaisesTitle: 'Raise / ALL-IN en la fase',
    foldedPlayersTitle: 'Cartas tiradas (FOLD)',
    actsAfterMeTitle: 'Actúan después de «Yo»',
    roundEndsAfterYou: 'la ronda termina tras usted',
    showdownLockTitle: 'Registrar ganador y showdown',
    showdownDeckIsolationNote: 'El mazo de la siguiente mano está aislado de cartas mostradas antes',
    noShowdownBtn: 'Sin showdown',
    winnersTitle: 'Ganador(es) de la mano',
    revealedCardsTitle: 'Cartas mostradas en showdown (solo historial y memoria Φ)',
    revealedCardSeatPrefix: 'Carta mostrada — asiento',
    clearShortBtn: 'Limpiar',
    commitHandBtn: 'Guardar resultado y mover BTN',
    newHandNoCommitBtn: 'Nueva mano sin guardar',

    reasonIncompleteHand: 'Cartas de «Yo» incompletas: cálculo en modo básico.',
    reasonIncompleteFreeStep:
      'Cartas de «Yo» incompletas: sin subida, puedes ver el siguiente paso gratis.',
    reasonRaiseVsAggression: 'Fuerte ventaja de equidad incluso ante subidas rivales.',
    reasonCallVsRaise: 'La equidad y el potencial de proyecto bastan para pagar una subida.',
    reasonFoldVsRaise: 'Probabilidad de ganar por debajo del umbral para seguir ante subida.',
    reasonValueRaise: 'Alta fuerza de mano y probabilidades — conviene subir.',
    reasonFreeCheckSolid: 'Buenas probabilidades sin riesgo extra — puedes ver la siguiente carta gratis.',
    reasonCallPreflopEntry: 'Probabilidades suficientes para entrar a la mano preflop.',
    reasonFreeCheckLow: 'Probabilidades bajas, pero el siguiente paso es gratuito.',
    reasonFoldLowEquity: 'Probabilidades insuficientes según posición y jugadores activos.',
  },
} as const;

export type TranslationKey = keyof typeof TRANSLATIONS.en;

export function detectInitialLocale(): AppLocale {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && LOCALE_OPTIONS.some((opt) => opt.id === saved)) {
      return saved as AppLocale;
    }
    const navLang = (navigator.language || 'en').toLowerCase();
    if (navLang.startsWith('uk')) return 'uk';
    if (navLang.startsWith('ru')) return 'ru';
    if (navLang.startsWith('de')) return 'de';
    if (navLang.startsWith('es')) return 'es';
    return 'en';
  } catch {
    return 'en';
  }
}

export function saveLocale(locale: AppLocale): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore storage errors in restricted environments
  }
}

export function translate(locale: AppLocale, key: TranslationKey): string {
  return TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key];
}

export function translateVerdictAction(
  locale: AppLocale,
  action: VerdictAction
): string {
  if (action === 'FOLD') return translate(locale, 'verdictFold');
  if (action === 'CHECK') return translate(locale, 'verdictCheck');
  if (action === 'CALL') return translate(locale, 'verdictCall');
  return translate(locale, 'verdictRaise');
}

export function translateStyleTag(
  locale: AppLocale,
  styleTag: PlayerStyleTag
): string {
  if (styleTag === 'TIGHT_AGG') return translate(locale, 'styleTightAgg');
  if (styleTag === 'TIGHT_PASSIVE') return translate(locale, 'styleTightPassive');
  if (styleTag === 'LOOSE_PASSIVE') return translate(locale, 'styleLoosePassive');
  if (styleTag === 'LOOSE_AGG') return translate(locale, 'styleLooseAgg');
  return translate(locale, 'styleNeutral');
}

export function translatePlayerAction(
  locale: AppLocale,
  action: PlayerAction
): string {
  if (action === 'FOLD') return translate(locale, 'actionFold');
  if (action === 'CHECK_CALL') return translate(locale, 'actionCheckCall');
  if (action === 'RAISE') return translate(locale, 'actionRaise');
  return translate(locale, 'actionAllIn');
}

export function translateReasonCode(
  locale: AppLocale,
  reasonCode: string,
  fallbackText: string
): string {
  const keyMap: Record<string, TranslationKey> = {
    INCOMPLETE_HAND: 'reasonIncompleteHand',
    INCOMPLETE_FREE_STEP: 'reasonIncompleteFreeStep',
    RAISE_VS_AGGRESSION: 'reasonRaiseVsAggression',
    CALL_VS_RAISE: 'reasonCallVsRaise',
    FOLD_VS_RAISE: 'reasonFoldVsRaise',
    VALUE_RAISE: 'reasonValueRaise',
    FREE_CHECK_SOLID: 'reasonFreeCheckSolid',
    CALL_PREFLOP_ENTRY: 'reasonCallPreflopEntry',
    FREE_CHECK_LOW: 'reasonFreeCheckLow',
    FOLD_LOW_EQUITY: 'reasonFoldLowEquity',
  };
  const key = keyMap[reasonCode];
  return key
    ? translate(locale, key)
    : translateSituationLine(locale, fallbackText);
}

export function formatPlayerDisplayName(
  locale: AppLocale,
  rawName: string | undefined,
  seatIndex: number,
  isMe: boolean
): string {
  if (isMe) return translate(locale, 'meShort');

  const trimmed = (rawName ?? '').trim();
  const defaultMatch = trimmed.match(
    /^(?:Игрок|Гравець|Player|Spieler|Jugador|seat)\s*#?\s*(\d+)$/i
  );
  if (defaultMatch || !trimmed || trimmed.startsWith('seat-')) {
    const num = defaultMatch ? Number(defaultMatch[1]) : seatIndex + 1;
    const prefix = translate(locale, 'playerDefaultPrefix')
      .replace(/#\s*$/, '')
      .trim();
    return `${prefix} ${num}`;
  }

  return trimmed.replace(/#/g, '').trim();
}

export function translateSituationLine(
  locale: AppLocale,
  line: string
): string {
  const clean = line.replace(/^-\s*/, '').trim();

  if (clean.startsWith('Карты «Я» указаны не полностью')) {
    if (clean.includes('следующ') || clean.includes('следующий ход')) {
      return translate(locale, 'reasonIncompleteFreeStep');
    }
    return translate(locale, 'reasonIncompleteHand');
  }

  const lower = clean.toLowerCase();

  if (
    lower.includes('в игре') &&
    (lower.includes('мест') || lower.includes('соперник') || lower.includes('/'))
  ) {
    const nums = clean.match(/\d+/g);
    if (nums && nums.length >= 2) {
      const active = nums[0];
      const total = nums[1];
      const opp =
        nums[2] ?? String(Math.max(0, Number(total) - 1));
      if (locale === 'en') {
        return `${active} of ${total} seats in play (${opp} opponents)`;
      }
      if (locale === 'uk') {
        return `У грі ${active} з ${total} місць (${opp} суперників)`;
      }
      if (locale === 'de') {
        return `${active} von ${total} Plätzen im Spiel (${opp} Gegner)`;
      }
      if (locale === 'es') {
        return `${active} de ${total} asientos en juego (${opp} rivales)`;
      }
      return `В игре ${active} из ${total} мест (${opp} соперников)`;
    }
  }

  if (lower.includes('рейзов на улице')) {
    const nums = clean.match(/\d+(?:[.,]\d+)?/g) ?? [];
    const count = nums[0] ?? '0';
    const mult = nums[1] ?? nums[0] ?? '1.00';
    if (locale === 'en') {
      return `Raises on street: ${count} (x${count}, multiplier ×${mult})`;
    }
    if (locale === 'uk') {
      return `Рейзів на вулиці: ${count} (x${count}, множник ×${mult})`;
    }
    if (locale === 'de') {
      return `Raises auf der Straße: ${count} (x${count}, Faktor ×${mult})`;
    }
    if (locale === 'es') {
      return `Subidas en la calle: ${count} (x${count}, multiplicador ×${mult})`;
    }
    return `Рейзов на улице: ${count} (x${count}, множитель ×${mult})`;
  }

  if (lower.includes('all-in у соперников')) {
    const nums = clean.match(/\d+/g);
    const count = nums?.[0] ?? '0';
    if (locale === 'en') {
      return `Opponent ALL-INs: ${count}`;
    }
    if (locale === 'uk') {
      return `ALL-IN у суперників: ${count}`;
    }
    if (locale === 'de') {
      return `Gegner im ALL-IN: ${count}`;
    }
    if (locale === 'es') {
      return `ALL-IN de rivales: ${count}`;
    }
    return `ALL-IN у соперников: ${count}`;
  }

  if (lower.includes('рейзов на текущей улице нет')) {
    const map: Record<AppLocale, string> = {
      en: 'No raises on the current street',
      uk: 'Рейзів на поточній вулиці немає',
      ru: 'Рейзов на текущей улице нет',
      de: 'Keine Raises auf der aktuellen Straße',
      es: 'No hay subidas en la calle actual',
    };
    return map[locale];
  }

  if (lower.includes('профили активных соперников')) {
    const map: Record<AppLocale, string> = {
      en: 'Active opponent profiles are close to neutral',
      uk: 'Профілі активних суперників близькі до нейтрального рівня',
      ru: 'Профили активных соперников близки к нейтральному уровню',
      de: 'Profile aktiver Gegner liegen nahe am neutralen Bereich',
      es: 'Los perfiles de rivales activos están cerca de lo neutral',
    };
    return map[locale];
  }

  if (lower.includes('выберите обе карты «я»')) {
    const map: Record<AppLocale, string> = {
      en: 'Select both “Me” cards for an accurate calculation against the board and opponents.',
      uk: 'Оберіть обидві карти «Я» для точного розрахунку вашої руки проти борду та суперників.',
      ru: 'Выберите обе карты «Я» для точного расчёта вашей руки против текущего борда и соперников.',
      de: 'Wählen Sie beide „Ich“-Karten für eine genaue Berechnung gegen Board und Gegner.',
      es: 'Elige ambas cartas de «Yo» para un cálculo preciso frente al tablero y los rivales.',
    };
    return map[locale];
  }

  return clean.replace(/#/g, '');
}