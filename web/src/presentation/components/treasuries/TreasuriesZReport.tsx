import React from 'react';
import { ShiftZReportModal } from '../shifts/ShiftZReportModal';
import type { TreasuriesViewModel } from './types';

export const TreasuriesZReport: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { selectedPrintShift, setSelectedPrintShift } = vm;

  return (
    <>
      {/* Shift Handover Z-Report Thermal Receipt Modal (74mm & WhatsApp) */}
      <ShiftZReportModal
        isOpen={Boolean(selectedPrintShift)}
        onClose={() => setSelectedPrintShift(null)}
        shift={selectedPrintShift}
      />
    </>
  );
};
