import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { User } from '@pos-mandob/shared';
import { Button, Input, Select } from '../ui';

interface ExtendSubscriptionModalProps {
  user: User;
  onClose: () => void;
  onExtend: (payload: { userId: number; days: number; notes: string; price?: number | null }) => void;
  isPending: boolean;
}

const DURATION_OPTIONS = [
  { value: 365, label: 'سنة كاملة (+365 يوم)' },
  { value: 30, label: 'شهر واحد (+30 يوم)' },
  { value: 90, label: '3 شهور (+90 يوم)' },
  { value: 180, label: '6 شهور (+180 يوم)' },
  { value: 730, label: 'سنتين (+730 يوم)' },
];

export const ExtendSubscriptionModal: React.FC<ExtendSubscriptionModalProps> = ({
  user,
  onClose,
  onExtend,
  isPending,
}) => {
  const [extendDays, setExtendDays] = useState<number>(365);
  const [extendPrice, setExtendPrice] = useState<string>('');
  const [extendNotes, setExtendNotes] = useState<string>('تمديد استثنائي من الإدارة العامة');

  return (
    <div
      className="fixed inset-0 bg-canvas/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      dir="rtl"
    >
      <div className="bg-panel rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-line space-y-5">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h3 className="text-lg font-black text-ink">تمديد اشتراك مباشر</h3>
            <p className="text-xs text-muted font-medium mt-0.5">
              المتجر: <strong className="text-ink">{user.name}</strong> ({user.phone})
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="إغلاق" className="min-h-[44px] min-w-[44px]">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <Select
            label="اختر مدة التمديد الإضافية"
            value={extendDays}
            onChange={(e) => setExtendDays(Number(e.target.value))}
            options={DURATION_OPTIONS}
          />

          <Input
            label="قيمة التحصيل (ج.م - اختياري)"
            type="number"
            min="0"
            step="0.01"
            value={extendPrice}
            onChange={(e) => setExtendPrice(e.target.value)}
            placeholder="اتركه فارغاً لعدم تعديل السعر"
          />

          <Input
            label="ملاحظة التمديد الإداري"
            type="text"
            value={extendNotes}
            onChange={(e) => setExtendNotes(e.target.value)}
            placeholder="سبب التمديد..."
          />
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-line">
          <Button
            className="flex-1"
            variant="primary"
            isLoading={isPending}
            leftIcon={<Check className="w-4 h-4" />}
            onClick={() =>
              onExtend({
                userId: user.id,
                days: extendDays,
                notes: extendNotes,
                price: extendPrice.trim() !== '' ? Number(extendPrice) : null,
              })
            }
          >
            تأكيد التمديد الفوري
          </Button>
          <Button variant="secondary" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      </div>
    </div>
  );
};
