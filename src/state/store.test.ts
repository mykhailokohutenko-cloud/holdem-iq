import { describe, expect, it } from 'vitest';
import { getRemainingDeck } from '../engine/deck';
import {
  PokerStore,
  SESSION_STORAGE_KEY,
  loadSessionFromStorage,
  saveSessionToStorage,
} from './store';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

describe('three-layer PokerStore state management', () => {
  it('auto-shifts BTN, computes SB/BB, and preserves N_table while lowering N_active on FOLD', () => {
    const storage = createMemoryStorage();
    const store = new PokerStore({ storage, loadSavedSession: false });

    store.setTableSize(9);
    store.setBtnSeat(2);
    let snap = store.getSnapshot();

    expect(snap.engine.nTable).toBe(9);
    expect(snap.engine.nActive).toBe(9);
    expect(snap.engine.positions.btn).toBe(2);
    expect(snap.engine.positions.sb).toBe(3);
    expect(snap.engine.positions.bb).toBe(4);

    // Два паса уменьшают N_active до 7, но N_table остаётся 9
    store.recordPlayerAction({ seatIndex: 4, action: 'FOLD' });
    store.recordPlayerAction({ seatIndex: 5, action: 'FOLD' });
    snap = store.getSnapshot();
    expect(snap.engine.nTable).toBe(9);
    expect(snap.engine.nActive).toBe(7);

    // Новая раздача сдвигает BTN на (2 + 1) % 9 = 3 и возвращает всех 9 игроков
    snap = store.startNewHand();
    expect(snap.hand.btnSeat).toBe(3);
    expect(snap.engine.positions.btn).toBe(3);
    expect(snap.engine.positions.sb).toBe(4);
    expect(snap.engine.positions.bb).toBe(5);
    expect(snap.engine.nTable).toBe(9);
    expect(snap.engine.nActive).toBe(9);
  });

  it('supports mid-hand entry on 3, 4, or 5 board cards and incomplete data', () => {
    const storage = createMemoryStorage();
    const store = new PokerStore({ storage, loadSavedSession: false });

    // Неполные данные: только 1 карта у «Я», без борда
    store.setTableSize(8);
    store.setMyCard(0, 'Ah');
    let snap = store.getSnapshot();
    expect(snap.engine.nTable).toBe(8);
    expect(['FOLD', 'CHECK', 'CALL', 'RAISE']).toContain(snap.engine.verdict.action);

    // Вход на тёрне (4 карты борда) с отмеченными вышедшими игроками
    snap = store.enterMidHand({
      boardCards: ['Kd', 'Qc', '2s', '9h'],
      myCards: ['As', 'Ks'],
      foldedSeatIndices: [2, 3, 4, 5],
    });

    expect(snap.hand.entryMode).toBe('MidHandEntry');
    expect(snap.hand.street).toBe('Turn');
    expect(snap.hand.boardCards).toHaveLength(4);
    expect(snap.engine.nTable).toBe(8);
    expect(snap.engine.nActive).toBe(4);
  });

  it('safely loads/saves session to localStorage and never leaks past showdown cards into next hand deck', () => {
    const storage = createMemoryStorage();
    storage.setItem(SESSION_STORAGE_KEY, '{broken json!!!');

    // Битый JSON не должен ронять загрузку
    expect(loadSessionFromStorage(storage)).toBeNull();

    const store = new PokerStore({ storage, loadSavedSession: false });
    store.setTableSize(6);
    store.setMyCard(0, 'Qs');
    store.setMyCard(1, 'Jd');
    store.setBoardCards(['Ts', '9c', '2d', '7h', '3c']);

    store.completeHand({
      winnerSeatIndices: [1],
      isShowdown: true,
      revealedCardsBySeat: {
        1: ['As', 'Ac'],
      },
      autoStartNextHand: true,
    });

    const snap = store.getSnapshot();
    expect(snap.session.showdownHistory).toHaveLength(1);
    expect(snap.hand.handId).toBe(2);
    expect(snap.hand.knownDeadCards).toEqual([]);

    const saved = saveSessionToStorage(snap.session, storage);
    expect(saved).toBe(true);

    const reloadedSession = loadSessionFromStorage(storage);
    expect(reloadedSession?.nTable).toBe(6);
    expect(reloadedSession?.players['seat-1']?.nShowdownsTotal).toBe(1);

    const deckInNextHand = getRemainingDeck({
      handCards: snap.hand.myCards,
      boardCards: snap.hand.boardCards,
      knownDeadCards: snap.hand.knownDeadCards,
    });
    expect(deckInNextHand).toContain('As');
    expect(deckInNextHand).toContain('Ac');
  });
});