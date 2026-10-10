import React from 'react';
import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import clsx from 'clsx';
import { useMobileNavigation } from '../hooks/useMobileNavigation';
import { useHaptic } from '../hooks/useHaptic';

interface MobileBottomNavProps {
  onOpenDrawer: () => void;
}

/**
 * Presentation Layer - MobileBottomNav
 * Conforms to OCP (GR-6), SoC (GR-3) & Haptic Touch Integration
 * Provides role-tailored persistent mobile bottom navigation.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenDrawer }) => {
  const { navItems } = useMobileNavigation();
  const { selection } = useHaptic();

  const handleItemClick = () => {
    selection();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] lg:hidden px-2 py-1.5 flex items-center justify-around pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] no-print select-none">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={handleItemClick}
            className={({ isActive }) =>
              clsx(
                'flex flex-col items-center justify-center py-1 px-2 rounded-2xl text-[10px] font-bold transition-all min-w-[56px] relative active:scale-95',
                isActive
                  ? 'text-emerald-700 font-black'
                  : 'text-slate-500 hover:text-slate-800'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={clsx(
                    'p-1.5 rounded-xl transition-all relative',
                    isActive ? 'bg-emerald-100/70 text-emerald-700 shadow-xs' : 'text-slate-500'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {Boolean(item.badge) && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center border border-white">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="mt-0.5 truncate max-w-[62px]">{item.label}</span>
              </>
            )}
          </NavLink>
        );
      })}

      {/* المزيد (Menu Trigger for Mobile Drawer) */}
      <button
        type="button"
        onClick={() => {
          selection();
          onOpenDrawer();
        }}
        className="flex flex-col items-center justify-center py-1 px-2 rounded-2xl text-[10px] font-bold text-slate-500 hover:text-slate-800 transition-all min-w-[56px] active:scale-95 cursor-pointer"
      >
        <div className="p-1.5 rounded-xl text-slate-500 hover:bg-slate-100">
          <Menu className="w-5 h-5" />
        </div>
        <span className="mt-0.5">المزيد</span>
      </button>
    </nav>
  );
};
