import React from 'react';
import { Trash2 } from 'lucide-react';
import { UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Product, formatCurrency, InvoiceInput } from '@pos-mandob/shared';

interface InvoiceItemsTableProps {
  fields: any[];
  items: any[];
  productsData?: Product[];
  register: UseFormRegister<InvoiceInput>;
  setValue: UseFormSetValue<InvoiceInput>;
  remove: (index: number) => void;
  isReturn: boolean;
}

export const InvoiceItemsTable: React.FC<InvoiceItemsTableProps> = ({
  fields,
  items,
  productsData,
  register,
  setValue,
  remove,
  isReturn,
}) => {
  return (
    <div className="bg-white flex-1 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center">
        <h3 className="font-bold text-slate-800">
          {isReturn ? 'أصناف المرتجع' : 'أصناف الفاتورة'}
        </h3>
        <span className="bg-primary-100 text-primary-800 text-xs font-black px-2.5 py-1 rounded-full">
          {fields.length} صنف
        </span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {fields.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm">لم يتم إضافة أصناف بعد. ابحث عن صنف لإضافته.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="text-slate-500 text-xs border-b border-slate-100">
                  <tr>
                    <th className="pb-2 font-bold w-10">#</th>
                    <th className="pb-2 font-bold">الصنف</th>
                    <th className="pb-2 font-bold w-24">الكمية</th>
                    <th className="pb-2 font-bold w-28">السعر (ج.م)</th>
                    <th className="pb-2 font-bold w-24">الإجمالي</th>
                    <th className="pb-2 font-bold w-12 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {fields.map((field: any, index) => {
                    const product = productsData?.find((p) => p.id === field.product_id);
                    const currentItem = items[index];
                    const rowTotal = (Number(currentItem?.quantity) || 0) * (Number(currentItem?.unit_price) || 0);

                    return (
                      <tr key={field.id}>
                        <td className="py-3 text-slate-400">{index + 1}</td>
                        <td className="py-3 font-bold text-slate-800">
                          <div>{product?.name || `صنف #${field.product_id}`}</div>
                          {(field.variant_name || currentItem?.variant_name) && (
                            <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {field.variant_name || currentItem?.variant_name}
                            </span>
                          )}
                          {(field.batch_number || currentItem?.batch_number) && (
                            <span className="inline-flex items-center mt-1 mr-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono bg-amber-50 text-amber-700 border border-amber-100">
                              تشغيلة: {field.batch_number || currentItem?.batch_number}
                            </span>
                          )}
                          <input type="hidden" {...register(`items.${index}.product_id`, { valueAsNumber: true })} />
                          <input type="hidden" {...register(`items.${index}.product_variant_id`, { setValueAs: (v) => (v ? Number(v) : null) })} />
                          <input type="hidden" {...register(`items.${index}.variant_name`)} />
                          <input type="hidden" {...register(`items.${index}.product_batch_id`, { setValueAs: (v) => (v ? Number(v) : null) })} />
                          <input type="hidden" {...register(`items.${index}.batch_number`)} />
                          <input type="hidden" {...register(`items.${index}.unit_name`)} />
                        </td>
                        <td className="py-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentItem?.quantity !== undefined && currentItem?.quantity !== null ? currentItem.quantity : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setValue(`items.${index}.quantity`, val as any, { shouldValidate: true, shouldDirty: true });
                            }}
                            className="w-full p-1.5 border border-slate-200 rounded text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </td>
                        <td className="py-3">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={currentItem?.unit_price !== undefined && currentItem?.unit_price !== null ? currentItem.unit_price : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value);
                              setValue(`items.${index}.unit_price`, val as any, { shouldValidate: true, shouldDirty: true });
                            }}
                            className="w-full p-1.5 border border-slate-200 rounded text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                          />
                        </td>
                        <td className="py-3 font-bold text-primary-600">
                          {formatCurrency(rowTotal)}
                        </td>
                        <td className="py-3 text-center">
                          <button
                            type="button"
                            onClick={() => remove(index)}
                            className="text-rose-400 hover:text-rose-600 transition-colors p-1"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Touch Cards View (md:hidden) */}
            <div className="md:hidden space-y-3">
              {fields.map((field: any, index) => {
                const product = productsData?.find((p) => p.id === field.product_id);
                const currentItem = items[index];
                const rowTotal = (Number(currentItem?.quantity) || 0) * (Number(currentItem?.unit_price) || 0);

                return (
                  <div
                    key={field.id}
                    className="p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 space-y-3"
                  >
                    {/* Card Header: Product Name + Delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">
                          {product?.name || `صنف #${field.product_id}`}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {(field.variant_name || currentItem?.variant_name) && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {field.variant_name || currentItem?.variant_name}
                            </span>
                          )}
                          {(field.batch_number || currentItem?.batch_number) && (
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-amber-50 text-amber-700 border border-amber-100">
                              تشغيلة: {field.batch_number || currentItem?.batch_number}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors active:bg-rose-200"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity & Unit Price Inputs Grid */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">الكمية</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentItem?.quantity !== undefined && currentItem?.quantity !== null ? currentItem.quantity : ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setValue(`items.${index}.quantity`, val as any, { shouldValidate: true, shouldDirty: true });
                          }}
                          className="w-full h-10 px-3 border border-slate-200 bg-white rounded-xl text-center text-sm font-black focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">السعر (ج.م)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={currentItem?.unit_price !== undefined && currentItem?.unit_price !== null ? currentItem.unit_price : ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setValue(`items.${index}.unit_price`, val as any, { shouldValidate: true, shouldDirty: true });
                          }}
                          className="w-full h-10 px-3 border border-slate-200 bg-white rounded-xl text-center text-sm font-black focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    </div>

                    {/* Row Total Subtotal */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                      <span className="text-slate-500 font-bold">إجمالي الصنف:</span>
                      <span className="font-mono font-black text-primary-700 text-sm">
                        {formatCurrency(rowTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};