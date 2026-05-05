'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  BarChart3, 
  Settings,
  Upload,
  TrendingUp,
  AlertTriangle,
  Menu,
  X,
  Scale,
  Zap,
  Crown,
  Mic,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/lib/AuthContext';
import { useDebtContext } from '@/lib/DebtContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, color: 'bg-blue-500' },
  { name: 'Clients', href: '/clients', icon: Users, color: 'bg-emerald-500' },
  { name: 'Factures', href: '/invoices', icon: FileText, color: 'bg-violet-500' },
  { name: 'Analyse', href: '/analysis', icon: BarChart3, color: 'bg-amber-500' },
  { name: 'Contentieux', href: '/contentieux', icon: Scale, color: 'bg-red-500' },
  { name: 'Import OCR', href: '/import', icon: Upload, color: 'bg-cyan-500' },
  { name: 'Paramètres', href: '/settings', icon: Settings, color: 'bg-gray-500' },
];

interface SidebarProps {
  className?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ className, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { initials, fullName, user } = useAuth();
  const { analysis } = useDebtContext();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const recoveryRate = analysis?.recoveryRate || 0;
  const currentRecoveryRate = analysis?.recoveryRateNoContentieux || 0;

  // Persist collapse state
  useEffect(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved) setIsCollapsed(saved === 'true');
  }, []);

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebar_collapsed', String(newState));
  };

  // Close sidebar on route change (mobile)
  useEffect(() => {
    if (mobileOpen && onMobileClose) {
      onMobileClose();
    }
  }, [pathname]);

  const sidebarContent = (
    <div className="flex flex-col h-full relative">
      {/* Collapse Toggle Button (Desktop) */}
      <button
        onClick={toggleCollapse}
        className="hidden md:flex absolute -right-3 top-24 z-50 h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm hover:bg-slate-50 transition-all"
      >
        {isCollapsed ? (
          <ChevronRight className="h-3 w-3 text-slate-600" />
        ) : (
          <ChevronLeft className="h-3 w-3 text-slate-600" />
        )}
      </button>

      {/* Header - Dark blue professional */}
      <div className={cn(
        "flex items-center bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden flex-shrink-0 transition-all duration-300",
        isCollapsed ? "h-20 px-2 justify-center" : "h-20 px-6"
      )}>
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm" />
        
        {/* Decorative elements */}
        {!isCollapsed && (
          <>
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-violet-500/20 rounded-full blur-2xl" />
          </>
        )}
        
        <div className={cn(
          "flex items-center gap-4 relative z-10 w-full",
          isCollapsed ? "justify-center" : ""
        )}>
          {/* User Avatar */}
          <Avatar className={cn(
            "border-2 border-white/20 shadow-lg ring-2 ring-blue-500/30 transition-all duration-300",
            isCollapsed ? "h-10 w-10" : "h-12 w-12"
          )}>
            <AvatarImage src="/avatar.png" />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white font-bold text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href="/" className="hover:opacity-80 transition-opacity cursor-pointer truncate">
                  <h1 className="text-lg font-bold text-white tracking-wide truncate">Gestion Clients</h1>
                </Link>
                <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-full shadow-lg flex-shrink-0">
                  MDS
                </span>
              </div>
              <p className="text-xs text-blue-200/80 truncate">{user?.email || 'Gestion des Créances'}</p>
            </div>
          )}
          
          {/* Close button on mobile */}
          {onMobileClose && (
            <Button
              variant="ghost"
              size="sm"
              className="text-white/80 hover:text-white hover:bg-white/10 md:hidden"
              onClick={onMobileClose}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation - Modern cards */}
      <div className={cn(
        "flex-1 overflow-y-auto py-6 transition-all duration-300",
        isCollapsed ? "px-2" : "px-4"
      )}>
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href === '/' && pathname === '/');
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={onMobileClose}
                title={isCollapsed ? item.name : undefined}
                className={cn(
                  "group flex items-center rounded-xl transition-all duration-300",
                  "hover:shadow-lg hover:scale-[1.02]",
                  isCollapsed ? "justify-center px-0 py-2 h-12" : "gap-3 px-4 py-3 text-sm h-auto",
                  isActive 
                    ? "bg-white shadow-lg border-l-4 border-blue-500 text-slate-800" 
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-800"
                )}
              >
                {/* Icon with colored background */}
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl shadow-md transition-transform group-hover:scale-110 flex-shrink-0",
                  item.color,
                  "text-white"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                
                {!isCollapsed && (
                  <>
                    <span className="flex-1 truncate font-semibold">{item.name}</span>
                    {isActive && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      </div>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
        
        {/* Quick Stats Card */}
        <div className={cn(
          "mt-6 rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 text-white shadow-xl relative overflow-hidden border border-white/10 transition-all duration-300",
          isCollapsed ? "p-2" : "p-4"
        )}>
          <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />
          {!isCollapsed && <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-3xl" />}
          
          <div className="relative z-10 space-y-4">
            <div className={cn("flex items-center gap-2 mb-1", isCollapsed ? "justify-center" : "")}>
              <Zap className="h-4 w-4 text-yellow-300 fill-yellow-300" />
              {!isCollapsed && <span className="font-bold text-xs uppercase tracking-wider opacity-90">Performance</span>}
            </div>

            {/* Global Recovery */}
            <div className="space-y-1.5">
              {!isCollapsed && (
                <div className="flex justify-between text-[11px]">
                  <span className="text-blue-100/90">Recouvrement</span>
                  <span className="font-bold">{recoveryRate.toFixed(1)}%</span>
                </div>
              )}
              <div className={cn(
                "bg-white/20 rounded-full overflow-hidden",
                isCollapsed ? "h-8 w-1 flex flex-col justify-end mx-auto" : "h-1.5 w-full"
              )}>
                <div 
                  className={cn(
                    "bg-gradient-to-r from-blue-400 to-blue-300 transition-all duration-1000 shadow-[0_0_8px_rgba(255,255,255,0.4)]",
                    isCollapsed ? "w-full" : "h-full"
                  )} 
                  style={isCollapsed ? { height: `${Math.min(recoveryRate, 100)}%` } : { width: `${Math.min(recoveryRate, 100)}%` }}
                />
              </div>
            </div>

            {/* Current Recovery (Sans Contentieux) */}
            {!isCollapsed && (
              <div className="space-y-1.5 pt-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-emerald-100/90 font-medium italic text-[9px]">Courant</span>
                  <span className="font-bold text-emerald-300">{currentRecoveryRate.toFixed(1)}%</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-green-300 rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(16,185,129,0.4)]" 
                    style={{ width: `${Math.min(currentRecoveryRate, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer - Glassmorphism */}
      <div className={cn(
        "bg-white/80 backdrop-blur-xl border-t border-white/20 flex-shrink-0 transition-all duration-300",
        isCollapsed ? "p-2" : "p-4"
      )}>
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
            {!isCollapsed && (
              <div>
                <div className="text-xs font-bold text-slate-700">Système Actif</div>
                <div className="text-[10px] text-slate-500">v2.0.1 Pro</div>
              </div>
            )}
          </div>
          
          {!isCollapsed && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">© 2026</span>
              <span className="text-[8px] text-slate-400">Mg</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar - always visible */}
      <div className={cn(
        "hidden md:block min-h-screen bg-gray-50 border-r border-gray-200 relative transition-all duration-300 ease-in-out",
        isCollapsed ? "w-20" : "w-72",
        className
      )}>
        {sidebarContent}
      </div>

      {/* Mobile sidebar - overlay drawer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <div className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] bg-gray-50 shadow-2xl md:hidden animate-in slide-in-from-left duration-300">
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
