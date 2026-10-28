import React from 'react';
import { Truck, AlertCircle, X, RefreshCw, Package, Check, Building2, Plus } from 'lucide-react';
import type { WcOrdersViewModel } from './types';

export const WcOrderActionModals: React.FC<{ vm: WcOrdersViewModel }> = ({ vm }) => {
  const { selection, isManager, confirmModalOrder, setConfirmModalOrder, selectedBranchId, setSelectedBranchId, confirmError, setConfirmError, forceConfirm, setForceConfirm, dispatchModalOrder, setDispatchModalOrder, selectedMandobId, setSelectedMandobId, courierModalOrder, setCourierModalOrder, courierName, setCourierName, courierPartyId, setCourierPartyId, courierTrackingNumber, setCourierTrackingNumber, courierBranchId, setCourierBranchId, showAddCourier, setShowAddCourier, newCourierName, setNewCourierName, newCourierPhone, setNewCourierPhone, newCourierNotes, setNewCourierNotes, addCourierError, setAddCourierError, deliverModalOrder, setDeliverModalOrder, collectedAmount, setCollectedAmount, paymentMethod, setPaymentMethod, setFeedback, user, branches, mandobs, couriers, confirmMutation, dispatchMutation, courierDispatchMutation, handleCreateCourier, createCourierMutation, deliverMutation } = vm;

  return (
    <>
      {/* Modal 1: Confirm Order Modal - Responsive Bottom Sheet */}
      {confirmModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900">
                تأكيد الطلب #{confirmModalOrder.wc_order_id}
              </h3>
              <button
                onClick={() => setConfirmModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              اختر الفرع أو المخزن المسؤول عن تجهيز هذا الطلب. سيقوم النظام بالتحقق الآلي من توفر أرصدة المقاسات والألوان المطلوبة.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">فرع التجهيز والمخزون:</label>
              {isManager ? (
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs font-bold text-purple-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>تجهيز وسحب من فرعك: {branches.find((b: any) => b.id === (user?.branch_id ?? selectedBranchId))?.name || 'فرعك المعين'}</span>
                </div>
              ) : (
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.type})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {confirmError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>تنبيه المخزون بالفرع:</span>
                </div>
                <p className="whitespace-pre-line text-[11px] leading-relaxed font-medium text-rose-800">
                  {confirmError}
                </p>
                <div className="pt-2 border-t border-rose-200/60 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={forceConfirm}
                      onChange={(e) => setForceConfirm(e.target.checked)}
                      className="rounded border-rose-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-bold text-rose-950">
                      تأكيد الطلب استثنائياً واستلام البضاعة لاحقاً
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() =>
                  confirmMutation.mutate({
                    orderId: confirmModalOrder.id,
                    branchId: Number(selectedBranchId),
                    force: forceConfirm,
                  })
                }
                disabled={confirmMutation.isPending || !selectedBranchId}
                className="flex-1 py-2.5 bg-primary-600 text-slate-950 font-black rounded-xl text-xs hover:bg-primary-500 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {confirmMutation.isPending
                  ? 'جاري الفحص والتأكيد...'
                  : forceConfirm
                  ? '⚠️ تأكيد استثنائي مع نقص المخزون'
                  : 'تأكيد وحجز المخزون'}
              </button>
              <button
                onClick={() => {
                  setConfirmModalOrder(null);
                  setConfirmError(null);
                  setForceConfirm(false);
                }}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Dispatch to Mandob Modal - Responsive Bottom Sheet */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900">
                إسناد الطلب للمندوب #{dispatchModalOrder.wc_order_id}
              </h3>
              <button
                onClick={() => setDispatchModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              اختر المندوب المكلف بالتسليم. سيتم تحويل بضاعة الطلب إلى عهدة سيارة المندوب (VAN) لضمان انضباط المخزون في الطريق.
            </p>

            {mandobs.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-600 mx-auto" />
                <div className="text-xs font-bold text-amber-900">لا يوجد مناديب مسجلين حالياً في هذا الفرع</div>
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  يرجى إضافة مندوب جديد وتعيين دوره (مندوب توصيل) من صفحة الموظفين أولاً لتتمكن من إسناد الطلبات إليه.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    اختر مندوب التوصيل المكلف:
                  </label>
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded-full border border-indigo-200">
                    {mandobs.length} {mandobs.length === 1 ? 'مندوب متاح' : 'مناديب متاحين'}
                  </span>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5" style={{ touchAction: 'pan-y' }}>
                  {mandobs.map((m: any) => {
                    const isSelected = Number(selectedMandobId) === Number(m.id);
                    return (
                      <div
                        key={m.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          selection();
                          setSelectedMandobId(m.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            selection();
                            setSelectedMandobId(m.id);
                          }
                        }}
                        className={`w-full p-3 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer select-none active:scale-[0.99] ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-black text-xs text-slate-900">{m.name}</div>
                            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex items-center gap-1.5">
                              <span>{m.phone || 'بدون رقم هاتف'}</span>
                              {m.branch?.name && (
                                <span className="text-[10px] text-slate-400 font-sans">
                                  • {m.branch.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 mr-2">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-slate-300 bg-white" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() =>
                  dispatchMutation.mutate({
                    orderId: dispatchModalOrder.id,
                    mandobId: Number(selectedMandobId),
                  })
                }
                disabled={dispatchMutation.isPending || !selectedMandobId}
                className="flex-1 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-xs hover:bg-indigo-700 shadow-xs"
              >
                {dispatchMutation.isPending ? 'جاري التحويل والشحن...' : 'تأكيد الشحن مع المندوب'}
              </button>
              <button
                onClick={() => setDispatchModalOrder(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Deliver & Collect Modal - Responsive Bottom Sheet */}
      {deliverModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900">
                تسليم وتحصيل الطلب #{deliverModalOrder.wc_order_id}
              </h3>
              <button
                onClick={() => setDeliverModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deliverModalOrder.courier_party_id ? (
              <div className="p-3 bg-sky-50 rounded-2xl border border-sky-200 text-xs text-sky-800 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>شركة الشحن: {deliverModalOrder.courier_name || 'شركة شحن خارجية'}</span>
                </div>
                <p className="text-[11px] text-sky-700">
                  {deliverModalOrder.payment_status === 'PAID_ONLINE' || (deliverModalOrder.wc_payment_method && deliverModalOrder.wc_payment_method !== 'cod')
                    ? 'الطلب مسدد أونلاين مسبقاً، ومهمة شركة الشحن هي التوصيل فقط (المطلوب تحصيله 0 ج.م).'
                    : 'المبلغ المحصل سيُقيد كعهدة معلقة في كشف حساب شركة الشحن، ولن يدخل الخزينة إلا عند توريد الكاش بسند قبض.'}
                </p>
              </div>
            ) : (deliverModalOrder.payment_status === 'PAID_ONLINE' || (deliverModalOrder.wc_payment_method && deliverModalOrder.wc_payment_method !== 'cod')) ? (
              <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>✓</span>
                  <span>الطلب مسدد مسبقاً بالكامل عبر المتجر أونلاين</span>
                </div>
                <p className="text-[11px] text-emerald-700">
                  المبلغ المطلوب تحصيله نقداً هو 0.00 ج.م، وستصدر الفاتورة مسددة إلكترونياً دون تحميل عهدة المندوب أي نقدية.
                </p>
              </div>
            ) : null}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ المحصل فعلياً (ج.م):</label>
                <input
                  type="number"
                  step="0.01"
                  value={collectedAmount}
                  onChange={(e) => setCollectedAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الدفع والتحصيل:</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  {deliverModalOrder.courier_party_id && (
                    <option value="COURIER_COD">تحصيل عبر شركة شحن (COD)</option>
                  )}
                  <option value="CASH">نقدية كاش (COD)</option>
                  <option value="CARD">بطاقة بنكية / فيزا</option>
                  <option value="INSTAPAY">تحويل إنستاباي (InstaPay)</option>
                  <option value="VODAFONE_CASH">محفظة إلكترونية / فودافون كاش</option>
                  <option value="TRANSFER">تحويل بنكي آخر</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() =>
                  deliverMutation.mutate({
                    orderId: deliverModalOrder.id,
                    amount: collectedAmount,
                    method: paymentMethod,
                  })
                }
                disabled={deliverMutation.isPending}
                className="flex-1 py-2.5 bg-emerald-600 text-white font-black rounded-xl text-xs hover:bg-emerald-700 shadow-xs"
              >
                {deliverMutation.isPending ? 'جاري إصدار الفاتورة...' : 'إصدار الفاتورة وتأكيد التسليم'}
              </button>
              <button
                onClick={() => setDeliverModalOrder(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Dispatch to Courier Modal - Responsive Bottom Sheet */}
      {courierModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-2xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1 sm:hidden" />
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-purple-600" />
                <span>إسناد الطلب لشركة شحن #{courierModalOrder.wc_order_id}</span>
              </h3>
              <button
                onClick={() => setCourierModalOrder(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              إسناد شحنة المتجر لشركة شحن خارجية (مثل بوسطة، أرامكس، مايلرز). يتم حجز رصيد البضاعة من المخزن المحدد وتوثيق رقم البوليصة لمتابعة التسليم وتصفية الكاش.
            </p>

            <div className="space-y-4">
              {/* Registered Courier Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    شركة الشحن المسجلة بالدفاتر <span className="text-red-500">*</span>
                  </label>
                  {!showAddCourier && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddCourier(true);
                        setNewCourierName('');
                        setNewCourierPhone('');
                        setNewCourierNotes('');
                        setAddCourierError(null);
                      }}
                      className="text-[11px] font-bold text-purple-600 hover:text-purple-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إضافة شركة جديدة</span>
                    </button>
                  )}
                </div>

                {showAddCourier ? (
                  <div className="bg-purple-50/80 border border-purple-200 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-purple-600" />
                        إضافة شركة شحن جديدة للدفاتر (بوسطة / أرامكس / مايلرز)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddCourier(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم شركة الشحن *</label>
                        <input
                          type="text"
                          value={newCourierName}
                          onChange={(e) => setNewCourierName(e.target.value)}
                          placeholder="مثال: بوسطة (Bosta) / أرامكس"
                          className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-bold focus:outline-none focus:border-purple-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم الهاتف للتواصل</label>
                        <input
                          type="text"
                          value={newCourierPhone}
                          onChange={(e) => setNewCourierPhone(e.target.value)}
                          placeholder="مثال: 01012345678"
                          className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs font-bold focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات الحساب (اختياري)</label>
                      <input
                        type="text"
                        value={newCourierNotes}
                        onChange={(e) => setNewCourierNotes(e.target.value)}
                        placeholder="مثال: تحصيل أسبوعي / تغطية كافة المحافظات"
                        className="w-full px-2.5 py-1.5 bg-white border border-purple-200 rounded-lg text-xs focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    {addCourierError && (
                      <p className="text-[11px] font-bold text-red-600 bg-red-50 p-1.5 rounded-lg border border-red-200">{addCourierError}</p>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowAddCourier(false)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-white rounded-lg cursor-pointer"
                      >
                        إلغاء
                      </button>
                      <button
                        type="button"
                        disabled={createCourierMutation.isPending || !newCourierName.trim()}
                        onClick={handleCreateCourier}
                        className="px-3.5 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                      >
                        {createCourierMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                        <span>حفظ واختيار الشركة</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <select
                      value={courierPartyId}
                      onChange={(e) => {
                        const val = e.target.value ? Number(e.target.value) : '';
                        setCourierPartyId(val);
                        if (val) {
                          const found = couriers.find((c: any) => c.id === val);
                          if (found) setCourierName(found.name);
                        } else {
                          setCourierName('');
                        }
                      }}
                      className={`w-full px-3 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold transition-all ${
                        !courierPartyId ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 focus:border-purple-500'
                      }`}
                    >
                      <option value="">-- اختر شركة الشحن المسجلة بالدفاتر * --</option>
                      {couriers.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                    </select>

                    {couriers.length === 0 && (
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-xl mt-2 font-bold leading-relaxed">
                        ⚠️ لا توجد شركات شحن مسجلة بالدفاتر حالياً. يرجى الضغط على <strong>"+ إضافة شركة جديدة"</strong> أعلاه لتسجيل شركة الشحن (مثل بوسطة أو أرامكس) لضمان توثيق كشف الحساب والمديونية المحاسبية.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Tracking Number / AWB */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم بوليصة الشحن (Tracking Number / AWB):
                </label>
                <input
                  type="text"
                  value={courierTrackingNumber}
                  onChange={(e) => setCourierTrackingNumber(e.target.value)}
                  placeholder="رقم البوليصة إن وُجد (اختياري)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold"
                />
              </div>

              {/* Source Branch */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مخزن خروج الشحنة:</label>
                <select
                  value={courierBranchId}
                  onChange={(e) => setCourierBranchId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                >
                  {branches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => {
                  if (!courierPartyId) {
                    setFeedback({ type: 'error', message: 'يرجى اختيار شركة شحن مسجلة بالدفاتر أولاً لإسناد الشحنة' });
                    return;
                  }
                  courierDispatchMutation.mutate({
                    orderId: courierModalOrder.id,
                    courierName,
                    courierPartyId: Number(courierPartyId),
                    trackingNumber: courierTrackingNumber || undefined,
                    branchId: courierBranchId ? Number(courierBranchId) : undefined,
                  });
                }}
                disabled={courierDispatchMutation.isPending || !courierPartyId}
                className="flex-1 py-2.5 bg-purple-600 text-white font-black rounded-xl text-xs hover:bg-purple-700 shadow-xs cursor-pointer disabled:opacity-50"
              >
                {courierDispatchMutation.isPending ? 'جاري الإسناد والتحديث...' : 'تأكيد الإسناد لشركة الشحن'}
              </button>
              <button
                onClick={() => setCourierModalOrder(null)}
                className="px-4 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl text-xs hover:bg-slate-200 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
