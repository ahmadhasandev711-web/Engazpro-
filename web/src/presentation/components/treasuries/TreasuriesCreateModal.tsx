import React from 'react';
import { Plus, X } from 'lucide-react';
import type { TreasuriesViewModel } from './types';

export const TreasuriesCreateModal: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { createModalOpen, setCreateModalOpen, createData, setCreateData, branches, createTreasuryMutation } = vm;

  return (
    <>
      {/* Create Treasury / Bank Modal - Responsive Bottom Sheet */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto my-2.5 sm:hidden" />
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500/20 text-primary-400 rounded-xl border border-primary-500/30">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">إضافة خزينة أو حساب جديد</h3>
                  <p className="text-xs text-slate-400 mt-0.5">تسجيل بنك، محفظة إلكترونية، خزينة فرع، أو مسحوبات</p>
                </div>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createTreasuryMutation.mutate();
              }}
              className="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">نوع الخزينة / الحساب *</label>
                <select
                  required
                  value={createData.type}
                  onChange={(e) => setCreateData({ ...createData, type: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                >
                  <option value="BANK">حساب بنكي (بنك مصر، CIB، الأهلي...)</option>
                  <option value="WALLET">محفظة إلكترونية (فودافون كاش، إنستاباي...)</option>
                  <option value="BRANCH_SAFE">خزينة فرع رئيسية (Branch Safe)</option>
                  <option value="OWNER_DRAWINGS">جاري المالك / مسحوبات شخصية</option>
                  <option value="CASHIER_DRAWER">درج كاشير جديد</option>
                  <option value="MANDOB_CUSTODY">عهدة مندوب مبيعات</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">اسم الخزينة أو الحساب *</label>
                <input
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
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Branch Association */}
              {branches.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">الفرع المرتبط (اختياري):</label>
                  <select
                    value={createData.branch_id}
                    onChange={(e) => setCreateData({ ...createData, branch_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="">-- الإدارة المركزية / عام للشركة --</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">الرصيد الافتتاحي (ج.م):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={createData.opening_balance}
                  onChange={(e) => setCreateData({ ...createData, opening_balance: e.target.value })}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">ملاحظات / رقم الحساب أو الموبايل:</label>
                <textarea
                  rows={2}
                  value={createData.notes}
                  onChange={(e) => setCreateData({ ...createData, notes: e.target.value })}
                  placeholder="رقم الحساب البنكي، أو رقم المحفظة، أو تعليمات..."
                  className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={createTreasuryMutation.isPending || !createData.name.trim()}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white py-2.5 rounded-xl text-xs font-black shadow-sm transition-all disabled:opacity-50"
                >
                  {createTreasuryMutation.isPending ? 'جاري الإنشاء...' : 'حفظ الخزينة'}
                </button>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
