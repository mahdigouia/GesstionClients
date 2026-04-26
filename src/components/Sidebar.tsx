'use client';

import { useState } from 'react';
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
  Mic
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, color: 'bg-blue-500' },
  { name: 'Clients', href: '/clients', icon: Users, color: 'bg-emerald-500' },
  { name: 'Factures', href: '/invoices', icon: FileText, color: 'bg-violet-500' },
  { name: 'Analyse', href: '/analysis', icon: BarChart3, color: 'bg-amber-500' },
  { name: 'Assistant Vocal', href: '#voice', icon: Mic, color: 'bg-pink-500', special: true },
  { name: 'Contentieux', href: '/contentieux', icon: Scale, color: 'bg-red-500' },
  { name: 'Import OCR', href: '/import', icon: Upload, color: 'bg-cyan-500' },
  { name: 'Paramètres', href: '/settings', icon: Settings, color: 'bg-gray-500' },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={cn(
      "pb-12 min-h-screen bg-gray-50 border-r border-gray-200",
      className
    )}>
      {/* Header - Dark blue professional */}
      <div className="flex h-20 items-center px-6 bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
        {/* Glassmorphism overlay */}
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm" />
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-violet-500/20 rounded-full blur-2xl" />
        
        <div className="flex items-center gap-4 relative z-10 w-full">
          {/* User Avatar */}
          <Avatar className="h-12 w-12 border-2 border-white/20 shadow-lg ring-2 ring-blue-500/30">
            <AvatarImage src="/avatar.png" />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-600 text-white font-bold text-lg">
              AD
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white tracking-wide">GesstionClients</h1>
              <span className="px-2 py-0.5 text-xs font-bold bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-full shadow-lg flex items-center gap-1">
                <Crown className="h-3 w-3" />
                PRO
              </span>
            </div>
            <p className="text-xs text-blue-200/80">Gestion des Créances</p>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Navigation - Modern cards */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href || (item.href === '/' && pathname === '/');
            const Icon = item.icon;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-300",
                  "hover:shadow-lg hover:scale-[1.02]",
                  isActive 
                    ? "bg-white shadow-lg border-l-4 border-blue-500 text-slate-800" 
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-800"
                )}
              >
                {/* Icon with colored background */}
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl shadow-md transition-transform group-hover:scale-110",
                  item.color,
                  "text-white"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                
                <span className="flex-1 truncate font-semibold">{item.name}</span>
                
                {isActive && (
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  </div>
                )}
                
                {item.special && (
                  <span className="px-2 py-0.5 text-xs font-bold bg-pink-100 text-pink-600 rounded-full">
                    NEW
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        
        {/* Quick Stats Card */}
        <div className="mt-6 p-4 rounded-2xl bg-gradient-to-br from-blue-600 to-violet-600 text-white shadow-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-white/10 backdrop-blur-sm" />
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/20 rounded-full blur-2xl" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-5 w-5 text-yellow-300" />
              <span className="font-bold text-sm">Performance</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-blue-100">Taux Recouv.</span>
                <span className="font-bold">85%</span>
              </div>
              <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full w-[85%] bg-gradient-to-r from-green-400 to-emerald-500 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer - Glassmorphism */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700">Système Actif</div>
              <div className="text-[10px] text-slate-500">v2.0.1 Pro</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">© 2024</span>
          </div>
        </div>
      </div>
    </div>
  );
}
