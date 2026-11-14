import React from 'react';
import { Trash2 } from 'lucide-react';
import { UseFormRegister, UseFormSetValue } from 'react-hook-form';
import { Product, formatCurrency, InvoiceInput } from '@pos-mandob/shared';
import { Badge, Button, Card, DataTable, EmptyState } from '../ui';

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
    <Card className="p-0 sm:p-0 flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-line flex justify-between items-center">
        <h3 className="font-bold text-ink">{isReturn ? 'أصناف المرتجع' : 'أصناف الفاتورة'}</h3>
        <Badge tone="brand" className="tabular-nums">
          {fields.length} صنف
        </Badge>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {fields.length === 0 ? (
          <EmptyState
            title="لم يتم إضافة أصناف بعد. ابحث عن صنف لإضافته."
            className="border-0 rounded-none py-12"
          />
        ) : (
          <>
            {/* Desktop Table View */}
            <DataTable className="hidden md:block border-0 rounded-none shadow-none">
              <thead className="text-muted text-xs border-b border-line bg-surface-2/60">
                <tr>
                  <th className="py-2.5 px-3 font-bold w-10">#</th>
                  <th className="py-2.5 px-3 font-bold">الصنف</th>
                  <th className="py-2.5 px-3 font-bold w-24">الكمية</th>
                  <th className="py-2.5 px-3 font-bold w-28">السعر (ج.م)</th>
                  <th className="py-2.5 px-3 font-bold w-24">الإجمالي</th>
                  <th className="py-2.5 px-3 font-bold w-14 text-center">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {fields.map((field: any, index) => {
                  const product = productsData?.find((p) => p.id === field.product_id);
                  const currentItem = items[index];
                  const rowTotal =
                    (Number(currentItem?.quantity) || 0) * (Number(currentItem?.unit_price) || 0);

                  return (
                    <tr key={field.id}>
                      <td className="py-3 px-3 text-muted tabular-nums">{index + 1}</td>
                      <td className="py-3 px-3 font-bold text-ink">
                        <div>{product?.name || `صنف #${field.product_id}`}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {(field.variant_name || currentItem?.variant_name) && (
                            <Badge tone="info" className="text-[11px]">
                              {field.variant_name || currentItem?.variant_name}
                            </Badge>
                          )}
                          {(field.batch_number || currentItem?.batch_number) && (
                            <Badge tone="warn" className="text-[11px] tabular-nums">
                              تشغيلة: {field.batch_number || currentItem?.batch_number}
                            </Badge>
                          )}
                        </div>
                        <input
                          type="hidden"
                          {...register(`items.${index}.product_id`, { valueAsNumber: true })}
                        />
                        <input
                          type="hidden"
                          {...register(`items.${index}.product_variant_id`, {
                            setValueAs: (v) => (v ? Number(v) : null),
                          })}
                        />
                        <input type="hidden" {...register(`items.${index}.variant_name`)} />
                        <input
                          type="hidden"
                          {...register(`items.${index}.product_batch_id`, {
                            setValueAs: (v) => (v ? Number(v) : null),
                          })}
                        />
                        <input type="hidden" {...register(`items.${index}.batch_number`)} />
                        <input type="hidden" {...register(`items.${index}.unit_name`)} />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={
                            currentItem?.quantity !== undefined && currentItem?.quantity !== null
                              ? currentItem.quantity
                              : ''
                          }
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setValue(`items.${index}.quantity`, val as any, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                          }}
                          className="w-full min-h-[44px] px-2 bg-panel text-ink border border-line rounded-xl text-center text-sm font-bold tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                      </td>
                      <td className="py-3 px-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={
                            currentItem?.unit_price !== undefined && currentItem?.unit_price !== null
                              ? currentItem.unit_price
                              : ''
                          }
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setValue(`items.${index}.unit_price`, val as any, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                          }}
                          className="w-full min-h-[44px] px-2 bg-panel text-ink border border-line rounded-xl text-center text-sm font-bold tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                      </td>
                      <td className="py-3 px-3 font-bold text-brand tabular-nums">
                        {formatCurrency(rowTotal)}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="md"
                          onClick={() => remove(index)}
                          className="text-bad hover:bg-bad-soft px-2.5"
                          title="حذف الصنف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>

            {/* Mobile Touch Cards View (md:hidden) */}
            <div className="md:hidden space-y-3">
              {fields.map((field: any, index) => {
                const product = productsData?.find((p) => p.id === field.product_id);
                const currentItem = items[index];
                const rowTotal =
                  (Number(currentItem?.quantity) || 0) * (Number(currentItem?.unit_price) || 0);

                return (
                  <Card key={field.id} className="p-3.5 bg-surface-2/60 space-y-3">
                    {/* Card Header: Product Name + Delete */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-ink text-sm block">
                          {product?.name || `صنف #${field.product_id}`}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {(field.variant_name || currentItem?.variant_name) && (
                            <Badge tone="info" className="text-[11px]">
                              {field.variant_name || currentItem?.variant_name}
                            </Badge>
                          )}
                          {(field.batch_number || currentItem?.batch_number) && (
                            <Badge tone="warn" className="text-[11px] tabular-nums">
                              تشغيلة: {field.batch_number || currentItem?.batch_number}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="md"
                        onClick={() => remove(index)}
                        className="text-bad bg-bad-soft hover:bg-bad-soft/80 px-2.5"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Quantity & Unit Price Inputs Grid */}
                    <div className="grid grid-cols-2 gap-2.5 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-muted mb-1">الكمية</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={
                            currentItem?.quantity !== undefined && currentItem?.quantity !== null
                              ? currentItem.quantity
                              : ''
                          }
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setValue(`items.${index}.quantity`, val as any, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                          }}
                          className="w-full min-h-[44px] px-3 border border-line bg-panel text-ink rounded-xl text-center text-sm font-black tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-muted mb-1">
                          السعر (ج.م)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={
                            currentItem?.unit_price !== undefined && currentItem?.unit_price !== null
                              ? currentItem.unit_price
                              : ''
                          }
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value);
                            setValue(`items.${index}.unit_price`, val as any, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                          }}
                          className="w-full min-h-[44px] px-3 border border-line bg-panel text-ink rounded-xl text-center text-sm font-black tabular-nums focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                      </div>
                    </div>

                    {/* Row Total Subtotal */}
                    <div className="flex items-center justify-between pt-2 border-t border-line text-xs">
                      <span className="text-muted font-bold">إجمالي الصنف:</span>
                      <span className="tabular-nums font-black text-brand text-sm">
                        {formatCurrency(rowTotal)}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Card>
  );
};
