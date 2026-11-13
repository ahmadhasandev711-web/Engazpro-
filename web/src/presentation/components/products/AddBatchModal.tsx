import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Calendar, PlusCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../data/api/client';
import { Product } from '@pos-mandob/shared';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

interface AddBatchModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const AddBatchModal: React.FC<AddBatchModalProps> = ({
  product,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [productionDate, setProductionDate] = useState('');
  const [quantity, setQuantity] = useState<number | string>(10);
  const [purchasePrice, setPurchasePrice] = useState<number | string>('');
  const [salePrice, setSalePrice] = useState<number | string>('');
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (product) {
      setBatchNumber('LOT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(100 + Math.random() * 900));
      setExpiryDate('');
      setProductionDate('');
      setQuantity(10);
      setPurchasePrice(product.purchase_price ?? '');
      setSalePrice(product.sale_price ?? '');
      setError(null);
    }
  }, [product]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!product) return;
      return apiClient.post(`/products/${product.id}/batches`, {
        batch_number: batchNumber,
        expiry_date: expiryDate,
        production_date: productionDate || undefined,
        quantity: Number(quantity) || 0,
        purchase_price: purchasePrice !== '' ? Number(purchasePrice) : undefined,
        sale_price: salePrice !== '' ? Number(salePrice) : undefined,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onSuccess(res?.data?.message || 'تمت إضافة التشغيلة وتحديث رصيد المخزون بنجاح');
      onClose();
    },
    onError: (err: any) => {
      setError(err.response?.data?.message || 'تعذر إضافة التشغيلة، يرجى التأكد من صحة البيانات');
    },
  });

  if (!isOpen || !product) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchNumber.trim()) {
      setError('رقم التشغيلة مطلوب');
      return;
    }
    if (!expiryDate) {
      setError('تاريخ انتهاء الصلاحية مطلوب');
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in duration-200" dir="rtl">
      <div className="bg-panel rounded-3xl border border-line shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-line flex items-center justify-between bg-surface-2/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-ok-soft text-ok flex items-center justify-center font-black border border-ok/20">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-ink">توريد تشغيلة صلاحية جديدة</h3>
              <p className="text-xs text-muted font-medium truncate max-w-[240px]">{product.name}</p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={onClose}
            className="min-w-[44px] px-0 text-muted hover:text-ink"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-bad-soft border border-bad/25 rounded-xl text-xs font-bold text-bad flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="رقم التشغيلة (Batch Number) *"
            type="text"
            value={batchNumber}
            onChange={(e) => setBatchNumber(e.target.value)}
            className="bg-surface-2/50 tabular-nums"
            placeholder="مثال: LOT-2026-B1"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="تاريخ الانتهاء *"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="bg-surface-2/50 tabular-nums"
              required
            />

            <Input
              label="تاريخ الإنتاج (اختياري)"
              type="date"
              value={productionDate}
              onChange={(e) => setProductionDate(e.target.value)}
              className="bg-surface-2/50 tabular-nums"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="الكمية الموردة *"
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-surface-2/50 tabular-nums"
              required
            />

            <Input
              label="سعر الشراء"
              type="number"
              min="0"
              step="0.01"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              className="bg-surface-2/50 tabular-nums"
            />

            <Input
              label="سعر البيع"
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className="bg-surface-2/50 tabular-nums"
            />
          </div>

          <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={onClose}
              className="text-xs font-bold"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={mutation.isPending}
              isLoading={mutation.isPending}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="text-xs font-black"
            >
              {mutation.isPending ? 'جاري الحفظ...' : 'إضافة التشغيلة وتحديث المخزون'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
