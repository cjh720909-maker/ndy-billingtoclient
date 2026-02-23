'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  Settings, 
  ChevronRight,
  X,
  CreditCard,
  PenTool,
  Search,
  AlertCircle
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const allMenuItems = [
  { 
    name: '지점청구', 
    enName: 'Branch Billing', 
    href: '/', 
    icon: FileText 
  },
  { 
    name: '1일 출고 정산', 
    enName: 'Daily Settlement', 
    href: '/settlements/daily', 
    icon: CreditCard 
  },
  { 
    name: 'GS출고정산', 
    enName: 'GS Release', 
    href: '/settlements/gs', 
    icon: CreditCard 
  },
  { 
    name: 'GS 피킹비용정산', 
    enName: 'GS Picking', 
    href: '/settlements/gs-picking', 
    icon: CreditCard 
  },
  { 
    name: '청구 비용 관리', 
    enName: 'Billing Management', 
    href: '/billing/input', 
    icon: PenTool 
  },
  { 
    name: '청구 조회', 
    enName: 'Billing Inquiry', 
    href: '/billing/inquiry', 
    icon: Search 
  },
  { 
    name: '긴급 출고 조회', 
    enName: 'Emergency Shipment', 
    href: '/billing/emergency', 
    icon: AlertCircle 
  },
];

// 사이드바에 표시될 메뉴 (사용자 요청에 따라 전체 노출)
export const menuItems = allMenuItems;

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-indigo-900 text-white transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo Area */}
        <div className="flex h-20 items-center justify-between px-6 bg-indigo-950">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-400 rounded-lg flex items-center justify-center">
              <span className="text-indigo-950 font-bold text-xl">N</span>
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">NDY Billing</h1>
              <p className="text-[10px] text-indigo-300 font-medium">Logistics Solutions</p>
            </div>
          </div>
          <button onClick={onClose} className="text-indigo-300 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-6 px-3 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center justify-between px-3 py-2.5 rounded-lg transition-all duration-200 group
                  ${isActive 
                    ? 'bg-indigo-800 shadow-lg text-white' 
                    : 'text-indigo-200 hover:bg-white/5 hover:text-white'}
                `}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-amber-400' : 'text-indigo-300 group-hover:text-white'} />
                  <div>
                    <div className="text-[13px] font-medium">{item.name}</div>
                    <div className="text-[10px] opacity-60 font-medium uppercase tracking-wider">{item.enName}</div>
                  </div>
                </div>
                {isActive && <ChevronRight size={14} className="text-amber-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Footer Info */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="p-4 bg-indigo-950/50 rounded-xl border border-indigo-800/50">
            <p className="text-[11px] text-indigo-400 font-bold uppercase mb-1">Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[12px] font-medium text-indigo-100">System Online</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
