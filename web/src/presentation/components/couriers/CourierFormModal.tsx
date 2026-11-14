import React from 'react';
import { Truck, X } from 'lucide-react';
import { Button, Input } from '../ui';

export interface CourierFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  courierName: string;
  onNameChange: (value: string) => void;
  courierPhone: string;
  onPhoneChange: (value: string) => void;
  courierPhone2: string;
  onPhone2Change: (value: string) => void;
  courierAddress: string;
  onAddressChange: (value: string) => void;
  courierNotes: string;
  onNotesChange: (value: string) => void;
  initialBalance: number;
  onInitialBalanceChange: (value: number) => void;
  error: string | null;
  isPending: boolean;
  onSubmit: () => void;
  onClose: () => void;
}

export const CourierFormModal: React.FC<CourierFormModalProps> = ({
  isOpen,
  isEditing,
  courierName,
  onNameChange,
  courierPhone,
  onPhoneChange,
  courierPhone2,
  onPhone2Change,
  courierAddress,
  onAddressChange,
  courierNotes,
  onNotesChange,
  initialBalance,
  onInitialBalanceChange,
  error,
  isPending,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-panel rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-line p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="font-black text-sm text-ink flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand" />
            <span>{isEditing ? 'تعديل شركة شحن' : 'إضافة شركة شحن جديدة للدفاتر'}</span>
          </h3>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="إغلاق" className="p-2">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-3">
          <Input
            label="اسم شركة الشحن / المندوب *"
            type="text"
            value={courierName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="مثال: شركة بوسطة / شركة طيارة / مندوب المحلة"
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="الهاتف الأساسي"
              type="text"
              value={courierPhone}
              onChange={(e) => onPhoneChange(e.target.value)}
              placeholder="01012345678"
              className="tabular-nums"
              dir="ltr"
            />
            <Input
              label="هاتف إضافي"
              type="text"
              value={courierPhone2}
              onChange={(e) => onPhone2Change(e.target.value)}
              placeholder="اختياري"
              className="tabular-nums"
              dir="ltr"
            />
          </div>

          <Input
            label="العنوان أو مناطق التغطية"
            type="text"
            value={courierAddress}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="مثال: القاهرة والجيزة / طنطا والمحافظات"
          />

          <Input
            label="ملاحظات الحساب أو الاتفاق"
            type="text"
            value={courierNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="مثال: تصفية كاش كل يوم خميس / سعر البوليصة 45 ج"
          />

          {!isEditing && (
            <Input
              label="الرصيد الافتتاحي (إن وُجد)"
              type="number"
              step="0.01"
              value={initialBalance}
              onChange={(e) => onInitialBalanceChange(Number(e.target.value))}
              placeholder="0.00"
              className="tabular-nums font-bold"
            />
          )}
        </div>

        {error && (
          <p className="text-xs text-bad bg-bad-soft p-2.5 rounded-xl border border-bad/30 font-bold">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" size="md" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isPending}
            disabled={isPending || !courierName.trim()}
            onClick={onSubmit}
          >
            {isEditing ? 'حفظ التعديلات' : 'إضافة الشركة'}
          </Button>
        </div>
      </div>
    </div>
  );
};
