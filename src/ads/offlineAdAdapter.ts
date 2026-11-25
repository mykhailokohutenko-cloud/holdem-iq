export type AdPlacementId = 'banner_bottom' | 'interstitial_hand_end';

export interface AdSlotState {
  placementId: AdPlacementId;
  /** В офлайн-режиме всегда false — сетевые запросы не выполняются */
  isReady: boolean;
  /** Текущий режим работы адаптера */
  mode: 'offline_stub';
}

export interface OfflineAdAdapter {
  readonly mode: 'offline_stub';
  getSlotState(placementId: AdPlacementId): AdSlotState;
  /** Безопасный вызов в офлайне: не выполняет сеть и не выбрасывает ошибок */
  requestSlot(placementId: AdPlacementId): Promise<AdSlotState>;
  /** Безопасный показ заглушки: возвращает false, так как офлайн-реклама отключена */
  showSlot(placementId: AdPlacementId): Promise<boolean>;
}

/**
 * Офлайн-безопасный адаптер-заглушка: не обращается к сети,
 * не зависит от состояния раздачи/памяти и готов к замене на сетевой адаптер в будущем.
 */
export function createOfflineAdAdapter(): OfflineAdAdapter {
  const getSlotState = (placementId: AdPlacementId): AdSlotState => ({
    placementId,
    isReady: false,
    mode: 'offline_stub',
  });

  return {
    mode: 'offline_stub',
    getSlotState,
    async requestSlot(placementId: AdPlacementId): Promise<AdSlotState> {
      return getSlotState(placementId);
    },
    async showSlot(placementId: AdPlacementId): Promise<boolean> {
      void placementId;
      return false;
    },
  };
}