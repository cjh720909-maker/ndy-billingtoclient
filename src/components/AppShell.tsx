'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar, menuItems, allMenuItems } from './Sidebar';
import { TabBar, Tab } from './TabBar';
import { Menu } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  // Tab State
  const [tabs, setTabs] = useState<Tab[]>([]);
  // 페이지 컴포넌트 캐시 (상태 유지용)
  const [pageCache, setPageCache] = useState<Record<string, React.ReactNode>>({});

  // 현재 경로의 children을 캐시에 저장 (상태 유지용)
  // [개선] identity 기반 remount 방지: 캐시에 없을 때만 한 번 저장
  useEffect(() => {
    if (children && pathname && !pageCache[pathname]) {
      setPageCache(prev => {
        if (prev[pathname]) return prev;
        return { ...prev, [pathname]: children };
      });
    }
  }, [pathname, children, pageCache]);

  // 현재 경로를 탭 목록에 추가
  useEffect(() => {
    setTabs(prev => {
      if (prev.some(t => t.path === pathname)) return prev;

      const menuItem = allMenuItems.find(item => item.href === pathname);
      let label = menuItem ? menuItem.name : 'Page';

      if (!menuItem && pathname === '/') label = '지점청구';
      
      return [...prev, { path: pathname, label }];
    });
  }, [pathname]);

  const handleCloseTab = (path: string) => {
    // Prevent closing the last tab if you want to force at least one, 
    // but usually browsers allow closing all (showing blank or home). 
    // Let's redirect to home if all closed.
    
    setTabs(prev => {
      const newTabs = prev.filter(t => t.path !== path);
      
      if (path === pathname) {
        // Closed active tab
        if (newTabs.length > 0) {
          // Switch to the last opened tab (or adjacent). 
          // Browser behavior: usually adjacent. Here simply last one for now.
          const lastTab = newTabs[newTabs.length - 1];
          router.push(lastTab.path);
        } else {
          router.push('/');
        }
      }
      setPageCache(prev => {
        const next = { ...prev };
        delete next[path];
        return next;
      });

      return newTabs;
    });
  };

  const handleTabClick = (path: string) => {
    router.push(path);
  };

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
        
        {/* Tab Bar */}
        <div className="flex-none">
          <TabBar 
            tabs={tabs} 
            activeTabPath={pathname} 
            onCloseTab={handleCloseTab} 
            onTabClick={handleTabClick} 
          />
        </div>

        <main className="flex-1 overflow-x-hidden p-4 md:p-6 pb-12 overflow-y-auto relative">
          {/* 
            탭 상태 유지를 위해 방문한 모든 페이지의 컴포넌트 인스턴스를 DOM상에 유지(hidden/block)합니다.
            핵심: 'pageCache'에 저장된 최초의 컴포넌트 인스턴스를 계속 사용함으로써 
            React가 컴포넌트를 언마운트하고 다시 그리는(상태 소실) 것을 방지합니다.
          */}
          
          {allMenuItems.map((item) => {
            const isCurrent = (item.href === pathname);
            const cachedComponent = pageCache[item.href];
            
            // [핵심] 재마운트 방지 로직:
            // 1. 현재 탭인데 아직 캐시에 없으면 props로 전달받은 children을 사용
            // 2. 이미 캐시에 존재한다면 (현재 탭이든 아니든) 반드시 캐시된 인스턴스를 사용
            // 이렇게 함으로써 setPageCache가 완료된 후에도 컴포넌트 identity가 유지되어 Re-mount를 방지함.
            const content = cachedComponent || (isCurrent ? children : null);
            
            if (!content) return null;

            return (
              <div 
                key={item.href} 
                className={isCurrent ? 'block h-full' : 'hidden'}
              >
                {content}
              </div>
            );
          })}

          {/* 메뉴 항목에 등록되지 않은 동적 경로 또는 특수 경로 처리 (위 루프에서 누락된 경우만) */}
          {!allMenuItems.some(item => item.href === pathname) && (
            <div key={pathname} className="block h-full">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
