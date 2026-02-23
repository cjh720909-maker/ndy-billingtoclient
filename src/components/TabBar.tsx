'use client';

import React from 'react';
import { X, Home } from 'lucide-react';

export interface Tab {
  path: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabPath: string;
  onCloseTab: (path: string) => void;
  onTabClick: (path: string) => void;
}

export function TabBar({ tabs, activeTabPath, onCloseTab, onTabClick }: TabBarProps) {
  return (
    <div className="flex items-center w-full bg-slate-200 border-b border-slate-300 pt-2 px-2 gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.path === activeTabPath;
        return (
          <div
            key={tab.path}
            className={`
              group flex items-center gap-2 px-4 py-2 rounded-t-lg cursor-pointer text-sm font-medium transition-all select-none min-w-[120px] max-w-[200px] justify-between relative
              ${isActive
                ? 'bg-white text-indigo-900 border-x border-t border-slate-300 shadow-sm z-10 -mb-px'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-50 hover:text-slate-700 border-transparent mb-0'
              }
            `}
            onClick={() => onTabClick(tab.path)}
          >
            <span className="whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1.5 flex-1">
               {tab.path === '/' && <Home size={14} className={isActive ? "text-indigo-600 shrink-0" : "text-slate-400 shrink-0"} />}
               {tab.label}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.path);
              }}
              className={`
                p-0.5 rounded-full transition-opacity flex-shrink-0
                ${isActive 
                  ? 'bg-transparent hover:bg-slate-100 text-slate-400 hover:text-red-500 opacity-100' 
                  : 'bg-transparent hover:bg-slate-200 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100'
                }
              `}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
