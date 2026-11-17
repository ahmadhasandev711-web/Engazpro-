import React from 'react';
import { formatCurrency } from '@pos-mandob/shared';
import { Wallet, Coins, RefreshCw, CheckCircle2, AlertCircle, Send, Landmark, Building2, Plus, UserCheck, X } from 'lucide-react';
import type { TreasuriesViewModel } from './types';
import { Badge, Button, Card, PageHeader } from '../ui';

export const TreasuriesHeader: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { queryClient, canManageTreasury, canManageBanks, canCreateTreasury, canViewAllTreasuries, selectedBranchId, setSelectedBranchId, setTransferModalOpen, setCreateModalOpen, message, setMessage, branches, pendingShifts, banksAndWallets, ownerDrawings, drawersAndCustodies, mainTotal, branchSafesTotal, safesTotal, banksAndWalletsTotal, ownerDrawingsTotal, drawersAndCustodiesTotal, totalLiquidBalance } = vm;

  return (
    <>
      {/* Desktop Header */}
      <div className="hidden md:block">
        <PageHeader
          title="إدارة الخزن والحسابات المالية"
          description="متابعة أرصدة الخزن، البنوك والمحافظ، واعتماد توريد تقفيلات الورديات والتحويلات المالية"
          badge={
            pendingShifts.length > 0 ? (
              <Badge tone="bad" dot>
                {pendingShifts.length} بانتظار التوريد
              </Badge>
            ) : undefined
          }
          className="mb-0"
          actions={
            <>
              {/* Branch filter for Owner/Admin */}
              {canViewAllTreasuries && branches.length > 0 && (
                <div className="flex items-center gap-1.5 bg-panel border border-line rounded-xl px-3 min-h-[44px] text-xs font-bold text-ink shadow-2xs">
                  <Building2 className="w-4 h-4 text-brand shrink-0" />
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="bg-transparent border-none focus:outline-none text-xs font-bold text-ink cursor-pointer"
                  >
                    <option value="">جميع الفروع والمقرات</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        فرع: {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {canCreateTreasury && (
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setCreateModalOpen(true)}
                  className="text-xs font-bold"
                >
                  إضافة خزينة / حساب
                </Button>
              )}

              {canManageTreasury && (
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={<Send className="w-4 h-4 text-muted" />}
                  onClick={() => setTransferModalOpen(true)}
                  className="text-xs font-bold"
                >
                  تحويل بين الخزن
                </Button>
              )}

              <Button
                variant="secondary"
                size="md"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['shifts'] });
                  queryClient.invalidateQueries({ queryKey: ['treasuries'] });
                }}
                title="تحديث البيانات"
                className="px-3 text-muted hover:text-ink"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
            </>
          }
        />
      </div>

      {/* Mobile Compact Hero Bar (md:hidden) */}
      <Card className="md:hidden p-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-ok-soft text-ok flex items-center justify-center font-black shrink-0 border border-ok/20">
            <Landmark className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-black text-ink truncate">الخزن والورديات</h2>
              {pendingShifts.length > 0 && (
                <Badge tone="bad" className="text-[10px] px-1.5 py-0.5 shrink-0">
                  {pendingShifts.length} معلق
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted font-medium truncate">
              السيولة: <span className="font-bold text-ok tabular-nums">{formatCurrency(totalLiquidBalance)}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {canManageTreasury && (
            <Button
              variant="secondary"
              size="md"
              leftIcon={<Send className="w-3.5 h-3.5" />}
              onClick={() => setTransferModalOpen(true)}
              className="px-3 text-xs font-bold"
            >
              تحويل
            </Button>
          )}
          {canCreateTreasury && (
            <Button
              variant="primary"
              size="md"
              onClick={() => setCreateModalOpen(true)}
              title="إضافة خزينة"
              className="px-3 text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>

      {/* Notifications */}
      {message && (
        <div
          className={`p-3 sm:p-4 rounded-2xl flex items-center justify-between text-xs font-bold border ${
            message.type === 'success'
              ? 'bg-ok-soft text-ok border-ok/20'
              : 'bg-bad-soft text-bad border-bad/20'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-ok shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-bad shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-muted hover:text-ink rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mobile 2-Column Quick Summary Strip (md:hidden) */}
      <Card className="md:hidden grid grid-cols-2 gap-2 p-2.5 text-center">
        <div className="bg-surface-2 border border-line p-2.5 rounded-xl">
          <span className="text-[11px] text-muted font-bold block">الخزائن النقدية</span>
          <span className="text-sm font-black text-ink tabular-nums block mt-0.5" dir="ltr">
            {formatCurrency(safesTotal)}
          </span>
        </div>
        <div className="bg-surface-2 border border-line p-2.5 rounded-xl">
          <span className="text-[11px] text-muted font-bold block">البنوك والمحافظ</span>
          <span className="text-sm font-black text-ink tabular-nums block mt-0.5" dir="ltr">
            {formatCurrency(banksAndWalletsTotal)}
          </span>
        </div>
      </Card>

      {/* Desktop Overview Stat Cards */}
      <div className={`hidden md:grid grid-cols-1 ${canManageBanks ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'} gap-4`}>
        {/* 1. الخزائن النقدية */}
        <Card className="rounded-3xl p-5 border-brand/40 bg-panel shadow-sm">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-ink">
              <span className="w-2 h-2 rounded-full bg-ok shrink-0" aria-hidden="true" />
              الخزائن النقدية (Safes)
            </span>
            <div className="p-2 bg-surface-2 text-muted rounded-xl border border-line/60">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black tabular-nums tracking-tight text-ink">
              {formatCurrency(safesTotal)}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[11px] text-muted">
            <span>المركزية: <strong className="text-ink tabular-nums">{formatCurrency(mainTotal)}</strong></span>
            <span>الفروع: <strong className="text-ink tabular-nums">{formatCurrency(branchSafesTotal)}</strong></span>
          </div>
        </Card>

        {/* 2. الحسابات البنكية والمحافظ (خاصة بالمالك والإدارة العليا) */}
        {canManageBanks && (
          <Card className="rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted">
                <span className="w-2 h-2 rounded-full bg-info shrink-0" aria-hidden="true" />
                البنوك والمحافظ الإلكترونية
              </span>
              <div className="p-2 bg-surface-2 text-muted rounded-xl border border-line/60">
                <Landmark className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black tabular-nums text-ink">
                {formatCurrency(banksAndWalletsTotal)}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[11px] text-muted">
              <span>فودافون كاش، إنستاباي، وبنوك</span>
              <span className="font-bold text-ink">{banksAndWallets.length} حسابات</span>
            </div>
          </Card>
        )}

        {/* 3. أدراج الكاشير وعهد المناديب */}
        <Card className="rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted">
              <span className="w-2 h-2 rounded-full bg-warn shrink-0" aria-hidden="true" />
              أدراج POS وعهد المناديب
            </span>
            <div className="p-2 bg-surface-2 text-muted rounded-xl border border-line/60">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black tabular-nums text-ink">
              {formatCurrency(drawersAndCustodiesTotal)}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[11px] text-muted">
            <span>سيولة لدى الكاشيرات والمناديب</span>
            <span className="font-bold text-ink">{drawersAndCustodies.length} أفراد</span>
          </div>
        </Card>

        {/* 4. جاري المالك والمسحوبات الشخصية */}
        {canManageBanks && (
          <Card className="rounded-3xl p-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted">
                <span className="w-2 h-2 rounded-full bg-brand shrink-0" aria-hidden="true" />
                جاري الشركاء والمسحوبات
              </span>
              <div className="p-2 bg-surface-2 text-muted rounded-xl border border-line/60">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl font-black tabular-nums text-ink">
                {formatCurrency(ownerDrawingsTotal)}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-line flex items-center justify-between text-[11px] text-muted">
              <span>مسحوبات الشركاء المحولة</span>
              <span className="font-bold text-ink">{ownerDrawings.length} حسابات</span>
            </div>
          </Card>
        )}
      </div>
    </>
  );
};
