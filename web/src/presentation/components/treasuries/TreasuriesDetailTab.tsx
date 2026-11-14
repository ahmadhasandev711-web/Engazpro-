import React from 'react';
import { formatCurrency } from '@pos-mandob/shared';
import { Coins, ShieldCheck, Landmark, Smartphone, Plus, UserCheck, Store } from 'lucide-react';
import type { TreasuriesViewModel } from './types';
import { Badge, Button, Card, EmptyState } from '../ui';

export const TreasuriesDetailTab: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { canManageTreasury, canManageBanks, activeTab, setCreateModalOpen, mainTreasuries, branchSafes, banksAndWallets, ownerDrawings, drawersAndCustodies, mainTotal, branchSafesTotal, banksAndWalletsTotal, ownerDrawingsTotal, drawersAndCustodiesTotal } = vm;

  return (
    <>
      {/* Tab 2: Treasuries Detail */}
      {activeTab === 'TREASURIES' && (
        <div className="space-y-6">
          {/* 1. الخزينة المركزية العامة (الإدارة المركزية / Master Treasury) */}
          {canManageTreasury && mainTreasuries.length > 0 && (
            <Card className="rounded-3xl p-6 border-ok/30 bg-ok-soft/30 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-ok-soft text-ok rounded-2xl border border-ok/20">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-black text-ink">الخزينة المركزية العامة (الإدارة)</h3>
                      <Badge tone="ok" className="text-[10px]">
                        Master Treasury
                      </Badge>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      الخزينة الرئيسية للمنشأة ككل (خاصة بالإدارة وصاحب العمل، تستقبل توريدات الفروع والتحويلات الكبرى)
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[11px] text-muted block">رصيد الخزينة المركزية</span>
                  <span className="text-xl tabular-nums font-black text-ok">
                    {formatCurrency(mainTotal)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                {mainTreasuries.map((t: any) => (
                  <Card
                    key={t.id}
                    className="p-5 rounded-2xl border-line bg-panel space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-ink">{t.name}</span>
                      <Badge tone="ok" className="text-[10px]">
                        خزينة مركزية
                      </Badge>
                    </div>

                    <div className="text-2xl font-black tabular-nums text-ok">
                      {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                    </div>

                    <div className="text-[11px] text-muted pt-2 border-t border-line flex items-center justify-between">
                      <span>الإدارة المركزية العامة</span>
                      <span className="tabular-nums text-[10px] text-muted">#{t.id}</span>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {/* 2. خزائن الفروع التشغيلية (Branch Safes) */}
          <Card className="rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <h3 className="text-sm font-black text-ink flex items-center gap-2">
                  <Store className="w-4 h-4 text-brand" />
                  <span>خزائن الفروع التشغيلية (Branch Safes)</span>
                </h3>
                <p className="text-[11px] text-muted mt-0.5">
                  خزائن نقدية مستقلة لكل فرع تجاري، يُورّد إليها الكاشير نقدية الوردية بعد الاعتماد
                </p>
              </div>
              <span className="text-xs tabular-nums font-bold text-muted">
                إجمالي رصيد خزن الفروع: {formatCurrency(branchSafesTotal)}
              </span>
            </div>

            {branchSafes.length === 0 ? (
              <EmptyState
                icon={<Store className="w-6 h-6" />}
                title="لا توجد خزائن فروع مسجلة حالياً"
                className="py-8"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branchSafes.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl border border-line bg-surface-2 hover:bg-surface transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-ink">{t.name}</span>
                      <Badge tone="brand" className="text-[10px]">
                        خزينة فرع
                      </Badge>
                    </div>

                    <div className="text-xl font-black tabular-nums text-ink">
                      {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                    </div>

                    <div className="text-[11px] text-muted pt-2 border-t border-line flex items-center justify-between">
                      <span>{t.branch_name ? `فرع: ${t.branch_name}` : 'فرع تجاري'}</span>
                      <span className="tabular-nums text-[10px] text-muted">#{t.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 3. الحسابات البنكية والمحافظ الإلكترونية (خاصة بالمالك والإدارة العليا) */}
          {canManageBanks && (
            <Card className="rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-ink flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-info" />
                    <span>الحسابات البنكية والمحافظ الإلكترونية</span>
                  </h3>
                  <p className="text-[11px] text-muted mt-0.5">
                    حسابات سرية خاصة بالإدارة العليا والمالك، لا تظهر للكاشير أو المناديب
                  </p>
                </div>
                <span className="text-xs tabular-nums font-bold text-info">
                  الإجمالي: {formatCurrency(banksAndWalletsTotal)}
                </span>
              </div>

              {banksAndWallets.length === 0 ? (
                <EmptyState
                  icon={<Landmark className="w-6 h-6" />}
                  title="لم تقم بإضافة أي حسابات بنكية أو محافظ بعد"
                  className="py-8"
                  action={
                    <Button
                      variant="primary"
                      size="md"
                      leftIcon={<Plus className="w-4 h-4" />}
                      onClick={() => setCreateModalOpen(true)}
                      className="text-xs font-bold"
                    >
                      إضافة بنك أو محفظة الآن
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {banksAndWallets.map((t: any) => {
                    const isBank = t.type === 'BANK';
                    return (
                      <div
                        key={t.id}
                        className="p-5 rounded-2xl border border-info/20 bg-info-soft/40 hover:bg-info-soft/70 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isBank ? (
                              <Landmark className="w-4 h-4 text-info" />
                            ) : (
                              <Smartphone className="w-4 h-4 text-brand" />
                            )}
                            <span className="text-xs font-black text-ink">{t.name}</span>
                          </div>
                          <Badge tone={isBank ? 'info' : 'brand'} className="text-[10px]">
                            {isBank ? 'حساب بنكي' : 'محفظة إلكترونية'}
                          </Badge>
                        </div>

                        <div className="text-xl font-black tabular-nums text-ink">
                          {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                        </div>

                        <div className="text-[11px] text-muted pt-2 border-t border-line flex items-center justify-between">
                          <span className="truncate max-w-[160px]">{t.notes || (isBank ? 'تحويلات وفيزا' : 'فودافون كاش / إنستاباي')}</span>
                          <span className="tabular-nums text-[10px] text-muted">#{t.id}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* 4. مسحوبات الشركاء والمالك (خاصة بالمالك والإدارة العليا) */}
          {canManageBanks && ownerDrawings.length > 0 && (
            <Card className="rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-ink flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-brand" />
                    <span>حسابات جاري الشركاء والمسحوبات الشخصية</span>
                  </h3>
                  <p className="text-[11px] text-muted mt-0.5">
                    تتبع المبالغ والمسحوبات التي تم تحويلها لصالح الشركاء والمالك
                  </p>
                </div>
                <span className="text-xs tabular-nums font-bold text-brand">
                  الإجمالي: {formatCurrency(ownerDrawingsTotal)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownerDrawings.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl border border-brand/20 bg-brand-soft/40 hover:bg-brand-soft/70 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-ink">{t.name}</span>
                      <Badge tone="brand" className="text-[10px]">
                        جاري المالك
                      </Badge>
                    </div>

                    <div className="text-xl font-black tabular-nums text-brand">
                      {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                    </div>

                    <div className="text-[11px] text-muted pt-2 border-t border-line flex items-center justify-between">
                      <span>{t.notes || 'مسحوبات أرباح وشخصية'}</span>
                      <span className="tabular-nums text-[10px] text-muted">#{t.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 5. أدراج الكاشير وعهد المناديب الفردية */}
          <Card className="rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-ink flex items-center gap-2">
                <Coins className="w-4 h-4 text-warn" />
                <span>أدراج نقاط البيع (POS) وعهد المناديب الميدانية</span>
              </h3>
              <span className="text-xs tabular-nums font-bold text-muted">
                إجمالي العهد: {formatCurrency(drawersAndCustodiesTotal)}
              </span>
            </div>

            {drawersAndCustodies.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">لا توجد أدراج كاشير أو عهد مناديب حالياً</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drawersAndCustodies.map((t: any) => {
                  const isDrawer = t.type === 'CASHIER_DRAWER';
                  return (
                    <div
                      key={t.id}
                      className="p-4 rounded-2xl border border-line bg-surface-2 hover:bg-surface transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-ink">{t.name}</span>
                        <Badge tone={isDrawer ? 'warn' : 'brand'} className="text-[10px]">
                          {isDrawer ? 'درج كاشير' : 'عهدة مندوب'}
                        </Badge>
                      </div>

                      <div className="text-lg font-black tabular-nums text-ink">
                        {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                      </div>

                      <div className="text-[11px] text-muted pt-2 border-t border-line flex items-center justify-between">
                        <span>المسؤول: {t.employee?.name || t.assigned_user_name || 'الكاشير'}</span>
                        <span className="tabular-nums text-[10px] text-muted">#{t.id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
};
