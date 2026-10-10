import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Calendar, PlusCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '../../../data/api/client';
import { Product } from '@pos-mandob/shared';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">توريد تشغيلة صلاحية جديدة</h3>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[240px]">{product.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">رقم التشغيلة (Batch Number) *</label>
            <input
              type="text"
              value={batchNumber}
              onChange={(e) => setBatchNumber(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="مثال: LOT-2026-B1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الانتهاء *</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الإنتاج (اختياري)</label>
              <input
                type="date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الكمية الموردة *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سعر الشراء</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سعر البيع</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{mutation.isPending ? 'جاري الحفظ...' : 'إضافة التشغيلة وتحديث المخزون'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
