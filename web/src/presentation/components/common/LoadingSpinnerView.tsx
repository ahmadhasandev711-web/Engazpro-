import React from 'react';

interface LoadingSpinnerViewProps {
  message: string;
  fullScreen?: boolean;
}

/**
 * Pure presentational loading fallback used for cold-start session hydration and lazy route transitions.
 */
export const LoadingSpinnerView: React.FC<LoadingSpinnerViewProps> = ({
  message,
  fullScreen = false,
}) => {
  return (
    <div
      className={`${
        fullScreen ? 'min-h-screen bg-canvas' : 'min-h-[50vh]'
      } flex flex-col items-center justify-center p-8 text-center text-ink`}
      dir="rtl"
    >
      <div className="w-10 h-10 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
      <span className="mt-3 text-xs font-bold text-muted">{message}</span>
    </div>
  );
};
