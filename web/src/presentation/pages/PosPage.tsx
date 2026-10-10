import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Maximize,
  Minimize,
  PauseCircle,
  Coins,
  AlertCircle,
  Sparkles,
  Building2,
  ShoppingBag,
  X,
} from 'lucide-react';
import { formatCurrency } from '@pos-mandob/shared';
import { apiClient } from '../../data/api/client';
import { useAuthStore } from '../../data/store/useAuthStore';
import { usePermissions } from '../../hooks/usePermissions';
import { useHoldInvoices, HeldCart } from '../../hooks/useHoldInvoices';
import { usePosCartState } from '../../hooks/usePosCartState';
import { usePosBarcodeLookup } from '../../hooks/usePosBarcodeLookup';
import { PosProductCatalog, ProductItem } from '../components/pos/PosProductCatalog';
import { PosCartTicket, CustomerParty } from '../components/pos/PosCartTicket';
import { PosPaymentModal } from '../components/pos/PosPaymentModal';
import { PosReceiptModal } from '../components/pos/PosReceiptModal';
import { HeldCartsModal } from '../components/pos/HeldCartsModal';
import { OpenShiftModal } from '../components/shifts/OpenShiftModal';
import { ProductVariantModal } from '../components/products/ProductVariantModal';
import { MobileCameraScannerModal } from '../components/mobile/MobileCameraScannerModal';
import { useHaptic } from '../hooks/useHaptic';
import { useConfirm } from '../context/ConfirmContext';

export const PosPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { canOperateShift, isOwner, isOwnerOrAdmin } = usePermissions();
  const { confirm } = useConfirm();

  // References
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // States: Non-owners are strictly bound to their assigned branch
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(() => user?.branch_id || null);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerParty | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [variantModalProduct, setVariantModalProduct] = useState<ProductItem | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isHeldCartsModalOpen, setIsHeldCartsModalOpen] = useState<boolean>(false);
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState<boolean>(false);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);
  const [isMobileScannerOpen, setIsMobileScannerOpen] = useState<boolean>(false);
  const { selection: hapticSelection, success: hapticSuccess } = useHaptic();
  const [completedInvoice, setCompletedInvoice] = useState<any | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Show temporary toast notification
  const showToast = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  }, []);

  // Cart State Hook
  const {
    cartItems,
    discount,
    shippingCost,
    courierPartyId,
    subtotal,
    totalAmount,
    setDiscount,
    setShippingCost,
    setCourierPartyId,
    addToCart,
    addCustomSelectionToCart,
    updateQuantity,
    removeItem,
    clearCart,
    loadCart,
    resetCartAfterCheckout,
  } = usePosCartState({
    onItemAdded: (name) => showToast(`تمت إضافة: ${name}`),
  });

  // Hold Invoices Hook
  const { heldCarts, holdCart, removeHeldCart } = useHoldInvoices();

  // Queries
  const { data: productsData, isLoading: isProductsLoading } = useQuery({
    queryKey: ['products', selectedBranchId],
    queryFn: async () => {
      const params: Record<string, any> = { per_page: 250 };
      if (selectedBranchId) {
        params.branch_id = selectedBranchId;
      }
      const res = await apiClient.get('/products', { params });
      return res.data?.data || [];
    },
    enabled: selectedBranchId !== null || isOwner,
  });

  // Active Shift Query

  const { data: activeShift, refetch: refetchShift } = useQuery({
    queryKey: ['active-shift'],
    queryFn: async () => {
      const res = await apiClient.get('/shifts/active');
      return res.data?.data;
    },
    enabled: canOperateShift,
    refetchInterval: 15000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await apiClient.get('/branches');
      return res.data?.data || [];
    },
  });

  // Defensive array normalization for branches (prevents crashes if cached object exists)
  const branchList: any[] = useMemo(() => {
    if (Array.isArray(branches)) return branches;
    if (branches && Array.isArray((branches as any).data)) return (branches as any).data;
    return [];
  }, [branches]);

  useEffect(() => {
    if (!isOwnerOrAdmin) {
      if (user?.branch_id && selectedBranchId !== user.branch_id) {
        setSelectedBranchId(user.branch_id);
      }
      return;
    }
    if (selectedBranchId === null) {
      if (user?.branch_id) {
        setSelectedBranchId(user.branch_id);
      } else if (branchList.length > 0) {
        const main = branchList.find((b: any) => b.is_main) || branchList[0];
        if (main) {
          setSelectedBranchId(main.id);
        }
      }
    }
  }, [branchList, user?.branch_id, selectedBranchId, isOwnerOrAdmin]);

  const products: ProductItem[] = productsData || [];

  // Catalog item click router (opens modal if variant/sub-unit/batch present)
  const handleCatalogProductClick = useCallback(
    (product: ProductItem) => {
      if (
        product.has_variants ||
        (product.variants && product.variants.length > 0) ||
        product.sub_unit ||
        product.has_expiry ||
        (product.batches && product.batches.length > 0)
      ) {
        setVariantModalProduct(product);
      } else {
        addToCart(product);
      }
    },
    [addToCart]
  );

  // Barcode Lookup & Scanning Hook
  const { handleScanOrInputBarcode } = usePosBarcodeLookup({
    products,
    onAddToCart: addToCart,
    onAddCustomSelection: addCustomSelectionToCart,
    onOpenVariantModal: setVariantModalProduct,
    onNotFound: (barcode) => {
      setSearchQuery(barcode);
      showToast(`لم يتم العثور على صنف بالباركود: ${barcode}`);
    },
  });

  // Mobile Camera Barcode Scan Handler
  const handleBarcodeScanFromCamera = useCallback(
    (scannedCode: string) => {
      const found = handleScanOrInputBarcode(scannedCode);
      if (found) {
        hapticSuccess();
        showToast(`تمت إضافة الصنف بالباركود: ${scannedCode}`);
      }
    },
    [handleScanOrInputBarcode, hapticSuccess, showToast]
  );

  // Hold current cart
  const handleHoldCurrentCart = () => {
    if (cartItems.length === 0) return;
    holdCart({
      customer: {
        id: selectedCustomer?.id || null,
        name: selectedCustomer?.name || 'عميل نقدي',
      },
      items: cartItems,
      discount,
      shipping_cost: shippingCost,
      courier_party_id: courierPartyId,
      subtotal,
    });
    resetCartAfterCheckout();
    setSelectedCustomer(null);
    showToast('تم تعليق الفاتورة بنجاح. يمكنك استرجاعها في أي وقت.');
  };

  // Resume a held cart
  const handleResumeCart = async (cart: HeldCart) => {
    if (cartItems.length > 0) {
      const ok = await confirm({
        title: 'استرجاع الفاتورة المعلقة',
        message: 'السلة الحالية تحتوي على أصناف! هل تريد استبدالها بالفاتورة المعلقة؟',
        confirmText: 'نعم، استبدال السلة',
        cancelText: 'إلغاء',
        type: 'warning',
      });
      if (!ok) return;
    }
    loadCart(cart.items, cart.discount || 0, cart.shipping_cost || 0, cart.courier_party_id || null);
    setSelectedCustomer(cart.customer.id ? { id: cart.customer.id, name: cart.customer.name } : null);
    removeHeldCart(cart.id);
    setIsHeldCartsModalOpen(false);
    showToast('تم استرجاع الفاتورة المعلقة إلى السلة.');
  };

  // Clear cart with confirmation
  const handleClearCartWithConfirm = async () => {
    if (cartItems.length === 0) return;
    const ok = await confirm({
      title: 'إفراغ سلة الفاتورة',
      message: 'هل أنت متأكد من رغبتك في إفراغ السلة بالكامل وحذف كافة الأصناف المضافة؟',
      confirmText: 'نعم، إفراغ السلة',
      cancelText: 'تراجع',
      type: 'danger',
    });
    if (ok) {
      clearCart();
      showToast('تم إفراغ السلة بنجاح.');
    }
  };

  // Quick Add Customer
  const handleQuickAddCustomer = async (name: string, phone?: string) => {
    const res = await apiClient.post('/parties', {
      type: 'CUSTOMER',
      name,
      phone,
    });
    queryClient.invalidateQueries({ queryKey: ['customers-pos'] });
    const created = res.data?.data;
    showToast(`تمت إضافة العميل ${name} بنجاح`);
    return created;
  };

  // Payment Success Handler
  const handlePaymentSuccess = (createdInvoice: any, shouldPrint: boolean) => {
    setCompletedInvoice(createdInvoice);
    resetCartAfterCheckout();
    setSelectedCustomer(null);
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['active-shift'] });
    refetchShift();

    if (shouldPrint) {
      setIsReceiptModalOpen(true);
    } else {
      showToast(`تم حفظ الفاتورة #${createdInvoice?.invoice_number} بنجاح`);
    }
  };

  // Toggle Fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Checkout Handler with mandatory shift enforcement
  const handleCheckout = () => {
    if (canOperateShift && !activeShift) {
      showToast('يجب فتح وردية برصيد افتتاحي أولاً لبدء تسجيل المبيعات');
      setIsOpenShiftModalOpen(true);
      return;
    }
    setIsPaymentModalOpen(true);
  };

  // Auto prompt shift modal for cashier/mandob if no active shift
  useEffect(() => {
    if (canOperateShift && activeShift === null) {
      setIsOpenShiftModalOpen(true);
    }
  }, [canOperateShift, activeShift]);

  // Comprehensive Cashier Keyboard Shortcuts (F2: Search, F4: Hold, F8: Held Carts, F9: Checkout, Escape: Close/Clear)
  useEffect(() => {
    const handleShortcuts = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputFocused = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      // 1. [Escape]: Close open modals or blur search
      if (e.key === 'Escape') {
        if (isPaymentModalOpen) {
          setIsPaymentModalOpen(false);
          e.preventDefault();
          return;
        }
        if (isReceiptModalOpen) {
          setIsReceiptModalOpen(false);
          e.preventDefault();
          return;
        }
        if (isHeldCartsModalOpen) {
          setIsHeldCartsModalOpen(false);
          e.preventDefault();
          return;
        }
        if (variantModalProduct) {
          setVariantModalProduct(null);
          e.preventDefault();
          return;
        }
        if (isMobileCartOpen) {
          setIsMobileCartOpen(false);
          e.preventDefault();
          return;
        }
        if (isMobileScannerOpen) {
          setIsMobileScannerOpen(false);
          e.preventDefault();
          return;
        }
        if (isInputFocused) {
          (target as HTMLInputElement).blur();
          e.preventDefault();
          return;
        }
      }

      // Do not intercept typing in fields unless it's an F-key
      if (isInputFocused && !e.key.startsWith('F')) {
        return;
      }

      // 2. [F2]: Focus Search / Barcode Input
      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // 3. [F4]: Hold Current Cart
      if (e.key === 'F4') {
        e.preventDefault();
        if (cartItems.length > 0) {
          handleHoldCurrentCart();
        } else {
          showToast('السلة فارغة، لا يوجد ما يمكن تعليقه.');
        }
        return;
      }

      // 4. [F8]: View Held Carts Modal
      if (e.key === 'F8') {
        e.preventDefault();
        setIsHeldCartsModalOpen((prev) => !prev);
        return;
      }

      // 5. [F9]: Checkout / Payment Modal
      if (e.key === 'F9') {
        e.preventDefault();
        if (cartItems.length > 0 && !isPaymentModalOpen) {
          handleCheckout();
        } else if (cartItems.length === 0) {
          showToast('يرجى إضافة أصناف إلى السلة أولاً لإتمام الدفع.');
        }
        return;
      }
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [
    cartItems.length,
    isPaymentModalOpen,
    isReceiptModalOpen,
    isHeldCartsModalOpen,
    variantModalProduct,
    isMobileCartOpen,
    isMobileScannerOpen,
    activeShift,
    canOperateShift,
    handleHoldCurrentCart,
    showToast,
  ]);

  return (
    <div className="flex flex-col h-screen bg-slate-100 font-sans text-slate-800 antialiased overflow-hidden" dir="rtl">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-2.5 rounded-2xl shadow-xl text-xs font-bold animate-in fade-in slide-in-from-top-4 duration-200 flex items-center gap-2 border border-slate-700">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* POS Top Header Bar */}
      <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between shadow-xs flex-shrink-0 z-10">
        {/* Left: Back to Dashboard & Branding */}
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            title="العودة للوحة القيادة"
          >
            <ArrowRight className="w-5 h-5" />
          </Link>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-slate-950 font-black text-sm shadow-xs">
              كـ
            </div>
            <div>
              <h1 className="font-black text-sm text-slate-900 leading-tight">نقطة البيع (POS)</h1>
              <p className="text-[10px] text-slate-500 font-medium">البيع السريع وإصدار الفواتير</p>
            </div>
          </div>
        </div>

        {/* Middle: Branch Indicator & Shift Status */}
        <div className="hidden md:flex items-center gap-2.5 text-xs">
          {/* Branch Badge / Selector */}
          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-200/80 px-3 py-1.5 rounded-full font-bold">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            {isOwnerOrAdmin ? (
              <select
                value={selectedBranchId || ''}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                className="bg-transparent border-0 font-bold text-slate-800 text-xs focus:ring-0 cursor-pointer p-0"
              >
                {branchList.map((b: any) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            ) : (
              <span className="font-bold text-slate-800">
                {branchList.find((b: any) => b.id === (user?.branch_id || selectedBranchId))?.name || (user as any)?.branch?.name || 'فرعك المخصص'}
              </span>
            )}
          </div>

          {canOperateShift && (
            <>
              {activeShift ? (
                <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200/80 px-3.5 py-1.5 rounded-full font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>الوردية: {activeShift.shift_number}</span>
                  <span className="text-slate-300">•</span>
                  <Coins className="w-3.5 h-3.5 text-amber-600" />
                  <span>نقدية الدرج: {formatCurrency(activeShift.expected_cash)}</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsOpenShiftModalOpen(true)}
                  className="flex items-center gap-1.5 bg-rose-50 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-full font-bold hover:bg-rose-100 transition-colors animate-pulse"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>لا توجد وردية مفتوحة! اضغط هنا لفتح الوردية</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* Right: Actions (Held carts, Fullscreen) */}
        <div className="flex items-center gap-2">
          {/* Held Carts Button */}
          <button
            type="button"
            onClick={() => setIsHeldCartsModalOpen(true)}
            className="relative inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            title="الفواتير المعلقة"
          >
            <PauseCircle className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">المعلقة</span>
            <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-bold text-slate-500 bg-slate-200/80 rounded">F8</kbd>
            {heldCarts.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center">
                {heldCarts.length}
              </span>
            )}
          </button>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            title="ملء الشاشة"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Shift Alert Banner on mobile if closed */}
      {canOperateShift && !activeShift && (
        <div className="bg-rose-600 text-white px-4 py-2 flex items-center justify-between text-xs font-bold md:hidden">
          <span>يجب فتح وردية لبدء تسجيل المبيعات النقدية في الدرج.</span>
          <button
            onClick={() => setIsOpenShiftModalOpen(true)}
            className="bg-white text-rose-700 px-2.5 py-1 rounded-lg text-xs font-black"
          >
            فتح وردية
          </button>
        </div>
      )}

      {/* Master Workspace: Split Screen Layout */}
      <div className="flex-1 p-3 sm:p-4 overflow-hidden flex flex-col lg:flex-row gap-3 sm:gap-4">
        {/* Right Pane (RTL): Product Catalog & Quick Search */}
        <div className="flex-1 h-full min-w-0">
          <PosProductCatalog
            products={products}
            isLoading={isProductsLoading}
            onAddToCart={handleCatalogProductClick}
            searchInputRef={searchInputRef}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            onScanBarcode={handleScanOrInputBarcode}
            onOpenMobileScanner={() => setIsMobileScannerOpen(true)}
          />
        </div>

        {/* Left Pane (RTL): Order Ticket & Cart (Desktop) */}
        <div className="hidden lg:block w-[420px] xl:w-[460px] h-full flex-shrink-0">
          <PosCartTicket
            items={cartItems}
            selectedCustomer={selectedCustomer}
            onSelectCustomer={setSelectedCustomer}
            onUpdateQuantity={updateQuantity}
            onRemoveItem={removeItem}
            onClearCart={handleClearCartWithConfirm}
            discount={discount}
            onUpdateDiscount={setDiscount}
            shippingCost={shippingCost}
            onUpdateShippingCost={setShippingCost}
            courierPartyId={courierPartyId}
            onUpdateCourierPartyId={setCourierPartyId}
            onHoldCart={handleHoldCurrentCart}
            onCheckout={handleCheckout}
            onQuickAddCustomer={handleQuickAddCustomer}
          />
        </div>
      </div>

      {/* Mobile Floating Cart Action Bar */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-[calc(4.2rem+env(safe-area-inset-bottom,0px))] left-3 right-3 z-30 p-3 bg-white/95 backdrop-blur-xl border border-white/80 shadow-[0_12px_30px_-5px_rgba(35,45,60,0.15)] rounded-2xl flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5">
            <div className="relative p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm">
              <ShoppingBag className="w-5 h-5" />
              <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
                {cartItems.reduce((acc, item) => acc + item.quantity, 0)}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold block">إجمالي السلة</span>
              <span className="text-base font-black font-mono text-slate-900 leading-none">
                {formatCurrency(totalAmount)}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticSelection();
              setIsMobileCartOpen(true);
            }}
            className="flex-1 max-w-[200px] py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-600/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <span>عرض السلة والدفع</span>
            <span className="font-mono bg-white/20 px-1.5 py-0.5 rounded-md text-[10px]">
              ({cartItems.reduce((acc, item) => acc + item.quantity, 0)})
            </span>
          </button>
        </div>
      )}

      {/* Mobile Cart Bottom Sheet Modal */}
      {isMobileCartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setIsMobileCartOpen(false)}
          />
          <div className="relative z-10 bg-white rounded-t-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-250 border-t border-slate-200">
            {/* Drawer Top Header */}
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <h3 className="font-black text-sm text-slate-900">
                  سلة الفاتورة ({cartItems.reduce((acc, item) => acc + item.quantity, 0)} قطعة)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Ticket inside Drawer */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-3">
              <PosCartTicket
                items={cartItems}
                selectedCustomer={selectedCustomer}
                onSelectCustomer={setSelectedCustomer}
                onUpdateQuantity={updateQuantity}
                onRemoveItem={removeItem}
                onClearCart={handleClearCartWithConfirm}
                discount={discount}
                onUpdateDiscount={setDiscount}
                shippingCost={shippingCost}
                onUpdateShippingCost={setShippingCost}
                courierPartyId={courierPartyId}
                onUpdateCourierPartyId={setCourierPartyId}
                onHoldCart={() => {
                  handleHoldCurrentCart();
                  setIsMobileCartOpen(false);
                }}
                onCheckout={() => {
                  setIsMobileCartOpen(false);
                  handleCheckout();
                }}
                onQuickAddCustomer={handleQuickAddCustomer}
              />
            </div>
          </div>
        </div>
      )}

      {/* Product Variant & Sub-Unit Modal */}
      <ProductVariantModal
        product={variantModalProduct}
        isOpen={Boolean(variantModalProduct)}
        onClose={() => setVariantModalProduct(null)}
        onSelect={addCustomSelectionToCart}
      />

      {/* Payment Modal */}
      <PosPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        totalAmount={totalAmount}
        customer={selectedCustomer}
        items={cartItems}
        discount={discount}
        shippingCost={shippingCost}
        courierPartyId={courierPartyId}
        branchId={selectedBranchId}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Receipt Thermal Modal */}
      <PosReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        invoice={completedInvoice}
        onStartNewInvoice={() => {
          setIsReceiptModalOpen(false);
          setCompletedInvoice(null);
          searchInputRef.current?.focus();
        }}
      />

      {/* Held Carts Modal */}
      <HeldCartsModal
        isOpen={isHeldCartsModalOpen}
        onClose={() => setIsHeldCartsModalOpen(false)}
        heldCarts={heldCarts}
        onResumeCart={handleResumeCart}
        onDeleteCart={removeHeldCart}
      />

      {/* Open Shift Modal */}
      <OpenShiftModal
        isOpen={isOpenShiftModalOpen}
        onClose={() => {
          setIsOpenShiftModalOpen(false);
          refetchShift();
        }}
      />

      {/* Mobile Camera Barcode Scanner */}
      <MobileCameraScannerModal
        isOpen={isMobileScannerOpen}
        onClose={() => setIsMobileScannerOpen(false)}
        onScan={handleBarcodeScanFromCamera}
      />
    </div>
  );
};
