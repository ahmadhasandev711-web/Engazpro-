import React from 'react';
import { NavLink } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useMobileNavigation } from '../hooks/useMobileNavigation';
import { useHaptic } from '../hooks/useHaptic';
import { cn } from '../utils/cn';

interface MobileBottomNavProps {
  onOpenDrawer: () => void;
}

/**
 * Presentation Layer - MobileBottomNav
 * Conforms to OCP (GR-6), SoC (GR-3) & Haptic Touch Integration
 * Provides role-tailored persistent mobile bottom navigation using semantic design tokens.
 */
export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ onOpenDrawer }) => {
  const { navItems } = useMobileNavigation();
  const { selection } = useHaptic();

  const handleItemClick = () => {
    selection();
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-panel/95 backdrop-blur-md border-t border-line/80 shadow-2xs lg:hidden px-2 py-1.5 flex items-center justify-around pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] no-print select-none">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={handleItemClick}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center py-1 px-2 rounded-2xl text-2xs font-bold transition-all min-w-[56px] min-h-[44px] relative active:scale-95',
                isActive
                  ? 'text-brand font-black'
                  : 'text-muted hover:text-ink'
              )
            }
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'p-1.5 rounded-xl transition-all relative flex items-center justify-center',
                    isActive ? 'bg-brand-soft text-brand-ink shadow-2xs' : 'text-muted'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {Boolean(item.badge) && (
                    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-bad text-on-brand text-[9px] font-black flex items-center justify-center border border-panel">
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
        className="flex flex-col items-center justify-center py-1 px-2 rounded-2xl text-2xs font-bold text-muted hover:text-ink transition-all min-w-[56px] min-h-[44px] active:scale-95 cursor-pointer"
      >
        <div className="p-1.5 rounded-xl text-muted hover:bg-surface-2 flex items-center justify-center">
          <Menu className="w-5 h-5" />
        </div>
        <span className="mt-0.5">المزيد</span>
      </button>
    </nav>
  );
};
