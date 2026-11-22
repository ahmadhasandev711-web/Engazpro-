import React from 'react';
import {
  ArrowLeft,
  Check,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { formatCurrency } from '@pos-mandob/shared';
import {
  useEasyfyCart,
  useEasyfyStorefront,
  useRemoveEasyfyCartItem,
  useUpdateEasyfyCartItem,
  useUploadEasyfyCartArtwork,
} from '../../../hooks/useEasyfyShop';
import { useToast } from '../../context/ToastContext';
import { STOCK_MODE_META } from '../../components/admin/easyfy/easyfyUiMeta';
import { ShopTopBar } from '../../components/shop/ShopTopBar';
import { Badge, Button, Card, EmptyState } from '../../components/ui';

export const ShopCartPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const { data: storefront } = useEasyfyStorefront();
  const { data: cart, isLoading } = useEasyfyCart();
  const updateItemMutation = useUpdateEasyfyCartItem();
  const removeItemMutation = useRemoveEasyfyCartItem();
  const uploadArtworkMutation = useUploadEasyfyCartArtwork();

  const items = cart?.items ?? [];
  const subtotal = cart?.subtotal ?? 0;
  const threshold = storefront?.settings.free_shipping_threshold ?? null;
  const remainingForFree =
    threshold && threshold > 0 ? Math.max(0, threshold - subtotal) : null;
  const progressPct =
    threshold && threshold > 0 ? Math.min(100, Math.round((subtotal / threshold) * 100)) : 0;

  const handleQtyChange = async (itemId: number, nextQty: number, minQty: number) => {
    if (nextQty < minQty) return;
    try {
      await updateItemMutation.mutateAsync({ itemId, quantity: nextQty });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر تحديث الكمية');
    }
  };

  const handleRemove = async (itemId: number) => {
    try {
      await removeItemMutation.mutateAsync(itemId);
      toast.success('تم حذف الصنف من السلة.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر حذف الصنف');
    }
  };

  const handleArtworkChange = async (
    itemId: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadArtworkMutation.mutateAsync({ itemId, file });
      toast.success('تم رفع ملف اللوجو/التصميم بنجاح.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'تعذر رفع التصميم');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <ShopTopBar />

      {isLoading ? (
        <div className="h-64 rounded-2xl bg-surface-2 animate-pulse" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="w-10 h-10 text-muted" />}
          title="سلة المشتريات فارغة"
          description="تصفح كتالوج مستلزمات الشحن والتغليف وأضف الأصناف التي يحتاجها متجرك."
          action={
            <Button size="sm" onClick={() => navigate('/shop')}>
              تصفح الكتالوج
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-4">
            {threshold !== null && threshold > 0 && (
              <Card className="p-4 space-y-2 border-ok/25 bg-ok-soft/30">
                <div className="flex items-center justify-between gap-2 text-xs font-bold">
                  <span className="flex items-center gap-2 text-ink">
                    <Truck className="w-4 h-4 text-ok shrink-0" />
                    {remainingForFree === 0 ? (
                      <span className="text-ok font-black">
                        مبروك! طلبك مؤهل للشحن المجاني.
                      </span>
                    ) : (
                      <span>
                        أضف منتجات بقيمة{' '}
                        <strong className="text-ok">{formatCurrency(remainingForFree ?? 0)}</strong>{' '}
                        للحصول على شحن مجاني!
                      </span>
                    )}
                  </span>
                  <span className="text-muted tabular-nums">{progressPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                  <div
                    className="h-full bg-ok transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </Card>
            )}

            <div className="space-y-3">
              {items.map((item) => {
                const modeMeta = STOCK_MODE_META[item.stock_mode] ?? {
                  label: String(item.stock_mode),
                  tone: 'neutral' as const,
                };
                const minQ = Math.max(1, Number(item.min_order_qty || 1));

                return (
                  <Card key={item.id} className="p-4 flex flex-col sm:flex-row gap-4 justify-between">
                    <div className="flex gap-3.5 min-w-0">
                      <Link
                        to={`/shop/products/${item.product_slug || item.product_id}`}
                        className="w-20 h-20 rounded-xl bg-surface-2 border border-line overflow-hidden shrink-0 flex items-center justify-center"
                      >
                        {item.image_path ? (
                          <img
                            src={item.image_path}
                            alt={item.product_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Package className="w-7 h-7 text-muted opacity-50" />
                        )}
                      </Link>

                      <div className="min-w-0 space-y-1.5">
                        <Link
                          to={`/shop/products/${item.product_slug || item.product_id}`}
                          className="font-black text-sm sm:text-base text-ink hover:text-brand-ink transition-colors block truncate"
                        >
                          {item.product_name}
                        </Link>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-muted">{item.variant_label}</span>
                          <Badge tone={modeMeta.tone}>{modeMeta.label}</Badge>
                        </div>
                        <p className="text-xs font-bold text-brand tabular-nums">
                          سعر الوحدة الحالي: {formatCurrency(item.unit_price)}
                        </p>
                        {item.custom_note && (
                          <p className="text-xs bg-brand-soft text-brand-ink px-2.5 py-1 rounded-lg border border-brand/20">
                            ملاحظة الطباعة: {item.custom_note}
                          </p>
                        )}
                        {item.allow_artwork_upload && (
                          <label className="inline-flex items-center gap-1.5 text-xs font-bold text-ink cursor-pointer pt-1">
                            {item.has_artwork ? (
                              <Badge tone="ok">
                                <Check className="w-3 h-3" />
                                <span>تم إرفاق اللوجو (اضغط للاستبدال)</span>
                              </Badge>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-brand/40 text-brand-ink bg-brand-soft/50">
                                <Upload className="w-3.5 h-3.5" />
                                <span>رفع لوجو / تصميم للطباعة</span>
                              </span>
                            )}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp,application/pdf"
                              className="hidden"
                              onChange={(e) => handleArtworkChange(item.id, e)}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between gap-3 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-line">
                      <p className="text-base font-black text-ink tabular-nums">
                        {formatCurrency(item.line_total)}
                      </p>

                      <div className="flex items-center gap-2">
                        <div className="inline-flex items-center border border-line rounded-xl bg-canvas">
                          <button
                            type="button"
                            disabled={item.quantity <= minQ || updateItemMutation.isPending}
                            onClick={() => handleQtyChange(item.id, item.quantity - 1, minQ)}
                            className="w-9 h-9 flex items-center justify-center text-ink hover:bg-surface-2 rounded-r-xl disabled:opacity-40"
                            aria-label="إنقاص الكمية"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-11 text-center font-black text-sm text-ink tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={updateItemMutation.isPending}
                            onClick={() => handleQtyChange(item.id, item.quantity + 1, minQ)}
                            className="w-9 h-9 flex items-center justify-center text-ink hover:bg-surface-2 rounded-l-xl disabled:opacity-40"
                            aria-label="زيادة الكمية"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemove(item.id)}
                          aria-label="حذف الصنف"
                          leftIcon={<Trash2 className="w-4 h-4 text-bad" />}
                        />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Summary Card */}
          <Card className="p-5 lg:col-span-4 space-y-4 sticky top-20">
            <h2 className="font-black text-base text-ink border-b border-line pb-3">ملخص السلة</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted font-bold">عدد القطع الإجمالي</span>
                <span className="font-black text-ink tabular-nums">{cart?.items_count ?? 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted font-bold">إجمالي المنتجات</span>
                <span className="font-black text-brand tabular-nums">{formatCurrency(subtotal)}</span>
              </div>
              <p className="text-xs text-muted pt-1">
                تُحتسب تكلفة الشحن وكود الخصم في الخطوة التالية عند تحديد عنوان التوصيل.
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => navigate('/shop/checkout')}
              rightIcon={<ArrowLeft className="w-4 h-4" />}
            >
              إتمام الطلب (Checkout)
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
};
