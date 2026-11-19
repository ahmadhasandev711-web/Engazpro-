import React from 'react';
import { ArrowLeftRight, Plus, Send, Trash2, X } from 'lucide-react';
import { fetchProductSelectOptions } from '../../../data/api/asyncOptionLoaders';
import { AsyncSearchSelect, Button, Input, Select, Textarea } from '../ui';

interface TransferFormItem {
  product_id: string;
  product_variant_id: string;
  quantity_sent: number;
  selected_product?: any;
}

interface TransferFormState {
  from_branch_id: string;
  to_branch_id: string;
  notes: string;
  items: TransferFormItem[];
}

interface CreateStockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number | null;
  branches: any[];
  formData: TransferFormState;
  setFormData: React.Dispatch<React.SetStateAction<TransferFormState>>;
  hasGlobalBranchAccess: boolean;
  lockedBranchId?: number | null;
  isSubmitting: boolean;
  onAddItem: () => void;
  onRemoveItem: (idx: number) => void;
  onItemChange: (idx: number, field: string, value: any) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const CreateStockTransferModal: React.FC<CreateStockTransferModalProps> = ({
  isOpen,
  onClose,
  userId,
  branches,
  formData,
  setFormData,
  hasGlobalBranchAccess,
  lockedBranchId,
  isSubmitting,
  onAddItem,
  onRemoveItem,
  onItemChange,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-panel border border-line w-full sm:max-w-2xl rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="w-12 h-1.5 bg-line-2 rounded-full mx-auto my-2.5 sm:hidden" />
        <div className="p-5 bg-surface-2 border-b border-line flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-brand-ink" />
            <h2 className="font-bold text-ink text-lg">إذن تحويل بضاعة بين الفروع</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="فرع المصدر (يتم الخصم منه) *"
              required
              disabled={!hasGlobalBranchAccess && Boolean(lockedBranchId)}
              value={formData.from_branch_id}
              onChange={(e) => setFormData({ ...formData, from_branch_id: e.target.value })}
            >
              <option value="">-- اختر فرع المصدر --</option>
              {branches.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </Select>

            <Select
              label="فرع الوجهة (المستقبل) *"
              required
              value={formData.to_branch_id}
              onChange={(e) => setFormData({ ...formData, to_branch_id: e.target.value })}
            >
              <option value="">-- اختر فرع الوجهة --</option>
              {branches
                .filter((b: any) => String(b.id) !== formData.from_branch_id)
                .map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
            </Select>
          </div>

          <div className="pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-ink">الأصناف والكميات المحولة *</label>
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={onAddItem}
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                className="text-xs font-semibold text-brand-ink"
              >
                إضافة صنف آخر
              </Button>
            </div>

            <div className="space-y-3">
              {formData.items.map((item, idx) => {
                const selectedProd = item.selected_product;
                const hasVariants = selectedProd?.variants && selectedProd.variants.length > 0;

                return (
                  <div key={idx} className="p-3 bg-surface-2 border border-line rounded-xl flex flex-col sm:flex-row items-center gap-2">
                    <div className="flex-1 w-full">
                      <AsyncSearchSelect
                        required
                        placeholder="-- اختر الصنف --"
                        searchPlaceholder="ابحث باسم الصنف أو الكود..."
                        value={item.product_id}
                        selectedOption={
                          selectedProd
                            ? {
                                value: String(selectedProd.id),
                                label: selectedProd.code
                                  ? `${selectedProd.name} (${selectedProd.code})`
                                  : selectedProd.name,
                                raw: selectedProd,
                              }
                            : null
                        }
                        queryKeyPrefix={['transfer-products', userId ?? 'anon', formData.from_branch_id || 'all']}
                        loadOptions={(term) =>
                          fetchProductSelectOptions(term, formData.from_branch_id || null)
                        }
                        onChange={(opt) => {
                          const newItems = [...formData.items];
                          newItems[idx] = {
                            ...newItems[idx],
                            product_id: opt ? String(opt.value) : '',
                            product_variant_id: '',
                            selected_product: opt?.raw || null,
                          };
                          setFormData({ ...formData, items: newItems });
                        }}
                      />
                    </div>

                    {hasVariants && (
                      <div className="w-full sm:w-48">
                        <Select
                          required
                          value={item.product_variant_id}
                          onChange={(e) => onItemChange(idx, 'product_variant_id', e.target.value)}
                          className="text-brand-ink font-medium"
                        >
                          <option value="">-- اختر المقاس / اللون --</option>
                          {selectedProd.variants.map((v: any) => (
                            <option key={v.id} value={v.id}>
                              {v.name} (مقاس: {v.size || '-'} | لون: {v.color || '-'})
                            </option>
                          ))}
                        </Select>
                      </div>
                    )}

                    <div className="w-full sm:w-28">
                      <Input
                        type="number"
                        min="0.1"
                        step="any"
                        required
                        placeholder="الكمية"
                        value={item.quantity_sent}
                        onChange={(e) => onItemChange(idx, 'quantity_sent', Number(e.target.value))}
                        className="text-center font-bold tabular-nums"
                      />
                    </div>

                    {formData.items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={() => onRemoveItem(idx)}
                        className="min-w-[44px] px-2.5 text-muted hover:text-bad hover:bg-bad-soft"
                        aria-label="حذف الصنف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Textarea
            label="ملاحظات التحويل (اختياري)"
            rows={2}
            placeholder="أي تفاصيل أو رقم مرجعي للشحن والتسليم..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="resize-none"
          />

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-line">
            <Button type="button" variant="ghost" size="md" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" size="md" disabled={isSubmitting} leftIcon={<Send className="w-4 h-4" />}>
              {isSubmitting ? 'جاري التحويل...' : 'تأكيد وإرسال التحويل'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface StockTransferDetailsModalProps {
  transfer: any | null;
  onClose: () => void;
}

export const StockTransferDetailsModal: React.FC<StockTransferDetailsModalProps> = ({
  transfer,
  onClose,
}) => {
  if (!transfer) return null;

  return (
    <div className="fixed inset-0 z-50 bg-canvas/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-panel border border-line w-full sm:max-w-lg rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        <div className="w-12 h-1.5 bg-line-2 rounded-full mx-auto my-2.5 sm:hidden" />
        <div className="p-5 bg-surface-2 border-b border-line flex items-center justify-between">
          <div>
            <h3 className="font-bold text-ink text-lg">إذن تحويل: {transfer.transfer_number}</h3>
            <span className="text-xs text-muted">
              {transfer.transferred_at ? new Date(transfer.transferred_at).toLocaleString('ar-EG') : ''}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 bg-surface-2 rounded-xl text-xs">
            <div>
              <span className="text-muted block">من فرع:</span>
              <span className="font-bold text-ink mt-0.5 block">{transfer.from_branch?.name}</span>
            </div>
            <div>
              <span className="text-muted block">إلى فرع:</span>
              <span className="font-bold text-brand-ink mt-0.5 block">{transfer.to_branch?.name}</span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-muted mb-2">الأصناف المحولة:</h4>
            <div className="divide-y divide-line border border-line rounded-xl overflow-hidden">
              {transfer.items?.map((item: any) => (
                <div key={item.id} className="p-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold text-ink">{item.product?.name}</div>
                    {item.variant && (
                      <div className="text-xs text-brand-ink font-medium">
                        مقاس: {item.variant.size || '-'} | لون: {item.variant.color || '-'}
                      </div>
                    )}
                  </div>
                  <div className="text-left font-bold text-ink tabular-nums">
                    {item.quantity_sent} {item.unit_name || 'قطعة'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {transfer.notes && (
            <div className="p-3 bg-warn-soft rounded-xl text-xs text-warn border border-warn/25">
              <span className="font-bold block mb-0.5">ملاحظات:</span>
              {transfer.notes}
            </div>
          )}
        </div>

        <div className="p-4 bg-surface-2 border-t border-line flex justify-end">
          <Button type="button" variant="secondary" size="md" onClick={onClose}>
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
};
