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
          className={`flex-1 min-h-[44px] flex items-center justify-between px-3 py-2 border rounded-xl text-xs font-bold transition-all text-right ${
            selectedCustomer
              ? 'bg-brand-soft border-brand/30 text-brand-ink hover:bg-brand-soft/80 shadow-xs'
              : 'bg-panel border-line text-ink hover:bg-surface-2'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className={`p-1.5 rounded-lg ${
                selectedCustomer ? 'bg-brand text-on-brand' : 'bg-surface-2 text-muted'
              }`}
            >
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="truncate flex-1">
              <span className="block truncate font-bold">
                {selectedCustomer ? selectedCustomer.name : 'عميل نقدي (بدون حساب)'}
              </span>
              {selectedCustomer?.phone && (
                <span className="text-2xs text-muted block truncate font-medium">
                  {selectedCustomer.phone}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 mr-1.5 text-muted">
            {selectedCustomer && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCustomer(null);
                }}
                className="p-1 hover:text-bad hover:bg-bad-soft rounded-md transition-colors"
                title="إلغاء التحديد والرجوع لعميل نقدي"
              >
                <X className="w-3.5 h-3.5 text-bad" />
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
          className="min-h-[44px] min-w-[44px] p-2 bg-surface-2 hover:bg-brand-soft text-ink hover:text-brand-ink rounded-xl text-xs font-bold transition-colors flex items-center justify-center shrink-0 border border-line shadow-xs"
        >
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      {/* Search Popover Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 left-0 mt-1.5 z-50 bg-panel border border-line rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-80">
          {/* Search Input Box */}
          <div className="p-2 border-b border-line bg-surface-1/70 relative">
            <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-8 pl-3 py-1.5 bg-panel border border-line rounded-xl text-xs font-bold text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand"
            />
          </div>

          {/* Results List */}
          <div className="overflow-y-auto flex-1 divide-y divide-line/40 p-1">
            {/* Cash Option (Always Available) */}
            <button
              type="button"
              onClick={() => {
                onSelectCustomer(null);
                setIsOpen(false);
              }}
              className={`w-full text-right p-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                selectedCustomer === null ? 'bg-brand-soft text-brand-ink font-black' : 'hover:bg-surface-2 text-ink'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-ok" />
                <span>عميل نقدي (بدون حساب)</span>
              </div>
              {selectedCustomer === null && <Check className="w-3.5 h-3.5 text-brand" />}
            </button>

            {/* Loading Indicator */}
            {isLoading && (
              <div className="py-4 text-center text-muted text-xs font-medium">
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
                      isSelected ? 'bg-brand-soft text-brand-ink font-black' : 'hover:bg-surface-2 text-ink'
                    }`}
                  >
                    <div className="min-w-0 flex-1 pl-2">
                      <div className="font-bold truncate">{c.name}</div>
                      <div className="flex items-center gap-2 text-2xs text-muted mt-0.5">
                        {c.phone && (
                          <span className="flex items-center gap-0.5">
                            <Phone className="w-2.5 h-2.5" />
                            {c.phone}
                          </span>
                        )}
                        {balance !== 0 && (
                          <span className={balance > 0 ? 'text-warn font-bold' : 'text-ok font-bold'}>
                            {balance > 0 ? `(عليه: ${formatCurrency(balance)})` : `(له: ${formatCurrency(Math.abs(balance))})`}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && <Check className="w-3.5 h-3.5 text-brand shrink-0" />}
                  </button>
                );
              })
            )}

            {/* Empty State / Quick Add Action */}
            {!isLoading && customers.length === 0 && searchTerm.trim() && (
              <div className="p-3 text-center space-y-2">
                <p className="text-xs text-muted">لا يوجد عميل مطابق للبحث</p>
                <button
                  type="button"
                  onClick={() => {
                    onOpenAddModal(searchTerm.trim());
                    setIsOpen(false);
                  }}
                  className="w-full py-2 px-3 bg-brand-soft hover:bg-brand-soft/80 text-brand-ink rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors border border-brand/30"
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
