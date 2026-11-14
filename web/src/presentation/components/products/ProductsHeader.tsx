import React from 'react';
import { Plus, Download, Upload, Boxes } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../ui/PageHeader';
import { Button } from '../ui/Button';
import type { ProductsViewModel } from './types';

export const ProductsHeader: React.FC<{ vm: ProductsViewModel }> = ({ vm }) => {
  const { setIsOpeningStockOpen, isMandob, canAddProduct, canImportProducts, navigate, products, openCreateModal } = vm;
  const toast = useToast();

  return (
    <PageHeader
      className="hidden md:flex mb-0"
      title={isMandob ? 'الأصناف والأسعار' : 'الأصناف والمخزون المتقدم'}
      description={
        isMandob
          ? 'استعراض المنتجات، أسعار البيع، والكميات المتوفرة بالمخزن'
          : 'إدارة المنتجات، المقاسات والألوان، تواريخ الصلاحية، والوحدات المتعددة'
      }
      actions={
        <>
          <Button
            variant="secondary"
            size="md"
            onClick={async () => {
              try {
                const { exportProductsToExcel } = await import('../../utils/excelExport');
                exportProductsToExcel(products);
              } catch (err) {
                console.error('Excel load failed:', err);
                toast.error('تعذر تحميل أداة Excel، تأكد من الاتصال وحاول مرة أخرى');
              }
            }}
            disabled={products.length === 0}
            leftIcon={<Download className="w-4 h-4 text-ok" />}
            title="تصدير الأصناف والمخزون الحالي إلى Excel"
            className="text-xs font-bold"
          >
            تصدير Excel
          </Button>
          {canImportProducts && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => navigate('/excel')}
              leftIcon={<Upload className="w-4 h-4 text-brand" />}
              title="استيراد أصناف من ملف Excel"
              className="text-xs font-bold"
            >
              استيراد Excel
            </Button>
          )}
          {canAddProduct && (
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsOpeningStockOpen(true)}
              leftIcon={<Boxes className="w-4 h-4 text-brand" />}
              title="إدخال رصيد أول المدة للأصناف والمتغيرات بدون فواتير"
              className="text-xs font-bold"
            >
              رصيد أول المدة
            </Button>
          )}
          {canAddProduct && (
            <Button
              variant="primary"
              size="md"
              onClick={openCreateModal}
              leftIcon={<Plus className="w-4 h-4" />}
              className="font-bold"
            >
              إضافة صنف جديد
            </Button>
          )}
        </>
      }
    />
  );
};
