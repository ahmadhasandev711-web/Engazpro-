import React from 'react';
import { Truck, AlertCircle, X, Package, Check, Building2, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import type { WcOrdersViewModel } from './types';

export const WcOrderActionModals: React.FC<{ vm: WcOrdersViewModel }> = ({ vm }) => {
  const {
    selection,
    isManager,
    confirmModalOrder,
    setConfirmModalOrder,
    selectedBranchId,
    setSelectedBranchId,
    confirmError,
    setConfirmError,
    forceConfirm,
    setForceConfirm,
    dispatchModalOrder,
    setDispatchModalOrder,
    selectedMandobId,
    setSelectedMandobId,
    courierModalOrder,
    setCourierModalOrder,
    courierName,
    setCourierName,
    courierPartyId,
    setCourierPartyId,
    courierTrackingNumber,
    setCourierTrackingNumber,
    courierBranchId,
    setCourierBranchId,
    showAddCourier,
    setShowAddCourier,
    newCourierName,
    setNewCourierName,
    newCourierPhone,
    setNewCourierPhone,
    newCourierNotes,
    setNewCourierNotes,
    addCourierError,
    setAddCourierError,
    deliverModalOrder,
    setDeliverModalOrder,
    collectedAmount,
    setCollectedAmount,
    paymentMethod,
    setPaymentMethod,
    setFeedback,
    user,
    branches,
    mandobs,
    couriers,
    confirmMutation,
    dispatchMutation,
    courierDispatchMutation,
    handleCreateCourier,
    createCourierMutation,
    deliverMutation,
  } = vm;

  return (
    <>
      {/* Modal 1: Confirm Order Modal - Responsive Bottom Sheet */}
      {confirmModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-canvas/80 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-panel border border-line rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto text-right" dir="rtl">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-line rounded-full mx-auto mb-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-black text-sm text-ink tabular-nums">
                تأكيد الطلب #{confirmModalOrder.wc_order_id}
              </h3>
              <button
                type="button"
                onClick={() => setConfirmModalOrder(null)}
                className="p-1 text-muted hover:text-ink rounded-lg transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              اختر الفرع أو المخزن المسؤول عن تجهيز هذا الطلب. سيقوم النظام بالتحقق الآلي من توفر أرصدة المقاسات والألوان المطلوبة.
            </p>

            <div>
              <label className="block text-xs font-bold text-ink mb-1.5">فرع التجهيز والمخزون:</label>
              {isManager ? (
                <div className="p-3 bg-brand-soft border border-brand/20 rounded-xl text-xs font-bold text-brand-ink flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand shrink-0" />
                  <span>تجهيز وسحب من فرعك: {branches.find((b: any) => b.id === (user?.branch_id ?? selectedBranchId))?.name || 'فرعك المعين'}</span>
                </div>
              ) : (
                <Select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                  options={branches.map((b: any) => ({
                    value: b.id,
                    label: `${b.name} (${b.type || 'فرع'})`,
                  }))}
                  className="text-xs font-bold"
                />
              )}
            </div>

            {confirmError && (
              <div className="p-3 bg-bad-soft border border-bad/20 rounded-xl text-xs text-bad space-y-2">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>تنبيه المخزون بالفرع:</span>
                </div>
                <p className="whitespace-pre-line text-2xs leading-relaxed font-medium">
                  {confirmError}
                </p>
                <div className="pt-2 border-t border-bad/20 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={forceConfirm}
                      onChange={(e) => setForceConfirm(e.target.checked)}
                      className="rounded border-line text-brand focus:ring-brand cursor-pointer"
                    />
                    <span className="text-2xs font-bold">
                      تأكيد الطلب استثنائياً واستلام البضاعة لاحقاً
                    </span>
                  </label>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() =>
                  confirmMutation.mutate({
                    orderId: confirmModalOrder.id,
                    branchId: Number(selectedBranchId),
                    force: forceConfirm,
                  })
                }
                disabled={confirmMutation.isPending || !selectedBranchId}
                isLoading={confirmMutation.isPending}
                className="flex-1 min-h-[44px] font-black text-xs"
              >
                {forceConfirm ? '⚠️ تأكيد استثنائي مع نقص المخزون' : 'تأكيد وحجز المخزون'}
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => {
                  setConfirmModalOrder(null);
                  setConfirmError(null);
                  setForceConfirm(false);
                }}
                className="min-h-[44px] font-bold text-xs"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Dispatch to Mandob Modal - Responsive Bottom Sheet */}
      {dispatchModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-canvas/80 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-panel border border-line rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto text-right" dir="rtl">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-line rounded-full mx-auto mb-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-black text-sm text-ink tabular-nums">
                إسناد الطلب للمندوب #{dispatchModalOrder.wc_order_id}
              </h3>
              <button
                type="button"
                onClick={() => setDispatchModalOrder(null)}
                className="p-1 text-muted hover:text-ink rounded-lg transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              اختر المندوب المكلف بالتسليم. سيتم تحويل بضاعة الطلب إلى عهدة سيارة المندوب (VAN) لضمان انضباط المخزون في الطريق.
            </p>

            {mandobs.length === 0 ? (
              <div className="p-4 bg-warn-soft border border-warn/20 rounded-2xl text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-warn mx-auto" />
                <div className="text-xs font-bold text-warn">لا يوجد مناديب مسجلين حالياً في هذا الفرع</div>
                <p className="text-2xs text-muted leading-relaxed">
                  يرجى إضافة مندوب جديد وتعيين دوره (مندوب توصيل) من صفحة الموظفين أولاً لتتمكن من إسناد الطلبات إليه.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-ink">
                    اختر مندوب التوصيل المكلف:
                  </label>
                  <Badge tone="brand">
                    {mandobs.length} {mandobs.length === 1 ? 'مندوب متاح' : 'مناديب متاحين'}
                  </Badge>
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
                        className={cn(
                          'w-full p-3 rounded-2xl border text-right flex items-center justify-between transition-all cursor-pointer select-none active:scale-[0.99]',
                          isSelected
                            ? 'bg-brand-soft border-brand ring-2 ring-brand/20 shadow-xs'
                            : 'bg-surface-2 border-line hover:border-muted'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                              isSelected
                                ? 'bg-brand text-on-brand shadow-xs'
                                : 'bg-surface-3 text-muted'
                            )}
                          >
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-black text-xs text-ink">{m.name}</div>
                            <div className="text-2xs text-muted tabular-nums mt-0.5 flex items-center gap-1.5">
                              <span>{m.phone || 'بدون رقم هاتف'}</span>
                              {m.branch?.name && (
                                <span className="text-2xs text-muted">
                                  • {m.branch.name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 mr-2">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-brand text-on-brand flex items-center justify-center shadow-xs">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border-2 border-line bg-panel" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() =>
                  dispatchMutation.mutate({
                    orderId: dispatchModalOrder.id,
                    mandobId: Number(selectedMandobId),
                  })
                }
                disabled={dispatchMutation.isPending || !selectedMandobId}
                isLoading={dispatchMutation.isPending}
                className="flex-1 min-h-[44px] font-black text-xs"
              >
                تأكيد الشحن مع المندوب
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setDispatchModalOrder(null)}
                className="min-h-[44px] font-bold text-xs"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Deliver & Collect Modal - Responsive Bottom Sheet */}
      {deliverModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-canvas/80 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-panel border border-line rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto text-right" dir="rtl">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-line rounded-full mx-auto mb-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-black text-sm text-ink tabular-nums">
                تسليم وتحصيل الطلب #{deliverModalOrder.wc_order_id}
              </h3>
              <button
                type="button"
                onClick={() => setDeliverModalOrder(null)}
                className="p-1 text-muted hover:text-ink rounded-lg transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deliverModalOrder.courier_party_id ? (
              <div className="p-3 bg-info-soft rounded-2xl border border-info/20 text-xs text-info space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>شركة الشحن: {deliverModalOrder.courier_name || 'شركة شحن خارجية'}</span>
                </div>
                <p className="text-2xs leading-relaxed">
                  {deliverModalOrder.payment_status === 'PAID_ONLINE' || (deliverModalOrder.wc_payment_method && deliverModalOrder.wc_payment_method !== 'cod')
                    ? 'الطلب مسدد أونلاين مسبقاً، ومهمة شركة الشحن هي التوصيل فقط (المطلوب تحصيله 0 ج.م).'
                    : 'المبلغ المحصل سيُقيد كعهدة معلقة في كشف حساب شركة الشحن، ولن يدخل الخزينة إلا عند توريد الكاش بسند قبض.'}
                </p>
              </div>
            ) : (deliverModalOrder.payment_status === 'PAID_ONLINE' || (deliverModalOrder.wc_payment_method && deliverModalOrder.wc_payment_method !== 'cod')) ? (
              <div className="p-3 bg-ok-soft rounded-2xl border border-ok/20 text-xs text-ok space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>✓</span>
                  <span>الطلب مسدد مسبقاً بالكامل عبر المتجر أونلاين</span>
                </div>
                <p className="text-2xs leading-relaxed">
                  المبلغ المطلوب تحصيله نقداً هو 0.00 ج.م، وستصدر الفاتورة مسددة إلكترونياً دون تحميل عهدة المندوب أي نقدية.
                </p>
              </div>
            ) : null}

            <div className="space-y-3">
              <div>
                <Input
                  label="المبلغ المحصل فعلياً (ج.م):"
                  type="number"
                  step="0.01"
                  value={collectedAmount}
                  onChange={(e) => setCollectedAmount(Number(e.target.value))}
                  className="tabular-nums font-bold"
                />
              </div>

              <div>
                <Select
                  label="طريقة الدفع والتحصيل:"
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  options={[
                    ...(deliverModalOrder.courier_party_id
                      ? [{ value: 'COURIER_COD', label: 'تحصيل عبر شركة شحن (COD)' }]
                      : []),
                    { value: 'CASH', label: 'نقدية كاش (COD)' },
                    { value: 'CARD', label: 'بطاقة بنكية / فيزا' },
                    { value: 'INSTAPAY', label: 'تحويل إنستاباي (InstaPay)' },
                    { value: 'VODAFONE_CASH', label: 'محفظة إلكترونية / فودافون كاش' },
                    { value: 'TRANSFER', label: 'تحويل بنكي آخر' },
                  ]}
                  className="font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={() =>
                  deliverMutation.mutate({
                    orderId: deliverModalOrder.id,
                    amount: collectedAmount,
                    method: paymentMethod,
                  })
                }
                disabled={deliverMutation.isPending}
                isLoading={deliverMutation.isPending}
                className="flex-1 min-h-[44px] font-black text-xs"
              >
                إصدار الفاتورة وتأكيد التسليم
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setDeliverModalOrder(null)}
                className="min-h-[44px] font-bold text-xs"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Dispatch to Courier Modal - Responsive Bottom Sheet */}
      {courierModalOrder && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-canvas/80 p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-panel border border-line rounded-t-[2.5rem] sm:rounded-3xl p-5 sm:p-6 max-w-md w-full space-y-4 shadow-xl animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 max-h-[92vh] flex flex-col overflow-y-auto text-right" dir="rtl">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-line rounded-full mx-auto mb-1 sm:hidden shrink-0" />
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-black text-sm text-ink flex items-center gap-2 tabular-nums">
                <Package className="w-5 h-5 text-brand" />
                <span>إسناد الطلب لشركة شحن #{courierModalOrder.wc_order_id}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCourierModalOrder(null)}
                className="p-1 text-muted hover:text-ink rounded-lg transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              إسناد شحنة المتجر لشركة شحن خارجية (مثل بوسطة، أرامكس، مايلرز). يتم حجز رصيد البضاعة من المخزن المحدد وتوثيق رقم البوليصة لمتابعة التسليم وتصفية الكاش.
            </p>

            <div className="space-y-4">
              {/* Registered Courier Selection */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-ink">
                    شركة الشحن المسجلة بالدفاتر <span className="text-bad">*</span>
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
                      className="text-2xs font-bold text-brand hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إضافة شركة جديدة</span>
                    </button>
                  )}
                </div>

                {showAddCourier ? (
                  <div className="bg-brand-soft border border-brand/20 rounded-2xl p-3.5 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-brand-ink flex items-center gap-1.5">
                        <Truck className="w-3.5 h-3.5 text-brand" />
                        إضافة شركة شحن جديدة للدفاتر (بوسطة / أرامكس / مايلرز)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddCourier(false)}
                        className="text-muted hover:text-ink p-0.5 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        label="اسم شركة الشحن *"
                        value={newCourierName}
                        onChange={(e) => setNewCourierName(e.target.value)}
                        placeholder="مثال: بوسطة (Bosta) / أرامكس"
                      />
                      <Input
                        label="رقم الهاتف للتواصل"
                        value={newCourierPhone}
                        onChange={(e) => setNewCourierPhone(e.target.value)}
                        placeholder="مثال: 01012345678"
                        className="tabular-nums"
                      />
                    </div>
                    <div>
                      <Input
                        label="ملاحظات الحساب (اختياري)"
                        value={newCourierNotes}
                        onChange={(e) => setNewCourierNotes(e.target.value)}
                        placeholder="مثال: تحصيل أسبوعي / تغطية كافة المحافظات"
                      />
                    </div>
                    {addCourierError && (
                      <p className="text-2xs font-bold text-bad bg-bad-soft p-1.5 rounded-lg border border-bad/20">
                        {addCourierError}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAddCourier(false)}
                      >
                        إلغاء
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={createCourierMutation.isPending || !newCourierName.trim()}
                        isLoading={createCourierMutation.isPending}
                        onClick={handleCreateCourier}
                      >
                        حفظ واختيار الشركة
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Select
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
                      options={[
                        { value: '', label: '-- اختر شركة الشحن المسجلة بالدفاتر * --' },
                        ...couriers.map((c: any) => ({
                          value: c.id,
                          label: `${c.name} ${c.phone ? `(${c.phone})` : ''}`,
                        })),
                      ]}
                      error={!courierPartyId ? 'يرجى اختيار شركة شحن' : undefined}
                      className="font-bold"
                    />

                    {couriers.length === 0 && (
                      <p className="text-2xs text-warn bg-warn-soft border border-warn/20 p-2.5 rounded-xl mt-2 font-bold leading-relaxed">
                        ⚠️ لا توجد شركات شحن مسجلة بالدفاتر حالياً. يرجى الضغط على <strong>"+ إضافة شركة جديدة"</strong> أعلاه لتسجيل شركة الشحن (مثل بوسطة أو أرامكس) لضمان توثيق كشف الحساب والمديونية المحاسبية.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Tracking Number / AWB */}
              <div>
                <Input
                  label="رقم بوليصة الشحن (Tracking Number / AWB):"
                  type="text"
                  value={courierTrackingNumber}
                  onChange={(e) => setCourierTrackingNumber(e.target.value)}
                  placeholder="رقم البوليصة إن وُجد (اختياري)"
                  className="tabular-nums font-bold"
                />
              </div>

              {/* Source Branch */}
              <div>
                <Select
                  label="مخزن خروج الشحنة:"
                  value={courierBranchId}
                  onChange={(e) => setCourierBranchId(e.target.value ? Number(e.target.value) : '')}
                  options={branches.map((b: any) => ({
                    value: b.id,
                    label: `${b.name} (${b.type || 'فرع'})`,
                  }))}
                  className="font-bold"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="primary"
                size="lg"
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
                isLoading={courierDispatchMutation.isPending}
                className="flex-1 min-h-[44px] font-black text-xs"
              >
                تأكيد الإسناد لشركة الشحن
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setCourierModalOrder(null)}
                className="min-h-[44px] font-bold text-xs"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
