import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---------------------------------------------------------
// Types & Interfaces
// ---------------------------------------------------------

export interface CommonSearchQuery {
  selectedMonth: string; // ISO string format (e.g. from getKSTToday())
  searchTerm: string;
}

export interface IntegratedData {
  daily: any[];
  gs: any | null;
  emergency: any[];
  inquiry: any[];
  fixed: any[];
}

export interface PageState<T> {
  query: CommonSearchQuery;
  data: T | null;
  isSaved?: boolean;
  hasSearched: boolean; // 조회 이력이 있는지 여부
}

export interface SettlementStore {
  // 1. 지점청구 통합 (Main Dashboard)
  integrated: PageState<IntegratedData>;
  setIntegratedState: (state: Partial<PageState<IntegratedData>>) => void;

  // 2. 1일 출고 정산 (Daily)
  daily: PageState<any[]>;
  setDailyState: (state: Partial<PageState<any[]>>) => void;

  // 3. GS 출고 정산 (GS)
  gs: PageState<any[]>;
  setGsState: (state: Partial<PageState<any[]>>) => void;

  // 4. 긴급 출고 (Emergency)
  emergency: PageState<any[]>;
  setEmergencyState: (state: Partial<PageState<any[]>>) => void;

  // 5. 청구 조회 (Inquiry)
  inquiry: PageState<any[]>;
  setInquiryState: (state: Partial<PageState<any[]>>) => void;

  // Global actions
  resetAll: () => void;
  syncDateAcrossPages: (monthStr: string) => void;
}

// ---------------------------------------------------------
// Initial States
// ---------------------------------------------------------

const getInitialQuery = (): CommonSearchQuery => {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(now.getTime() + kstOffset);
  return { selectedMonth: kstDate.toISOString(), searchTerm: '' };
};

const defaultPageState = <T>(): PageState<T> => ({
  query: getInitialQuery(),
  data: null,
  isSaved: false,
  hasSearched: false,
});

// ---------------------------------------------------------
// Store Creation
// ---------------------------------------------------------

export const useSettlementStore = create<SettlementStore>()(
  persist(
    (set, get) => ({
      integrated: defaultPageState<IntegratedData>(),
      setIntegratedState: (update) => set((state) => ({ integrated: { ...state.integrated, ...update } })),

      daily: defaultPageState<any[]>(),
      setDailyState: (update) => set((state) => ({ daily: { ...state.daily, ...update } })),

      gs: defaultPageState<any[]>(),
      setGsState: (update) => set((state) => ({ gs: { ...state.gs, ...update } })),

      emergency: defaultPageState<any[]>(),
      setEmergencyState: (update) => set((state) => ({ emergency: { ...state.emergency, ...update } })),

      inquiry: defaultPageState<any[]>(),
      setInquiryState: (update) => set((state) => ({ inquiry: { ...state.inquiry, ...update } })),

      resetAll: () => set({
        integrated: defaultPageState<IntegratedData>(),
        daily: defaultPageState<any[]>(),
        gs: defaultPageState<any[]>(),
        emergency: defaultPageState<any[]>(),
        inquiry: defaultPageState<any[]>(),
      }),

      // 날짜 변경 시 모든 페이지의 상태 유지를 해제하고 날짜만 동기화
      syncDateAcrossPages: (monthStr: string) => set((state) => ({
        integrated: { ...state.integrated, query: { ...state.integrated.query, selectedMonth: monthStr }, hasSearched: false, data: null },
        daily: { ...state.daily, query: { ...state.daily.query, selectedMonth: monthStr }, hasSearched: false, data: null },
        gs: { ...state.gs, query: { ...state.gs.query, selectedMonth: monthStr }, hasSearched: false, data: null },
        emergency: { ...state.emergency, query: { ...state.emergency.query, selectedMonth: monthStr }, hasSearched: false, data: null },
        inquiry: { ...state.inquiry, query: { ...state.inquiry.query, selectedMonth: monthStr }, hasSearched: false, data: null },
      })),
    }),
    {
      name: 'ndy-settlement-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
