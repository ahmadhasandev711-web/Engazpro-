import React from 'react';
import { useProductsPage } from '../../hooks/useProductsPage';
import { ProductsHeader } from '../components/products/ProductsHeader';
import { ProductsMobileHero } from '../components/products/ProductsMobileHero';
import { ProductsNotifications } from '../components/products/ProductsNotifications';
import { ProductsFilterChips } from '../components/products/ProductsFilterChips';
import { ProductsSearchBar } from '../components/products/ProductsSearchBar';
import { ProductsList } from '../components/products/ProductsList';
import { ProductFormModal } from '../components/products/ProductFormModal';
import { ProductsAddBatchModal } from '../components/products/ProductsAddBatchModal';
import { ProductsBarcodePrint } from '../components/products/ProductsBarcodePrint';
import { ProductsOpeningStock } from '../components/products/ProductsOpeningStock';

export const ProductsPage: React.FC = () => {
  const vm = useProductsPage();

  return (
    <div className="space-y-3 sm:space-y-6" dir="rtl">
      <ProductsHeader vm={vm} />
      <ProductsMobileHero vm={vm} />
      <ProductsNotifications vm={vm} />
      <ProductsFilterChips vm={vm} />
      <ProductsSearchBar vm={vm} />
      <ProductsList vm={vm} />
      <ProductFormModal vm={vm} />
      <ProductsAddBatchModal vm={vm} />
      <ProductsBarcodePrint vm={vm} />
      <ProductsOpeningStock vm={vm} />
    </div>
  );
};
