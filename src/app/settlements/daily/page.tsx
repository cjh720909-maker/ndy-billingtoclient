'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Calendar, 
  Filter, 
  RotateCcw,
  ArrowRight,
  TrendingUp
} from 'lucide-react';
import { getDailySettlements } from '@/actions/settlements';
import { getBillingItems, BillingItem } from '@/actions/billing';

export default function DailySettlementPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<any[]>([]); // 초기엔 빈 상태
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ qty: 0, weight: 0 });
  const [billingItems, setBillingItems] = useState<BillingItem[]>([]);

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

  // 초기 날짜 설정 및 상태 복구
  useEffect(() => {
    const loadInitialData = async () => {
      // 1. 단가 정보 로드 (항상 최신 유지)
      const billingRes = await getBillingItems();
      if (billingRes.success && billingRes.data) {
        setBillingItems(billingRes.data);
      }

      // 2. sessionStorage에서 이전 상태 복구
      const savedFilter = sessionStorage.getItem('daily-settlement-filter');
      const savedData = sessionStorage.getItem('daily-settlement-data');
      
      if (savedFilter) {
        const { start, end, term } = JSON.parse(savedFilter);
        setStartDate(start);
        setEndDate(end);
        setSearchTerm(term);
        
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          setData(parsedData);
          const qSum = parsedData.reduce((acc: number, cur: any) => acc + Number(String(cur.qty).replace(/,/g, '')), 0);
          const wSum = parsedData.reduce((acc: number, cur: any) => acc + Number(String(cur.weight).replace(/,/g, '')), 0);
          setTotals({ qty: qSum, weight: wSum });
        } else {
          fetchData(start, end, term);
        }
      } else {
        const today = getKSTToday();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const startStr = formatDate(firstDay);
        const endStr = formatDate(today);
        
        setStartDate(startStr);
        setEndDate(endStr);
        fetchData(startStr, endStr, '');
      }
    };
    
    loadInitialData();
  }, []);

  const fetchData = async (start: string, end: string, term: string) => {
    setLoading(true);
    const result = await getDailySettlements({ startDate: start, endDate: end, searchTerm: term });
    if (result.success && result.data) {
      setData(result.data);
      const qSum = result.data.reduce((acc: number, cur: any) => acc + Number(String(cur.qty).replace(/,/g, '')), 0);
      const wSum = result.data.reduce((acc: number, cur: any) => acc + Number(String(cur.weight).replace(/,/g, '')), 0);
      setTotals({ qty: qSum, weight: wSum });
      
      // 상태 저장
      sessionStorage.setItem('daily-settlement-filter', JSON.stringify({ start, end, term }));
      sessionStorage.setItem('daily-settlement-data', JSON.stringify(result.data));
    } else {
      setData([]);
      setTotals({ qty: 0, weight: 0 });
      sessionStorage.removeItem('daily-settlement-data');
    }
    setLoading(false);
  };

  // 조회 버튼 클릭 시 호출
  const handleSearch = () => {
    fetchData(startDate, endDate, searchTerm);
  };

  // 당월: 이번 달 1일 ~ 오늘
  const setMonthCurrent = () => {
    const today = getKSTToday();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(today));
    // 버튼 클릭 시 날짜만 변경
  };

  // 전월: 지난 달 1일 ~ 지난 달 말일
  const setMonthPrevious = () => {
    const today = getKSTToday();
    const firstDayPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayPrev = new Date(today.getFullYear(), today.getMonth(), 0); // 이번 달 0일 = 지난 달 말일
    
    setStartDate(formatDate(firstDayPrev));
    setEndDate(formatDate(lastDayPrev));
  };

  // 25일 기준: 전월 26일 ~ 당월 25일
  const setPayCycleRange = () => {
    const today = getKSTToday();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 26);
    const end = new Date(today.getFullYear(), today.getMonth(), 25);
    
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus-within:border-indigo-400 focus-within:bg-white transition-all">
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-[12px] text-slate-700 focus:ring-0 w-[110px] outline-none" 
              />
              <ArrowRight size={12} className="text-slate-300" />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-[12px] text-slate-700 focus:ring-0 w-[110px] outline-none" 
              />
            </div>
            <div className="flex gap-1">
              <button onClick={setMonthCurrent} className="px-1.5 py-1 bg-white text-slate-500 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50 transition-colors">당월</button>
              <button onClick={setMonthPrevious} className="px-1.5 py-1 bg-white text-slate-500 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50 transition-colors">전월</button>
              <button onClick={setPayCycleRange} className="px-1.5 py-1 bg-white text-slate-500 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50 transition-colors">25일</button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-1.5">
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[12px] font-bold hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={13} />} 조회
            </button>
            <button 
              onClick={() => {setMonthCurrent(); fetchData(startDate, endDate, '');}}
              className="p-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-md hover:bg-slate-200 transition-all"
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
