import React from 'react';
import { Plus, X } from 'lucide-react';
import type { TreasuriesViewModel } from './types';
import { Button, Input, Select, Textarea } from '../ui';

export const TreasuriesCreateModal: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { createModalOpen, setCreateModalOpen, createData, setCreateData, branches, createTreasuryMutation } = vm;

  return (
    <>
      {/* Create Treasury / Bank Modal - Responsive Bottom Sheet */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-panel rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-line animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-line rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-5 bg-surface border-b border-line text-ink flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-soft text-brand rounded-xl border border-brand/20">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-ink">إضافة خزينة أو حساب جديد</h3>
                  <p className="text-xs text-muted mt-0.5">تسجيل بنك، محفظة إلكترونية، خزينة فرع، أو مسحوبات</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-ink rounded-xl hover:bg-surface-2 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTreasuryMutation.mutate();
              }}
              className="p-6 space-y-4 overflow-y-auto"
            >
              <Select
                label="نوع الخزينة / الحساب *"
                required
                value={createData.type}
                onChange={(e) => setCreateData({ ...createData, type: e.target.value })}
                className="text-xs font-bold"
              >
                <option value="BANK">حساب بنكي (بنك مصر، CIB، الأهلي...)</option>
                <option value="WALLET">محفظة إلكترونية (فودافون كاش، إنستاباي...)</option>
                <option value="BRANCH_SAFE">خزينة فرع رئيسية (Branch Safe)</option>
                <option value="OWNER_DRAWINGS">جاري المالك / مسحوبات شخصية</option>
                <option value="CASHIER_DRAWER">درج كاشير جديد</option>
                <option value="MANDOB_CUSTODY">عهدة مندوب مبيعات</option>
              </Select>

              <Input
                label="اسم الخزينة أو الحساب *"
                type="text"
                required
                value={createData.name}
                onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                placeholder={
                  createData.type === 'BANK'
                    ? 'مثال: حساب البنك الأهلي المصري'
                    : createData.type === 'WALLET'
                    ? 'مثال: محفظة فودافون كاش (010...)'
                    : createData.type === 'BRANCH_SAFE'
                    ? 'مثال: خزينة فرع المعادي'
                    : createData.type === 'OWNER_DRAWINGS'
                    ? 'مثال: جاري المالك أحمد'
                    : 'اسم الخزينة...'
                }
                className="text-xs font-bold"
              />

              {/* Branch Association */}
              {branches.length > 0 && (
                <Select
                  label="الفرع المرتبط (اختياري):"
                  value={createData.branch_id}
                  onChange={(e) => setCreateData({ ...createData, branch_id: e.target.value })}
                  className="text-xs font-bold"
                >
                  <option value="">-- الإدارة المركزية / عام للشركة --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              )}

              <Input
                label="الرصيد الافتتاحي (ج.م):"
                type="number"
                step="0.01"
                min="0"
                value={createData.opening_balance}
                onChange={(e) => setCreateData({ ...createData, opening_balance: e.target.value })}
                className="font-bold tabular-nums"
              />

              <Textarea
                label="ملاحظات / رقم الحساب أو الموبايل:"
                rows={2}
                value={createData.notes}
                onChange={(e) => setCreateData({ ...createData, notes: e.target.value })}
                placeholder="رقم الحساب البنكي، أو رقم المحفظة، أو تعليمات..."
                className="text-xs"
              />

              <div className="pt-2 flex items-center gap-3">
                <Button
                  type="submit"
                  variant="primary"
                  isLoading={createTreasuryMutation.isPending}
                  disabled={!createData.name.trim()}
                  className="flex-1 text-xs font-black"
                >
                  {createTreasuryMutation.isPending ? 'جاري الإنشاء...' : 'حفظ الخزينة'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCreateModalOpen(false)}
                  className="text-xs font-bold"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
