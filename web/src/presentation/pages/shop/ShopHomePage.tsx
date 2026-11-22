import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Truck,
} from 'lucide-react';
import { EasyfyStockMode, formatCurrency } from '@pos-mandob/shared';
import { useEasyfyProducts, useEasyfyStorefront } from '../../../hooks/useEasyfyShop';
import { cn } from '../../utils/cn';
import { ShopProductCard } from '../../components/shop/ShopProductCard';
import { ShopTopBar } from '../../components/shop/ShopTopBar';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Select } from '../../components/ui';

export const ShopHomePage: React.FC = () => {
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [stockMode, setStockMode] = useState<EasyfyStockMode | ''>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);

  const { data: storefront, isLoading: isLoadingStorefront } = useEasyfyStorefront();
  const { data: productsPage, isLoading: isLoadingProducts } = useEasyfyProducts({
    category_id: categoryId,
    stock_mode: stockMode,
    search,
    page,
    per_page: 16,
  });

  const settings = storefront?.settings;
  const categories = storefront?.categories ?? [];
  const products = productsPage?.items ?? [];
  const freeThreshold = settings?.free_shipping_threshold;

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="متجر Easyfy لمستلزمات التجار"
        description="كراتين الشحن، الأكياس، الملصقات الحرارية، ومستلزمات التغليف الجاهزة والمطبوعة لمتجرك."
        badge={
          <Badge tone="brand" dot>
            B2B Supplies
          </Badge>
        }
      />

      <ShopTopBar />

      {!isLoadingStorefront && settings && !settings.store_enabled && (
        <Card className="p-4 border-warn/30 bg-warn-soft/60 text-sm font-bold text-ink">
          المتجر في وضع الصيانة مؤقتاً ولا يقبل طلبات جديدة حالياً، يمكنك متابعة طلباتك السابقة من قسم الطلبات.
        </Card>
      )}

      {/* B2B Promo & Free Shipping Banner */}
      <Card className="p-5 bg-gradient-to-l from-brand-soft/70 via-panel to-panel border-brand/25">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-brand-ink font-black text-sm">
              <Sparkles className="w-4 h-4" />
              <span>تجهيزات وتغليف متجرك من مصدر واحد وبأسعار الجملة</span>
            </div>
            <p className="text-xs sm:text-sm text-muted">
              اطلب الكراتين وأكياس الشحن ورولات الباركود مباشرة إلى باب فرعك أو مخزنك، أو اطلب طباعة لوجو متجرك على الشنط حسب الطلب.
            </p>
          </div>
          {freeThreshold !== null && freeThreshold !== undefined && freeThreshold > 0 && (
            <div className="shrink-0 px-4 py-2.5 rounded-xl bg-ok-soft border border-ok/25 text-ok flex items-center gap-2">
              <Truck className="w-5 h-5 shrink-0" />
              <div className="text-xs">
                <p className="font-black">شحن مجاني متاح</p>
                <p className="font-bold">للطلبات فوق {formatCurrency(freeThreshold)}</p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Filters & Category Pills */}
      <Card className="p-4 space-y-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              setCategoryId('');
              setPage(1);
            }}
            className={cn(
              'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors',
              categoryId === ''
                ? 'bg-brand text-on-brand border-brand'
                : 'bg-surface-2 text-ink border-line hover:border-brand/40'
            )}
          >
            كل الأقسام
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setCategoryId(cat.id);
                setPage(1);
              }}
              className={cn(
                'px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-colors inline-flex items-center gap-2',
                categoryId === cat.id
                  ? 'bg-brand text-on-brand border-brand'
                  : 'bg-surface-2 text-ink border-line hover:border-brand/40'
              )}
            >
              {cat.image_path && (
                <img src={cat.image_path} alt={cat.name} className="w-5 h-5 rounded object-cover" />
              )}
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="ابحث عن كراتين، أكياس شحن، رول حراري، بابلز..."
              leftIcon={<Search className="w-4 h-4" />}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={stockMode}
            onChange={(e) => {
              setStockMode(e.target.value as EasyfyStockMode | '');
              setPage(1);
            }}
            options={[
              { value: '', label: 'كل أنواع التوريد' },
              { value: EasyfyStockMode.TRACKED, label: 'متوفر بالمخزون' },
              { value: EasyfyStockMode.UNLIMITED, label: 'توريد فوري مستمر' },
              { value: EasyfyStockMode.MADE_TO_ORDER, label: 'تصنيع وطباعة حسب الطلب' },
            ]}
          />
        </div>
      </Card>

      {/* Product Grid */}
      {isLoadingProducts ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="h-72 rounded-2xl bg-surface-2 animate-pulse" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="w-9 h-9 text-muted" />}
          title="لا توجد منتجات مطابقة"
          description="جرّب اختيار قسم آخر أو مسح كلمة البحث لعرض جميع مستلزمات الشحن المتاحة."
          action={
            (categoryId !== '' || stockMode !== '' || search !== '') ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCategoryId('');
                  setStockMode('');
                  setSearch('');
                  setPage(1);
                }}
              >
                عرض كل المنتجات
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((product) => (
            <ShopProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {productsPage && productsPage.last_page > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            leftIcon={<ChevronRight className="w-4 h-4" />}
          >
            السابق
          </Button>
          <span className="text-xs font-bold text-muted inline-flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" />
            صفحة {productsPage.current_page} من {productsPage.last_page}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= productsPage.last_page}
            onClick={() => setPage((p) => p + 1)}
            rightIcon={<ChevronLeft className="w-4 h-4" />}
          >
            التالي
          </Button>
        </div>
      )}
    </div>
  );
};
