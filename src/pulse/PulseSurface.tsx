import type { CSSProperties, ReactNode } from 'react';

export type GradientFrameMode = 'none' | 'ambient' | 'pulse';

export interface PulseGradientFrameProps {
  children: ReactNode;
  mode?: GradientFrameMode;
  pulseKey?: string | number;
  style?: CSSProperties;
  className?: string;
}

export function PulseGradientFrame({
  children,
  mode = 'none',
  pulseKey,
  style,
  className = '',
}: PulseGradientFrameProps) {
  const modeClass =
    mode === 'ambient'
      ? 'op-gradient-frame--ambient'
      : mode === 'pulse'
        ? 'op-gradient-frame--pulse'
        : '';

  return (
    <div
      key={mode === 'pulse' ? pulseKey : undefined}
      style={style}
      className={`op-gradient-frame rounded-2xl ${modeClass} ${className}`}
    >
      {children}
    </div>
  );
}