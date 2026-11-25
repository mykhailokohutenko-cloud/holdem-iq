import { type CSSProperties, useCallback, useEffect, useRef } from 'react';
import type { PlayerAction, Street } from '../engine/types';

export interface GoldChips3DProps {
  count?: 1 | 2 | 3;
  chipSize?: number;
  street?: Street;
  actionSignal?: PlayerAction | 'IDLE';
  eventSeq?: number;
  style?: CSSProperties;
  className?: string;
}

interface ChipThemeSpec {
  id: 'emerald' | 'gold' | 'ruby';
  isGold: boolean;
  faceTop: string;
  faceMid: string;
  faceDark: string;
  rimSolid: string;
  edgeStripe: string;
  coreBorder: string;
  dotColor: string;
}

interface ChipRuntime {
  yaw: number;
  trick: {
    active: boolean;
    startMs: number;
    durationMs: number;
    peakY: number;
    flipX: number;
    spinY: number;
  };
}

const ALL_IN_DURATION_MS = 4200;
const DISC_LAYERS = Array.from({ length: 48 }, (_, i) => i);
const RIM_NOTCHES = Array.from({ length: 12 }, (_, i) => i * 30);

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function getThemesForCount(count: 1 | 2 | 3): ChipThemeSpec[] {
  const gold: ChipThemeSpec = {
    id: 'gold',
    isGold: true,
    faceTop: '#fbbf24',
    faceMid: '#b45309',
    faceDark: '#5c2d0c',
    rimSolid: '#92400e',
    edgeStripe: '#d97706',
    coreBorder: 'rgba(245, 158, 11, 0.78)',
    dotColor: '#f59e0b',
  };
  const emerald: ChipThemeSpec = {
    id: 'emerald',
    isGold: false,
    faceTop: '#34d399',
    faceMid: '#059669',
    faceDark: '#064e3b',
    rimSolid: '#047857',
    edgeStripe: '#a7f3d0',
    coreBorder: 'rgba(16, 185, 129, 0.55)',
    dotColor: '#10b981',
  };
  const ruby: ChipThemeSpec = {
    id: 'ruby',
    isGold: false,
    faceTop: '#fb7185',
    faceMid: '#be123c',
    faceDark: '#4c0519',
    rimSolid: '#9f1239',
    edgeStripe: '#fecdd3',
    coreBorder: 'rgba(225, 75, 86, 0.55)',
    dotColor: '#e14b56',
  };

  if (count === 1) return [gold];
  if (count === 2) return [emerald, gold];
  return [emerald, gold, ruby];
}

export function GoldChips3D({
  count = 3,
  chipSize = 62,
  street = 'Pre',
  actionSignal = 'IDLE',
  eventSeq = 0,
  style,
  className = '',
}: GoldChips3DProps) {
  const safeCount = Math.max(1, Math.min(3, count)) as 1 | 2 | 3;
  const themes = getThemesForCount(safeCount);

  const bodyRefs = useRef<Array<HTMLDivElement | null>>([]);
  const shadowRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const glintRefs = useRef<Array<HTMLSpanElement | null>>([]);

  const runtimeRef = useRef<ChipRuntime[]>([
    {
      yaw: -18,
      trick: { active: false, startMs: 0, durationMs: 1100, peakY: 0, flipX: 0, spinY: 0 },
    },
    {
      yaw: 0,
      trick: { active: false, startMs: 0, durationMs: 1100, peakY: 0, flipX: 0, spinY: 0 },
    },
    {
      yaw: 18,
      trick: { active: false, startMs: 0, durationMs: 1100, peakY: 0, flipX: 0, spinY: 0 },
    },
  ]);

  const hoverBoostRef = useRef<number>(0);
  const allInRef = useRef<{ active: boolean; startMs: number; durationMs: number }>({
    active: false,
    startMs: 0,
    durationMs: ALL_IN_DURATION_MS,
  });

  const triggerSingleHop = useCallback(
    (idx: number) => {
      const item = runtimeRef.current[idx];
      if (!item || item.trick.active) return;
      item.trick = {
        active: true,
        startMs: performance.now(),
        durationMs: 1100,
        peakY: 28,
        flipX: 360,
        spinY: 180,
      };
    },
    []
  );

  const prevStreetRef = useRef<Street>(street);
  useEffect(() => {
    if (prevStreetRef.current !== street) {
      prevStreetRef.current = street;
      const now = performance.now();
      for (let i = 0; i < safeCount; i++) {
        const item = runtimeRef.current[i];
        if (!item) continue;
        item.trick = {
          active: true,
          startMs: now + i * 130,
          durationMs: 920,
          peakY: 4,
          flipX: 0,
          spinY: 360,
        };
      }
    }
  }, [safeCount, street]);

  const firstMountRef = useRef<boolean>(true);
  useEffect(() => {
    if (firstMountRef.current) {
      firstMountRef.current = false;
      return;
    }
    if (actionSignal === 'ALL_IN') {
      allInRef.current = {
        active: true,
        startMs: performance.now(),
        durationMs: ALL_IN_DURATION_MS,
      };
    } else if (actionSignal === 'RAISE') {
      hoverBoostRef.current = 1;
    }
  }, [actionSignal, eventSeq]);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      bodyRefs.current.forEach((el, idx) => {
        if (!el) return;
        const yaw = idx === 1 ? 0 : idx === 0 ? -16 : 16;
        el.style.transform = `rotateX(16deg) rotateY(${yaw}deg)`;
      });
      return;
    }

    let rafId = 0;
    let lastMs = performance.now();

    const animate = (nowMs: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastMs) / 1000));
      lastMs = nowMs;
      hoverBoostRef.current = Math.max(0, hoverBoostRef.current - dt * 0.7);

      const cycleWave = (Math.sin(nowMs * 0.00028) + 1) * 0.5;
      const tiltBlend = smoothstep(0.28, 0.72, cycleWave);

      const allIn = allInRef.current;
      let allInProgress = -1;
      let allInEnvelope = 0;
      let goldSpeedMult = 1;
      let glintOpacity = 0;
      let glintX = -65;

      if (allIn.active) {
        allInProgress = (nowMs - allIn.startMs) / allIn.durationMs;
        if (allInProgress >= 1) {
          allIn.active = false;
          allInProgress = -1;
        } else {
          const rise = smoothstep(0.0, 0.24, allInProgress);
          const fall = 1 - smoothstep(0.78, 1.0, allInProgress);
          allInEnvelope = rise * fall;

          if (allInProgress < 0.24) {
            goldSpeedMult = 0.08;
          } else if (allInProgress < 0.52) {
            goldSpeedMult = 2.5;
          } else if (allInProgress < 0.78) {
            goldSpeedMult = 0.08;
            const glintT = (allInProgress - 0.52) / 0.26;
            glintOpacity = Math.sin(glintT * Math.PI);
            glintX = -65 + glintT * 195;
          } else {
            goldSpeedMult = 0.35 + smoothstep(0.78, 1.0, allInProgress) * 0.65;
          }
        }
      }

      const baseSpeed = 16 + hoverBoostRef.current * 24;

      for (let idx = 0; idx < safeCount; idx++) {
        const bodyEl = bodyRefs.current[idx];
        const shadowEl = shadowRefs.current[idx];
        const glintEl = glintRefs.current[idx];
        const state = runtimeRef.current[idx];
        const theme = themes[idx];
        if (!bodyEl || !state || !theme) continue;

        const dir = idx % 2 === 0 ? 1 : -1;
        const speedMult = allIn.active && theme.isGold ? goldSpeedMult : 1;
        state.yaw = (state.yaw + dir * baseSpeed * speedMult * dt) % 360;

        if (
          allIn.active &&
          theme.isGold &&
          allInProgress >= 0.46 &&
          allInProgress <= 0.78
        ) {
          const nearestFrontYaw = Math.round(state.yaw / 360) * 360;
          state.yaw += (nearestFrontYaw - state.yaw) * Math.min(1, dt * 8.5);
        }

        const phase = idx * 1.45;
        const idleFloat = Math.sin(nowMs * 0.0011 + phase) * 2.5;
        const calmPitch = 14 + Math.cos(nowMs * 0.0008 + phase) * 3.5;
        const orbitPitch = 28 + Math.sin(nowMs * 0.00125 + phase) * 18;
        let targetPitch = calmPitch * (1 - tiltBlend) + orbitPitch * tiltBlend;

        const calmRoll = (idx - (safeCount - 1) / 2) * 5;
        const orbitRoll = Math.cos(nowMs * 0.0011 + phase) * 14;
        let targetRoll = calmRoll * (1 - tiltBlend) + orbitRoll * tiltBlend;

        if (
          allIn.active &&
          theme.isGold &&
          allInProgress >= 0.46 &&
          allInProgress <= 0.78
        ) {
          targetPitch = 8;
          targetRoll = 0;
        }

        let allInY = 0;
        let allInZ = 0;
        let allInTopSpinX = 0;
        let allInTopSpinY = 0;
        let targetOpacity = 1;

        if (allInEnvelope > 0.001) {
          if (theme.isGold) {
            allInY = -34 * allInEnvelope;
            allInZ = 32 * allInEnvelope;
            const topSpinT = smoothstep(0.24, 0.52, allInProgress);
            allInTopSpinX = 360 * topSpinT;
            allInTopSpinY = 360 * topSpinT;
            if (glintEl) {
              glintEl.style.opacity = (glintOpacity * 0.92).toFixed(3);
              glintEl.style.transform = `translateX(${glintX.toFixed(
                1
              )}%) rotate(24deg)`;
            }
          } else {
            allInY = 38 * allInEnvelope;
            allInZ = -18 * allInEnvelope;
            targetOpacity = Math.max(0, 1 - allInEnvelope * 1.25);
            if (glintEl) glintEl.style.opacity = '0';
          }
        } else if (glintEl) {
          glintEl.style.opacity = '0';
        }

        let trickY = 0;
        let trickFlipX = 0;
        let trickSpinY = 0;
        if (state.trick.active && nowMs >= state.trick.startMs) {
          const t = Math.min(
            1,
            (nowMs - state.trick.startMs) / state.trick.durationMs
          );
          const eased = t * t * (3 - 2 * t);
          trickY = -state.trick.peakY * Math.sin(t * Math.PI);
          trickFlipX = state.trick.flipX * eased;
          trickSpinY = state.trick.spinY * eased;
          if (t >= 1) {
            state.yaw = (state.yaw + state.trick.spinY) % 360;
            trickFlipX = 0;
            trickSpinY = 0;
            state.trick.active = false;
          }
        }

        const targetY = idleFloat + allInY + trickY;
        const finalPitch = targetPitch + trickFlipX + allInTopSpinX;
        const finalYaw = state.yaw + trickSpinY + allInTopSpinY;

        bodyEl.style.transform = `translate3d(0px, ${targetY.toFixed(
          2
        )}px, ${allInZ.toFixed(1)}px) rotateX(${finalPitch.toFixed(
          1
        )}deg) rotateY(${finalYaw.toFixed(1)}deg) rotateZ(${targetRoll.toFixed(
          1
        )}deg)`;

        const volLayers = bodyEl.querySelectorAll<HTMLElement>('[data-chip-layer="1"]');
        for (let v = 0; v < volLayers.length; v++) {
          volLayers[v].style.opacity = targetOpacity.toFixed(3);
        }
        if (shadowEl) {
          shadowEl.style.opacity = targetOpacity.toFixed(3);
        }
      }

      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [safeCount, themes]);

  const thickness = Math.max(16, Math.round(chipSize * 0.28));
  const coreSize = Math.round(chipSize * 0.6);

  return (
    <div
      style={{
        perspective: '760px',
        ...style,
      }}
      className={`relative flex h-[156px] w-full items-center justify-center gap-8 overflow-hidden rounded-2xl border ${className}`}
    >
      {themes.map((theme, idx) => (
        <div
          key={theme.id}
          role="button"
          tabIndex={0}
          aria-label={`Фишка ${idx + 1}`}
          onPointerEnter={() => {
            hoverBoostRef.current = 1;
          }}
          onClick={() => triggerSingleHop(idx)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              triggerSingleHop(idx);
            }
          }}
          style={{
            width: `${chipSize}px`,
            height: `${chipSize}px`,
            transformStyle: 'preserve-3d',
          }}
          className="relative flex cursor-pointer items-center justify-center rounded-full focus:outline-none"
        >
          <div
            ref={(el) => {
              bodyRefs.current[idx] = el;
            }}
            style={{
              width: `${chipSize}px`,
              height: `${chipSize}px`,
              transformStyle: 'preserve-3d',
              willChange: 'transform',
            }}
            className="pointer-events-none relative rounded-full bg-transparent p-0"
          >
            {DISC_LAYERS.map((layerIdx) => {
              const z =
                -thickness / 2 +
                (layerIdx / (DISC_LAYERS.length - 1)) * thickness;
              const isFront = layerIdx === DISC_LAYERS.length - 1;
              const isBack = layerIdx === 0;
              const isEdgeStripe = layerIdx % 4 === 1;

              return (
                <span
                  key={layerIdx}
                  data-chip-layer="1"
                  style={{
                    transform: `translateZ(${z.toFixed(2)}px)`,
                    background:
                      isFront || isBack
                        ? `radial-gradient(circle at 34% 28%, ${theme.faceTop} 0%, ${theme.faceMid} 62%, ${theme.faceDark} 100%)`
                        : isEdgeStripe
                          ? theme.edgeStripe
                          : theme.rimSolid,
                    border:
                      isFront || isBack
                        ? `1px solid ${theme.edgeStripe}77`
                        : `1px solid ${theme.rimSolid}`,
                    boxShadow: isFront
                      ? 'inset 0 1px 0 rgba(255, 255, 255, 0.22)'
                      : undefined,
                  }}
                  className="pointer-events-none absolute inset-0 rounded-full"
                >
                  {(isFront || isBack) && (
                    <>
                      {RIM_NOTCHES.map((deg) => (
                        <span
                          key={deg}
                          style={{
                            transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-${Math.round(
                              chipSize * 0.42
                            )}px)`,
                          }}
                          className="absolute left-1/2 top-1/2 h-[5px] w-[2px] rounded-full bg-[#090B0E]/75"
                        />
                      ))}
                      <span
                        style={{
                          width: `${coreSize}px`,
                          height: `${coreSize}px`,
                          borderColor: theme.coreBorder,
                        }}
                        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-[#12161C]"
                      >
                        <span
                          style={{ backgroundColor: theme.dotColor }}
                          className="h-2 w-2 rounded-full"
                        />
                      </span>
                    </>
                  )}

                  {isFront && theme.isGold && (
                    <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                      <span
                        ref={(el) => {
                          glintRefs.current[idx] = el;
                        }}
                        style={{
                          opacity: 0,
                          background:
                            'linear-gradient(90deg, rgba(255, 251, 235, 0) 0%, rgba(255, 251, 235, 0.28) 32%, rgba(255, 255, 255, 0.92) 50%, rgba(255, 251, 235, 0.28) 68%, rgba(255, 251, 235, 0) 100%)',
                        }}
                        className="absolute -inset-y-4 w-[42%]"
                      />
                    </span>
                  )}
                </span>
              );
            })}
          </div>

          <span
            ref={(el) => {
              shadowRefs.current[idx] = el;
            }}
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(0, 0, 0, 0.55) 0%, transparent 72%)',
            }}
            className="pointer-events-none absolute -bottom-5 h-3 w-[82%] rounded-full"
          />
        </div>
      ))}
    </div>
  );
}