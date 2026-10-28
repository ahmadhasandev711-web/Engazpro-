import React from 'react';
import { formatCurrency } from '@pos-mandob/shared';
import { Coins, ShieldCheck, Landmark, Smartphone, Plus, UserCheck, Store } from 'lucide-react';
import type { TreasuriesViewModel } from './types';

export const TreasuriesDetailTab: React.FC<{ vm: TreasuriesViewModel }> = ({ vm }) => {
  const { canManageTreasury, canManageBanks, activeTab, setCreateModalOpen, mainTreasuries, branchSafes, banksAndWallets, ownerDrawings, drawersAndCustodies, mainTotal, branchSafesTotal, banksAndWalletsTotal, ownerDrawingsTotal, drawersAndCustodiesTotal } = vm;

  return (
    <>
      {/* Tab 2: Treasuries Detail */}
      {activeTab === 'TREASURIES' && (
        <div className="space-y-6">
          {/* 1. الخزينة المركزية العامة (الإدارة المركزية / Master Treasury) */}
          {canManageTreasury && mainTreasuries.length > 0 && (
            <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-6 border border-slate-800 text-white shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-white">الخزينة المركزية العامة (الإدارة)</h3>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Master Treasury
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      الخزينة الرئيسية للمنشأة ككل (خاصة بالإدارة وصاحب العمل، تستقبل توريدات الفروع والتحويلات الكبرى)
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[11px] text-slate-400 block">رصيد الخزينة المركزية</span>
                  <span className="text-xl font-mono font-black text-emerald-400">
                    {formatCurrency(mainTotal)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                {mainTreasuries.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl bg-slate-800/70 border border-slate-700/80 hover:bg-slate-800 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white">{t.name}</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        خزينة مركزية
                      </span>
                    </div>

                    <div className="text-2xl font-black font-mono text-emerald-400">
                      {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                    </div>

                    <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-700/60 flex items-center justify-between">
                      <span>الإدارة المركزية العامة</span>
                      <span className="font-mono text-[10px] text-slate-500">#{t.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. خزائن الفروع التشغيلية (Branch Safes) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Store className="w-4 h-4 text-primary-600" />
                  <span>خزائن الفروع التشغيلية (Branch Safes)</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  خزائن نقدية مستقلة لكل فرع تجاري، يُورّد إليها الكاشير نقدية الوردية بعد الاعتماد
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-slate-600">
                إجمالي رصيد خزن الفروع: {formatCurrency(branchSafesTotal)}
              </span>
            </div>

            {branchSafes.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl">
                <p className="text-xs text-slate-400">لا توجد خزائن فروع مسجلة حالياً</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branchSafes.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">{t.name}</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-primary-50 text-primary-700 border border-primary-100">
                        خزينة فرع
                      </span>
                    </div>

                    <div className="text-xl font-black font-mono text-slate-900">
                      {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                    </div>

                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span>{t.branch_name ? `فرع: ${t.branch_name}` : 'فرع تجاري'}</span>
                      <span className="font-mono text-[10px] text-slate-400">#{t.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. الحسابات البنكية والمحافظ الإلكترونية (خاصة بالمالك والإدارة العليا) */}
          {canManageBanks && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-sky-600" />
                    <span>الحسابات البنكية والمحافظ الإلكترونية</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    حسابات سرية خاصة بالإدارة العليا والمالك، لا تظهر للكاشير أو المناديب
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-sky-700">
                  الإجمالي: {formatCurrency(banksAndWalletsTotal)}
                </span>
              </div>

              {banksAndWallets.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl">
                  <p className="text-xs text-slate-400 mb-2">لم تقم بإضافة أي حسابات بنكية أو محافظ بعد</p>
                  <button
                    onClick={() => setCreateModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة بنك أو محفظة الآن</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {banksAndWallets.map((t: any) => {
                    const isBank = t.type === 'BANK';
                    return (
                      <div
                        key={t.id}
                        className="p-5 rounded-2xl border border-sky-100 bg-sky-50/30 hover:bg-sky-50/60 transition-all space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isBank ? (
                              <Landmark className="w-4 h-4 text-sky-600" />
                            ) : (
                              <Smartphone className="w-4 h-4 text-indigo-600" />
                            )}
                            <span className="text-xs font-black text-slate-900">{t.name}</span>
                          </div>
                          <span
                            className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                              isBank ? 'bg-sky-100 text-sky-800' : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {isBank ? 'حساب بنكي' : 'محفظة إلكترونية'}
                          </span>
                        </div>

                        <div className="text-xl font-black font-mono text-slate-900">
                          {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                        </div>

                        <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                          <span className="truncate max-w-[160px]">{t.notes || (isBank ? 'تحويلات وفيزا' : 'فودافون كاش / إنستاباي')}</span>
                          <span className="font-mono text-[10px] text-slate-400">#{t.id}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 3. مسحوبات الشركاء والمالك (خاصة بالمالك والإدارة العليا) */}
          {canManageBanks && ownerDrawings.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-purple-600" />
                    <span>حسابات جاري الشركاء والمسحوبات الشخصية</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    تتبع المبالغ والمسحوبات التي تم تحويلها لصالح الشركاء والمالك
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-purple-700">
                  الإجمالي: {formatCurrency(ownerDrawingsTotal)}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownerDrawings.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-5 rounded-2xl border border-purple-100 bg-purple-50/30 hover:bg-purple-50/60 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">{t.name}</span>
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800">
                        جاري المالك
                      </span>
                    </div>

                    <div className="text-xl font-black font-mono text-purple-900">
                      {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                    </div>

                    <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                      <span>{t.notes || 'مسحوبات أرباح وشخصية'}</span>
                      <span className="font-mono text-[10px] text-slate-400">#{t.id}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. أدراج الكاشير وعهد المناديب الفردية */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Coins className="w-4 h-4 text-amber-600" />
                <span>أدراج نقاط البيع (POS) وعهد المناديب الميدانية</span>
              </h3>
              <span className="text-xs font-mono font-bold text-slate-500">
                إجمالي العهد: {formatCurrency(drawersAndCustodiesTotal)}
              </span>
            </div>

            {drawersAndCustodies.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">لا توجد أدراج كاشير أو عهد مناديب حالياً</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {drawersAndCustodies.map((t: any) => {
                  const isDrawer = t.type === 'CASHIER_DRAWER';
                  return (
                    <div
                      key={t.id}
                      className="p-4 rounded-2xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">{t.name}</span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            isDrawer ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                          }`}
                        >
                          {isDrawer ? 'درج كاشير' : 'عهدة مندوب'}
                        </span>
                      </div>

                      <div className="text-lg font-black font-mono text-slate-900">
                        {formatCurrency(t.current_balance ?? t.balance ?? 0)}
                      </div>

                      <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span>المسؤول: {t.employee?.name || t.assigned_user_name || 'الكاشير'}</span>
                        <span className="font-mono text-[10px] text-slate-400">#{t.id}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
