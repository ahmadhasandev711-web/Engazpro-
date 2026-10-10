import { useCallback } from 'react';
import { hapticService } from '../../infrastructure/hardware/hapticService';

/**
 * Application Layer - useHaptic Hook
 * Conforms to SoC (GR-3)
 * Provides clean access to tactile feedback for UI interactions.
 */
export const useHaptic = () => {
  const triggerSelection = useCallback(() => {
    hapticService.selection();
  }, []);

  const triggerSuccess = useCallback(() => {
    hapticService.success();
  }, []);

  const triggerWarning = useCallback(() => {
    hapticService.warning();
  }, []);

  const triggerError = useCallback(() => {
    hapticService.error();
  }, []);

  return {
    selection: triggerSelection,
    success: triggerSuccess,
    warning: triggerWarning,
    error: triggerError,
    isSupported: hapticService.isSupported(),
  };
};
