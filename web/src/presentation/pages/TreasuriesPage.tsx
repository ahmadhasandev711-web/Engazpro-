import React from 'react';
import { useTreasuriesPage } from '../../hooks/useTreasuriesPage';
import { TreasuriesHeader } from '../components/treasuries/TreasuriesHeader';
import { TreasuriesPendingTab } from '../components/treasuries/TreasuriesPendingTab';
import { TreasuriesDetailTab } from '../components/treasuries/TreasuriesDetailTab';
import { TreasuriesShiftsTab } from '../components/treasuries/TreasuriesShiftsTab';
import { TreasuriesCreateModal } from '../components/treasuries/TreasuriesCreateModal';
import { TreasuriesSettleModal } from '../components/treasuries/TreasuriesSettleModal';
import { TreasuriesTransferModal } from '../components/treasuries/TreasuriesTransferModal';
import { TreasuriesZReport } from '../components/treasuries/TreasuriesZReport';

export const TreasuriesPage: React.FC = () => {
  const vm = useTreasuriesPage();

  return (
    <div className="space-y-3 sm:space-y-6 flex flex-col h-full" dir="rtl">
      <TreasuriesHeader vm={vm} />
      <TreasuriesPendingTab vm={vm} />
      <TreasuriesDetailTab vm={vm} />
      <TreasuriesShiftsTab vm={vm} />
      <TreasuriesCreateModal vm={vm} />
      <TreasuriesSettleModal vm={vm} />
      <TreasuriesTransferModal vm={vm} />
      <TreasuriesZReport vm={vm} />
    </div>
  );
};
