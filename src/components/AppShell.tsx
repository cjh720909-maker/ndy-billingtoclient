'use client';

import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 font-sans">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className={`flex flex-col flex-1 min-w-0 transition-all duration-300 ease-in-out ${sidebarOpen ? 'lg:pl-64' : 'pl-0'}`}>
        {/* Global Hamburger Button */}
        {!sidebarOpen && (
          <button
            type="button"
            className="fixed top-4 left-4 z-50 p-2 text-indigo-900 bg-white/80 backdrop-blur-sm rounded-lg shadow-sm border border-slate-200 hover:bg-white transition-all transition-opacity duration-300"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
        )}
        <main className="flex-1 overflow-x-hidden p-4 md:p-6 pb-12">
          {children}
        </main>
      </div>
    </div>
  );
}
