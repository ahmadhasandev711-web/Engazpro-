import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { User, Search, X, UserPlus, Check, ChevronDown, Phone } from 'lucide-react';
import { apiClient } from '../../../data/api/client';
import { formatCurrency } from '@pos-mandob/shared';
import { CustomerParty } from './PosCartTicket';

interface PosCustomerSearchProps {
  selectedCustomer: CustomerParty | null;
  onSelectCustomer: (customer: CustomerParty | null) => void;
  onOpenAddModal: (initialName?: string) => void;
}

export const PosCustomerSearch: React.FC<PosCustomerSearchProps> = ({
  selectedCustomer,
  onSelectCustomer,
  onOpenAddModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce search input to keep queries lightning fast
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 200);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Query customers with limit=10 for zero lag
  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['pos-customers-search', debouncedSearch],
    queryFn: async () => {
      const res = await apiClient.get('/parties', {
        params: {
          type: 'CUSTOMER',
          search: debouncedSearch || undefined,
          per_page: 10,
        },
      });
      return res.data?.data || [];
    },
    enabled: isOpen,
    staleTime: 30000,
  });

  const customers = searchResults || [];

  return (
    <div ref={containerRef} className="relative flex-1">
      {/* Trigger Bar */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={`flex-1 flex items-center justify-between px-3 py-2 border rounded-xl text-xs font-bold transition-all text-right ${
            selectedCustomer
              ? 'bg-primary-50/80 border-primary-300 text-primary-950 hover:bg-primary-100/80 shadow-xs'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`p-1 rounded-lg ${
                selectedCustomer ? 'bg-primary-200 text-primary-800' : 'bg-slate-100 text-slate-500'
              }`}
            >
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="truncate flex-1">
              <span className="block truncate">
                {selectedCustomer ? selectedCustomer.name : 'عميل نقدي (بدون حساب)'}
              </span>
              {selectedCustomer?.phone && (
                <span className="text-[10px] text-primary-700 font-mono block truncate">
                  {selectedCustomer.phone}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 mr-1.5 text-slate-400">
            {selectedCustomer && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCustomer(null);
                }}
                className="p-1 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                title="إلغاء التحديد والرجوع لعميل نقدي"
              >
                <X className="w-3.5 h-3.5 text-rose-500" />
              </button>
            )}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* Quick Add Customer Button */}
        <button
          type="button"
          onClick={() => onOpenAddModal()}
          title="إضافة عميل جديد سريعاً"
          className="p-2 bg-slate-100 hover:bg-primary-50 text-slate-700 hover:text-primary-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center flex-shrink-0 border border-slate-200/80 shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Search Popover Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 left-0 mt-1.5 z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-80">
          {/* Search Input Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/70 relative">
            <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-8 pl-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Results List */}
          <div className="overflow-y-auto flex-1 divide-y divide-slate-50 p-1">
            {/* Cash Option (Always Available) */}
            <button
              type="button"
              onClick={() => {
                onSelectCustomer(null);
                setIsOpen(false);
              }}
              className={`w-full text-right p-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                selectedCustomer === null ? 'bg-primary-50 text-primary-900 font-black' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>عميل نقدي (بدون حساب)</span>
              </div>
              {selectedCustomer === null && <Check className="w-3.5 h-3.5 text-primary-600" />}
            </button>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="py-4 text-center text-slate-400 text-xs font-medium">
                جاري البحث...
              </div>
            )}

            {/* Customers Matching */}
            {!isLoading && customers.length > 0 && (
              customers.map((c: any) => {
                const isSelected = selectedCustomer?.id === c.id;
                const balance = Number(c.balance || 0);

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomer({
                        id: c.id,
                        name: c.name,
                        phone: c.phone || undefined,
                      });
                      setIsOpen(false);
                    }}
                    className={`w-full text-right p-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-primary-50 text-primary-900 font-black' : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pl-2">
                      <div className="font-bold truncate">{c.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                        {c.phone && (
                          <span className="flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            {c.phone}
                          </span>
                        )}
                        {balance !== 0 && (
                          <span className={balance > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>
                            {balance > 0 ? `(عليه: ${formatCurrency(balance)})` : `(له: ${formatCurrency(Math.abs(balance))})`}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && <Check className="w-3.5 h-3.5 text-primary-600 flex-shrink-0" />}
                  </button>
                );
              })
            )}

            {/* Empty State / Quick Add Action */}
            {!isLoading && customers.length === 0 && searchTerm.trim() && (
              <div className="p-3 text-center space-y-2">
                <p className="text-xs text-slate-400">لا يوجد عميل مطابق للبحث</p>
                <button
                  type="button"
                  onClick={() => {
                    onOpenAddModal(searchTerm.trim());
                    setIsOpen(false);
                  }}
                  className="w-full py-2 px-3 bg-primary-50 hover:bg-primary-100 text-primary-800 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors border border-primary-200"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>إضافة "{searchTerm.trim()}" كعميل جديد</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
