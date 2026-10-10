import React, { useState, useMemo } from 'react';
import {
  Globe,
  Search,
  MessageSquare,
  Phone,
  CheckCircle2,
  Clock,
  Briefcase,
  Trash2,
  Edit3,
  X,
  Save,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';
import {
  StoreInquiry,
  useAdminInquiries,
  useUpdateInquiryStatus,
  useDeleteInquiry,
} from '../../../hooks/useAdmin';

export const StoreInquiriesTab: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [editingNotesInquiry, setEditingNotesInquiry] = useState<StoreInquiry | null>(null);
  const [adminNotesText, setAdminNotesText] = useState<string>('');

  const { data: inquiries = [], isLoading, refetch } = useAdminInquiries(statusFilter, search);
  const updateStatusMutation = useUpdateInquiryStatus();
  const deleteMutation = useDeleteInquiry();

  // Metrics computation
  const metrics = useMemo(() => {
    return {
      total: inquiries.length,
      new: inquiries.filter((i) => i.status === 'NEW').length,
      contacted: inquiries.filter((i) => i.status === 'CONTACTED').length,
      contracted: inquiries.filter((i) => i.status === 'CONTRACTED').length,
      closed: inquiries.filter((i) => i.status === 'CLOSED').length,
    };
  }, [inquiries]);

  const handleStatusChange = (inquiry: StoreInquiry, newStatus: 'NEW' | 'CONTACTED' | 'CONTRACTED' | 'CLOSED') => {
    updateStatusMutation.mutate(
      { id: inquiry.id, status: newStatus },
      {
        onSuccess: () => {
          // Status updated
        },
        onError: (err: any) => {
          alert(err.response?.data?.message || 'تعذر تعديل حالة الطلب');
        },
      }
    );
  };

  const handleSaveNotes = () => {
    if (!editingNotesInquiry) return;
    updateStatusMutation.mutate(
      {
        id: editingNotesInquiry.id,
        status: editingNotesInquiry.status,
        admin_notes: adminNotesText,
      },
      {
        onSuccess: () => {
          setEditingNotesInquiry(null);
        },
        onError: (err: any) => {
          alert(err.response?.data?.message || 'تعذر حفظ ملاحظات الإدارة');
        },
      }
    );
  };

  const handleDelete = (id: number, clientName: string) => {
    if (confirm(`هل أنت متأكد من حذف طلب العميل "${clientName}" نهائياً؟`)) {
      deleteMutation.mutate(id, {
        onError: (err: any) => {
          alert(err.response?.data?.message || 'تعذر حذف الطلب');
        },
      });
    }
  };

  const openWhatsApp = (phone: string, name: string) => {
    // Sanitize phone number (remove non-digits, ensure country code)
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('01')) {
      clean = '2' + clean; // Egypt prefix
    }
    const msg = encodeURIComponent(`أهلاً بك يا أستاذ ${name}، بخصوص طلبك لتصميم وتطوير متجر إلكتروني متكامل عبر إنجاز برو.`);
    window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
  };

  const getStatusBadge = (status: StoreInquiry['status']) => {
    switch (status) {
      case 'NEW':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            جديد
          </span>
        );
      case 'CONTACTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 flex items-center gap-1 w-fit">
            <Clock className="w-3 h-3" />
            جاري التواصل
          </span>
        );
      case 'CONTRACTED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3" />
            تم التعاقد 🎉
          </span>
        );
      case 'CLOSED':
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 w-fit">
            مغلق
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & KPI Cards */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-700 to-cyan-800 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-emerald-300">
              <Globe className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black">طلبات المتاجر الإلكترونية وتطوير المواقع</h2>
                <span className="text-[11px] font-bold bg-white/20 text-white px-2.5 py-0.5 rounded-full">
                  Lead Management
                </span>
              </div>
              <p className="text-xs text-emerald-100 mt-1">
                استقبل عملاء المتجر المباشرين من الصفحة الرئيسية، تواصل معهم عبر واتساب، وأدر صفقات التعاقد
              </p>
            </div>
          </div>

          <button
            onClick={() => refetch()}
            className="self-start md:self-auto px-4 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
          >
            تحديث القائمة
          </button>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/15">
          <div className="bg-black/15 backdrop-blur-sm rounded-2xl p-4">
            <div className="text-xs text-emerald-200 font-bold">إجمالي الطلبات</div>
            <div className="text-2xl font-black mt-1 font-mono">{metrics.total}</div>
          </div>
          <div className="bg-black/15 backdrop-blur-sm rounded-2xl p-4">
            <div className="text-xs text-emerald-200 font-bold">طلبات جديدة لم تُعالج</div>
            <div className="text-2xl font-black mt-1 text-amber-300 font-mono">{metrics.new}</div>
          </div>
          <div className="bg-black/15 backdrop-blur-sm rounded-2xl p-4">
            <div className="text-xs text-emerald-200 font-bold">قيد المتابعة والتفاوض</div>
            <div className="text-2xl font-black mt-1 text-cyan-300 font-mono">{metrics.contacted}</div>
          </div>
          <div className="bg-black/15 backdrop-blur-sm rounded-2xl p-4">
            <div className="text-xs text-emerald-200 font-bold">تم التعاقد والبدء</div>
            <div className="text-2xl font-black mt-1 text-emerald-300 font-mono">{metrics.contracted}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ابحث بالاسم، الهاتف، النشاط، المدينة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'NEW', label: 'جديد' },
            { key: 'CONTACTED', label: 'جاري التواصل' },
            { key: 'CONTRACTED', label: 'تم التعاقد' },
            { key: 'CLOSED', label: 'مغلق' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={clsx(
                'px-3.5 py-1.5 text-xs font-bold rounded-xl whitespace-nowrap transition-colors',
                statusFilter === tab.key
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table of Inquiries */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="py-20 text-center text-slate-400 text-sm">
            <div className="animate-spin w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3" />
            جاري تحميل طلبات المتاجر...
          </div>
        ) : inquiries.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-base font-black text-slate-800">لا توجد طلبات تطابق بحثك</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              عندما يقوم زوار الصفحة الرئيسية بطلب تصميم متجر إلكتروني، ستظهر بياناتهم هنا فوراً مع إمكانية التواصل الفوري عبر واتساب.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                <tr>
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">العميل ومعلومات الاتصال</th>
                  <th className="py-3.5 px-4">نوع النشاط والمحافظة</th>
                  <th className="py-3.5 px-4">تفاصيل الطلب / الموقع المطلوب</th>
                  <th className="py-3.5 px-4">حالة الطلب</th>
                  <th className="py-3.5 px-4">ملاحظات الإدارة (خاصة بأحمد)</th>
                  <th className="py-3.5 px-4">التاريخ</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inquiries.map((inq, idx) => (
                  <tr key={inq.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-slate-400 font-bold">{idx + 1}</td>

                    {/* Client & Phone */}
                    <td className="py-3 px-4">
                      <div className="font-black text-slate-900 text-sm">{inq.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="font-mono text-slate-600 dir-ltr">{inq.phone}</span>
                        <button
                          onClick={() => openWhatsApp(inq.phone, inq.name)}
                          className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[10px] flex items-center gap-1 transition-colors"
                          title="محادثة واتساب مباشرة"
                        >
                          <MessageSquare className="w-3 h-3 text-emerald-600" />
                          واتساب
                        </button>
                        <a
                          href={`tel:${inq.phone}`}
                          className="p-1 rounded text-slate-400 hover:text-slate-700"
                          title="اتصال هاتفي"
                        >
                          <Phone className="w-3 h-3" />
                        </a>
                      </div>
                    </td>

                    {/* Business & City */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                        {inq.business_type}
                      </div>
                      {inq.city && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          📍 {inq.city}
                        </div>
                      )}
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-4 max-w-xs">
                      {inq.notes ? (
                        <p className="text-slate-700 whitespace-pre-wrap line-clamp-3 leading-relaxed">
                          {inq.notes}
                        </p>
                      ) : (
                        <span className="text-slate-400 italic">بدون ملاحظات إضافية</span>
                      )}
                    </td>

                    {/* Status Dropdown */}
                    <td className="py-3 px-4">
                      <div className="space-y-1.5">
                        {getStatusBadge(inq.status)}
                        <select
                          value={inq.status}
                          onChange={(e) =>
                            handleStatusChange(inq, e.target.value as StoreInquiry['status'])
                          }
                          disabled={updateStatusMutation.isPending}
                          className="text-[11px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                        >
                          <option value="NEW">جديد</option>
                          <option value="CONTACTED">جاري التواصل</option>
                          <option value="CONTRACTED">تم التعاقد 🎉</option>
                          <option value="CLOSED">مغلق</option>
                        </select>
                      </div>
                    </td>

                    {/* Admin Notes */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex items-start justify-between gap-1 group">
                        <div className="text-slate-600 italic line-clamp-2">
                          {inq.admin_notes || <span className="text-slate-400 not-italic">لا توجد ملاحظات داخلية</span>}
                        </div>
                        <button
                          onClick={() => {
                            setEditingNotesInquiry(inq);
                            setAdminNotesText(inq.admin_notes || '');
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-emerald-600 transition-opacity"
                          title="تعديل ملاحظات الإدارة"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                      {new Date(inq.created_at).toLocaleDateString('ar-EG', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleDelete(inq.id, inq.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="حذف الطلب"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Notes Modal */}
      {editingNotesInquiry && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-base">ملاحظات الإدارة للطلب</h3>
              </div>
              <button
                onClick={() => setEditingNotesInquiry(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              العميل: <b className="text-slate-900">{editingNotesInquiry.name}</b> ({editingNotesInquiry.phone})
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سجل الملاحظات الخاصة (الاتفاق المالي، تفاصيل المتجر، باقة التصميم):
              </label>
              <textarea
                rows={4}
                value={adminNotesText}
                onChange={(e) => setAdminNotesText(e.target.value)}
                placeholder="اكتب هنا ما تم الاتفاق عليه مع العميل، السعر المتفق عليه، موعد التسليم..."
                className="w-full text-xs p-3 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingNotesInquiry(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={updateStatusMutation.isPending}
                className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>حفظ الملاحظات</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
