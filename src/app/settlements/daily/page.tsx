'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Calendar, 
  Filter, 
  RotateCcw,
  ArrowRight,
  TrendingUp,
  Save,
  CheckCircle
} from 'lucide-react';
import { getDailySettlements, saveDailySummary } from '@/actions/settlements';
import { getBillingItems, BillingItem } from '@/actions/billing';
import { MonthSelector } from '@/components/MonthSelector';
import { useSettlementStore } from '@/store/useSettlementStore';

// 날짜 유틸리티: 순수 로컬 시간(KST) 기준으로 문자열 포맷팅
const getKSTToday = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60 * 1000); 
  const kstGap = 9 * 60 * 60 * 1000; 
  return new Date(utc + kstGap);
};

const formatDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const EMPTY_ARRAY: any[] = [];

export default function DailySettlementPage() {
  const { daily, setDailyState, syncDateAcrossPages } = useSettlementStore();
  const { query, data: storeData, isSaved, hasSearched } = daily;
  
  const selectedMonthStr = query.selectedMonth;
  const selectedMonth = new Date(selectedMonthStr);

  const setSelectedMonth = (newDate: Date) => {
    syncDateAcrossPages(newDate.toISOString());
  };

  const getBillingPeriod = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth() - 1, 26);
    const end = new Date(date.getFullYear(), date.getMonth(), 25);
    return { startDate: formatDate(start), endDate: formatDate(end) };
  };

  const { startDate, endDate } = React.useMemo(() => getBillingPeriod(selectedMonth), [selectedMonth]);

  const searchTerm = query.searchTerm;
  const setSearchTerm = (term: string) => setDailyState({ query: { ...query, searchTerm: term } });
  
  const data = storeData || EMPTY_ARRAY;

  const [loading, setLoading] = useState(false);
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);
  const [saving, setSaving] = useState(false);

  const totals = React.useMemo(() => {
    if (data.length > 0) {
      const qSum = data.reduce((acc: number, cur: any) => acc + Number(String(cur.qty).replace(/,/g, '')), 0);
      const wSum = data.reduce((acc: number, cur: any) => acc + Number(String(cur.weight).replace(/,/g, '')), 0);
      return { qty: qSum, weight: wSum };
    }
    return { qty: 0, weight: 0 };
  }, [data]);

  // 단가 정보만 기본 로드
  useEffect(() => {
    const loadBillingItems = async () => {
      const billingRes = await getBillingItems();
      if (billingRes.success && billingRes.data) {
        setBillingItems(billingRes.data);
      }
    };
    loadBillingItems();
  }, []);
  const fetchData = useCallback(async (start: string, end: string, term: string) => {
    setLoading(true);
    const result = await getDailySettlements({ startDate: start, endDate: end, searchTerm: term });
    if (result.success && result.data) {
      setDailyState({ data: result.data, isSaved: !!result.isSaved, hasSearched: true });
    } else {
      setDailyState({ data: [], isSaved: false, hasSearched: true });
    }
    setLoading(false);
  }, [setDailyState]);


  // 조회 버튼 클릭 시 호출
  const handleSearch = () => {
    setDailyState({ isSaved: false });
    fetchData(startDate, endDate, searchTerm);
  };

  const handleSave = async () => {
    if (data.length === 0) return;
    setSaving(true);

    try {
      // 납품처별 요약 데이터 추출
      const summaryItems = matrixData.places.map(place => {
        const price = getPrice(place.name);
        const count = matrixData.placeCounts[place.name] || 0;
        
        // 해당 업체의 실제 배송 발생 일자 리스트 추출
        const deliveryDates = matrixData.dates.filter(date => {
          const val = matrixData.grid[date]?.[place.name];
          return val && val > 0;
        });

        return {
          placeName: place.name,
          deliveryDays: count,
          totalAmount: price * count,
          deliveryDates
        };
      });

      const result = await saveDailySummary({
        startDate,
        endDate,
        items: summaryItems
      });

      if (result.success) {
        setDailyState({ isSaved: true });
        alert('일일 출고 정산 요약 정보가 저장되었습니다.');
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save daily summary:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 당월 (26일 기준): 전월 26일 ~ 당월 25일
  // const setMonthCurrent = (triggerSearch = true) => { ... } is replaced by MonthSelector
  // const setMonthPrevious = () => { ... } is replaced by MonthSelector

  // 매트릭스 데이터 계산 (데이터 변경 시 재계산)
  const matrixData = React.useMemo(() => {
    if (data.length === 0) return { dates: [], places: [], grid: {}, dateTotals: {}, placeTotals: {}, placeCounts: {} };

    // 1. 모든 날짜와 납품처 추출 (중복 제거 및 정렬)
    const dates = Array.from(new Set(data.map(d => d.date))).sort();
    
    // [중요] 납품처명(name) 기준으로 유니크한 납품처 목록 생성 (코드는 무시)
    const placeNames = Array.from(new Set(data.map(d => d.name))).sort();
    
    const places = placeNames.map(name => ({
      name,
      code: data.find(d => d.name === name)?.code || 'UNKNOWN' // 코드는 단순 참조용
    }));

    // 2. 그리드 데이터 구성: grid[날짜][납품처명] = 중량
    const grid: Record<string, Record<string, number>> = {};
    const dateTotals: Record<string, number> = {}; // 날짜별 총합
    const placeTotals: Record<string, number> = {}; // 납품처별 총합
    const placeCounts: Record<string, number> = {}; // 납품처별 납품 일수(건수)

    data.forEach(d => {
      if (!grid[d.date]) grid[d.date] = {};
      
      const weight = Number(String(d.weight).replace(/,/g, ''));
      // 키를 납품처명(d.name)으로 사용
      grid[d.date][d.name] = weight;

      // 합계 계산
      dateTotals[d.date] = (dateTotals[d.date] || 0) + weight;
      placeTotals[d.name] = (placeTotals[d.name] || 0) + weight;
      
      // 납품 일수 카운트
      placeCounts[d.name] = (placeCounts[d.name] || 0) + 1;
    });

    return { dates, places, grid, dateTotals, placeTotals, placeCounts };
  }, [data]);

  // 단가 매핑
  const getPrice = useCallback((name: string) => {
    // billingItems에서 name이 일치하는 항목 찾기
    const item = billingItems.find(bi => bi.name.trim() === name.trim());
    if (!item || !item.rates || item.rates.length === 0) return 0;
    
    // 현재 유효한 단가 (validTo가 null인 항목 또는 가장 최신 항목)
    const currentRate = item.rates.find(r => r.validTo === null) || item.rates[item.rates.length - 1];
    return currentRate.amount;
  }, [billingItems]);

  // 요일별 건수 집계 (정산용 참고 데이터 - 납품처 수 제외, 날짜 기준)
  const dayCounts = React.useMemo(() => {
    let weekday = 0;
    let saturday = 0;
    let sunday = 0;

    // data.forEach 대신 matrixData.dates (유니크한 날짜 목록) 사용
    // 납품처가 10군데라도 날짜는 하루이므로, 날짜 기준으로만 카운트해야 함.
    matrixData.dates.forEach(dateStr => {
      const dateVal = new Date(dateStr);
      const day = dateVal.getDay();

      if (day === 0) sunday++;
      else if (day === 6) saturday++;
      else weekday++;
    });

    return { weekday, saturday, sunday };
  }, [matrixData.dates]);

  return (
    <div className="space-y-2">
      {/* Ultra-Compact Search Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1.5 px-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          {/* Date Picker Range */}
          <div className="flex items-center gap-3">
            <MonthSelector currentDate={selectedMonth} onChange={setSelectedMonth} />
            <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              {startDate} ~ {endDate}
            </span>
          </div>

          {/* Text Search Options Filter */}
          <div className="flex gap-1">
             <input 
              type="text" 
              placeholder="납품처/코드 검색" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="text-[12px] px-3 py-1.5 border border-slate-200 rounded-lg w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1.5">
            <button 
              onClick={handleSearch}
              disabled={loading || saving}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[12px] font-bold hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={13} />} 조회
            </button>
            <button 
              onClick={handleSave}
              disabled={loading || saving || data.length === 0}
              className={`
                px-4 py-1.5 rounded-lg text-[12px] font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50
                ${isSaved 
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}
              `}
            >
              {saving ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                isSaved ? <CheckCircle size={13} /> : <Save size={13} />
              )}
              {isSaved ? '저장됨' : '결과 저장'}
            </button>
            <button 
              onClick={() => {
                const nowKST = getKSTToday();
                syncDateAcrossPages(nowKST.toISOString());
                setDailyState({ query: { selectedMonth: nowKST.toISOString(), searchTerm: '' }, hasSearched: false });
              }}
              className="p-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-md hover:bg-slate-200 transition-all font-bold"
              title="초기화"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Data Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">STATUS</span>
            <h3 className="text-[12px] font-bold text-slate-800 flex items-center gap-3">
              <span>조회 결과 <span className="text-indigo-600 ml-1">{data.length}건</span></span>
              {data.length > 0 && (
                <span className="flex items-center gap-1.5 ml-2">
                  <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 font-medium">평일 {dayCounts.weekday}</span>
                  <span className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100 font-medium">토 {dayCounts.saturday}</span>
                  <span className="text-[11px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-100 font-bold">일 {dayCounts.sunday}</span>
                </span>
              )}
              <span className="text-slate-400 text-[11px] font-normal ml-1">(단위: kg)</span>
            </h3>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-[13px] text-slate-400 font-medium">데이터를 불러오는 중입니다...</p>
              </div>
            </div>
          ) : data.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-50 w-24 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    날짜 \ 납품처
                  </th>
                  {matrixData.places.map(place => (
                    // 키를 place.name으로 사용
                    <th key={place.name} className="min-w-[100px] px-2 py-2 text-center border-r border-slate-100" title={place.name}>
                      <div className="text-[11px] text-slate-500 truncate mb-0.5">{place.name}</div>
                      <div className="text-[15px] font-black text-indigo-600 leading-tight">{matrixData.placeCounts[place.name] || 0}일</div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-30 bg-indigo-50 min-w-[80px] px-2 py-2 text-[11px] font-bold text-indigo-700 uppercase tracking-wider text-center border-l border-indigo-100">
                    합계
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixData.dates.map((date) => (
                  <tr key={date} className="hover:bg-slate-50/80 transition-colors">
                    <td className="sticky left-0 z-20 bg-white group-hover:bg-slate-50 px-4 py-1.5 text-[11px] font-bold text-slate-600 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                      {date}
                    </td>
                    {matrixData.places.map(place => {
                      // 키를 place.name으로 사용
                      const val = matrixData.grid[date]?.[place.name];
                      return (
                        <td key={place.name} className="px-2 py-1.5 text-[11px] text-right border-r border-slate-50 text-slate-600">
                          {val ? val.toLocaleString() : '-'}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-20 bg-indigo-50/30 px-2 py-1.5 text-[11px] font-bold text-right text-indigo-700 border-l border-indigo-100">
                      {(matrixData.dateTotals[date] || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr className="bg-slate-100 font-bold sticky bottom-0 z-20">
                  <td className="sticky left-0 z-30 bg-slate-100 px-4 py-2 text-[11px] text-slate-700 border-r border-slate-200 border-t border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    총계
                  </td>
                  {matrixData.places.map(place => (
                    <td key={place.name} className="px-2 py-2 text-[11px] text-right text-slate-700 border-r border-slate-200 border-t border-slate-300">
                      {(matrixData.placeTotals[place.name] || 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="sticky right-0 z-30 bg-indigo-100 px-2 py-2 text-[11px] text-right text-indigo-800 border-l border-indigo-200 border-t border-indigo-300">
                    {Object.values(matrixData.placeTotals || {}).reduce((a, b) => a + b, 0).toLocaleString()}
                  </td>
                </tr>

                {/* Price Row */}
                <tr className="bg-slate-50/50">
                  <td className="sticky left-0 z-30 bg-slate-50 px-4 py-1.5 text-[10px] font-bold text-slate-400 border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] uppercase">
                    단가
                  </td>
                  {matrixData.places.map(place => (
                    <td key={place.name} className="px-2 py-1.5 text-[11px] text-right text-slate-500 border-r border-slate-100">
                      {getPrice(place.name).toLocaleString()}
                    </td>
                  ))}
                  <td className="sticky right-0 z-30 bg-slate-50/50 px-2 py-1.5 text-right border-l border-slate-100">-</td>
                </tr>

                {/* Total Settlement Amount Row */}
                <tr className="bg-amber-50/30 font-black">
                  <td className="sticky left-0 z-30 bg-amber-50 px-4 py-2 text-[11px] text-amber-900 border-r border-amber-200 border-t border-amber-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    정산 금액
                  </td>
                  {matrixData.places.map(place => {
                    const price = getPrice(place.name);
                    const count = matrixData.placeCounts[place.name] || 0;
                    return (
                      <td key={place.name} className="px-2 py-2 text-[12px] text-right text-amber-700 border-r border-amber-100 border-t border-amber-100 bg-amber-50/20">
                        {(price * count).toLocaleString()}
                      </td>
                    );
                  })}
                  <td className="sticky right-0 z-30 bg-amber-100 px-2 py-2 text-[12px] text-right text-amber-900 border-l border-amber-200 border-t border-amber-200">
                    {matrixData.places.reduce((acc, place) => {
                      const price = getPrice(place.name);
                      const count = matrixData.placeCounts[place.name] || 0;
                      return acc + (price * count);
                    }, 0).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-20">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Search className="text-slate-200" size={32} />
              </div>
              <p className="text-[15px] font-medium text-slate-400">조회된 정산 데이터가 없습니다.</p>
              <p className="text-[12px] text-slate-300 mt-1">청구 비용 입력을 먼저 확인해 주세요.</p>
            </div>
          )}
        </div>

        {/* Total Summary Row (Sticky Bottom) */}
        {!loading && data.length > 0 && (
          <div className="bg-indigo-900 text-white border-t border-indigo-800 px-4 py-2.5 flex items-center sticky bottom-0 z-20 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
            <div className="flex-1 flex justify-end gap-12 items-center">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest">TOTAL SETTLEMENT</span>
                <span className="text-[17px] font-black text-amber-400">
                  {matrixData.places.reduce((acc, place) => {
                    const price = getPrice(place.name);
                    const count = matrixData.placeCounts[place.name] || 0;
                    return acc + (price * count);
                  }, 0).toLocaleString()}
                  <span className="text-[11px] ml-1 font-bold">원</span>
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest">TOTAL QTY</span>
                <span className="text-[15px] font-black">{totals.qty.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest">TOTAL WEIGHT</span>
                <span className="text-[15px] font-black">{totals.weight.toLocaleString()}<span className="text-[10px] ml-1 font-bold">kg</span></span>
              </div>
            </div>
            <div className="w-40 border-l border-indigo-800 ml-8 pl-4 flex items-center">
              <span className="text-[10px] font-medium text-indigo-300">합계 (조회 기준)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
