'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RotateCcw,
  ArrowRight
} from 'lucide-react';
import { getDailySettlements } from '@/actions/settlements';

export default function GSPickingSettlementPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ qty: 0 });

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

  useEffect(() => {
    // sessionStorage에서 이전 상태 복구
    const savedFilter = sessionStorage.getItem('gs-picking-filter');
    const savedData = sessionStorage.getItem('gs-picking-data');
    
    if (savedFilter) {
      const { start, end, term } = JSON.parse(savedFilter);
      setStartDate(start);
      setEndDate(end);
      setSearchTerm(term);
      
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setData(parsedData);
        const qSum = parsedData.reduce((acc: number, cur: any) => acc + Number(String(cur.qty).replace(/,/g, '')), 0);
        setTotals({ qty: qSum });
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
  }, []);

  const fetchData = async (start: string, end: string, term: string) => {
    setLoading(true);
    const result = await getDailySettlements({ 
      startDate: start, 
      endDate: end, 
      searchTerm: term,
      type: 'gs-picking' 
    });
    if (result.success && result.data) {
      setData(result.data);
      const qSum = result.data.reduce((acc: number, cur: any) => acc + Number(String(cur.qty).replace(/,/g, '')), 0);
      setTotals({ qty: qSum });
      
      // 상태 저장
      sessionStorage.setItem('gs-picking-filter', JSON.stringify({ start, end, term }));
      sessionStorage.setItem('gs-picking-data', JSON.stringify(result.data));
    } else {
      setData([]);
      setTotals({ qty: 0 });
      sessionStorage.removeItem('gs-picking-data');
    }
    setLoading(false);
  };

  const handleSearch = () => {
    fetchData(startDate, endDate, searchTerm);
  };

  const setMonthCurrent = () => {
    const today = getKSTToday();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(today));
  };

  const setMonthPrevious = () => {
    const today = getKSTToday();
    const firstDayPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayPrev = new Date(today.getFullYear(), today.getMonth(), 0); 
    setStartDate(formatDate(firstDayPrev));
    setEndDate(formatDate(lastDayPrev));
  };

  const setPayCycleRange = () => {
    const today = getKSTToday();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 26);
    const end = new Date(today.getFullYear(), today.getMonth(), 25);
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

  // 피벗 매트릭스 데이터 가공
  const matrixData = React.useMemo(() => {
    if (data.length === 0) return { 
      dates: [], places: [], grid: {}, dateTotals: {}, placeTotals: {}, settlementInfo: {} as Record<string, { amount: number; pallets: number; qty: number }> 
    };

    const dates = Array.from(new Set(data.map(d => d.date))).sort();
    const placeCodes = Array.from(new Set(data.map(d => d.code))).sort();
    const places = placeCodes.map(code => ({
      code,
      name: data.find(d => d.code === code)?.name || 'UNKNOWN'
    }));

    const grid: Record<string, Record<string, number>> = {};
    const dateTotals: Record<string, number> = {}; 
    const placeTotals: Record<string, number> = {}; 

    data.forEach(d => {
      if (!grid[d.date]) grid[d.date] = {};
      const qty = Number(String(d.qty).replace(/,/g, ''));
      grid[d.date][d.code] = (grid[d.date][d.code] || 0) + qty;
      dateTotals[d.date] = (dateTotals[d.date] || 0) + qty;
      placeTotals[d.code] = (placeTotals[d.code] || 0) + qty;
    });

    const settlementInfo: Record<string, { amount: number; pallets: number; qty: number }> = {};
    dates.forEach(date => {
      let dailyAmount = 0;
      let dailyPallets = 0;
      let dailyQty = 0;
      placeCodes.forEach(code => {
        const qty = grid[date]?.[code] || 0;
        dailyQty += qty;
        if (qty > 0) {
          const pallets = Math.ceil(qty / 78);
          dailyPallets += pallets;
        }
      });
      dailyAmount = dailyPallets * 8000;
      settlementInfo[date] = { amount: dailyAmount, pallets: dailyPallets, qty: dailyQty };
    });

    return { dates, places, grid, dateTotals, placeTotals, settlementInfo };
  }, [data]);

  const dayCounts = React.useMemo(() => {
    let weekday = 0, saturday = 0, sunday = 0;
    matrixData.dates.forEach(dateStr => {
      const day = new Date(dateStr).getDay();
      if (day === 0) sunday++;
      else if (day === 6) saturday++;
      else weekday++;
    });
    return { weekday, saturday, sunday };
  }, [matrixData.dates]);

  return (
    <div className="space-y-2">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1.5 px-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg focus-within:border-indigo-400 focus-within:bg-white transition-all">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent border-none text-[12px] text-slate-700 focus:ring-0 w-[110px] outline-none" />
              <ArrowRight size={12} className="text-slate-300" />
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent border-none text-[12px] text-slate-700 focus:ring-0 w-[110px] outline-none" />
            </div>
            <div className="flex gap-1">
              <button onClick={setMonthCurrent} className="px-1.5 py-1 bg-white text-slate-500 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50">당월</button>
              <button onClick={setMonthPrevious} className="px-1.5 py-1 bg-white text-slate-500 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50">전월</button>
              <button onClick={setPayCycleRange} className="px-1.5 py-1 bg-white text-slate-500 text-[10px] font-bold rounded border border-slate-200 hover:bg-slate-50">25일</button>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button onClick={handleSearch} disabled={loading} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[12px] font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
              {loading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={13} />} 조회
            </button>
            <button onClick={() => {setMonthCurrent(); fetchData(startDate, endDate, '');}} className="p-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-md hover:bg-slate-200"><RotateCcw size={14} /></button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">STATUS</span>
            <h3 className="text-[12px] font-bold text-slate-800 flex items-center gap-3">
              <span>피킹 비용 조회 결과 <span className="text-indigo-600 ml-1">{data.length}건</span></span>
              {data.length > 0 && (
                <span className="flex items-center gap-1.5 ml-2">
                  <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">평일 {dayCounts.weekday}</span>
                  <span className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100">토 {dayCounts.saturday}</span>
                  <span className="text-[11px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-100 font-bold">일 {dayCounts.sunday}</span>
                </span>
              )}
            </h3>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full"><div className="w-8 h-8 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" /></div>
          ) : data.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 bg-slate-50 w-24 px-4 py-2 text-[11px] font-bold text-slate-500 border-r border-slate-200" rowSpan={2}>날짜 \ 센터</th>
                  {matrixData.places.map(place => (
                    <th key={place.code} colSpan={2} className="min-w-[120px] px-2 py-1 text-center border-r border-slate-200 bg-slate-50/80">
                      <div className="text-[9px] text-slate-400 font-normal">{place.code}</div>
                      <div className="text-[11px] text-slate-600 truncate">{place.name}</div>
                    </th>
                  ))}
                  <th className="sticky right-[180px] z-30 bg-indigo-50 min-w-[80px] px-2 py-2 text-[11px] font-bold text-indigo-700 text-center border-l border-indigo-100" rowSpan={2}>합계(Box)</th>
                  <th className="sticky right-[100px] z-30 bg-emerald-50 min-w-[80px] px-2 py-2 text-[11px] font-bold text-emerald-700 text-center border-l border-emerald-100" rowSpan={2}>파렛트(PL)</th>
                  <th className="sticky right-0 z-30 bg-amber-50 min-w-[100px] px-2 py-2 text-[11px] font-bold text-amber-700 text-center border-l border-amber-100" rowSpan={2}>정산금액</th>
                </tr>
                <tr className="bg-slate-50/50 border-b border-slate-200">
                  {matrixData.places.map(place => (
                    <React.Fragment key={`sub-${place.code}`}>
                      <th className="px-1 py-1 text-[9px] text-slate-400 text-center border-r border-slate-100 min-w-[60px]">BOX</th>
                      <th className="px-1 py-1 text-[9px] text-indigo-400 text-center border-r border-slate-200 min-w-[40px]">PL</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {matrixData.dates.map((date) => (
                  <tr key={date} className="hover:bg-slate-50/80 transition-colors">
                    <td className="sticky left-0 z-20 bg-white px-4 py-1.5 text-[11px] font-bold text-slate-600 border-r border-slate-200">{date}</td>
                    {matrixData.places.map(place => {
                      const qty = matrixData.grid[date]?.[place.code] || 0;
                      const pl = qty > 0 ? Math.ceil(qty / 78) : 0;
                      return (
                        <React.Fragment key={`${date}-${place.code}`}>
                          <td className="px-2 py-1.5 text-[11px] text-right border-r border-slate-50">{qty > 0 ? qty.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 }) : '-'}</td>
                          <td className="px-2 py-1.5 text-[11px] text-center border-r border-slate-100 bg-indigo-50/20 text-indigo-600 font-medium">{pl > 0 ? `${pl} PL` : '-'}</td>
                        </React.Fragment>
                      );
                    })}
                    <td className="sticky right-[180px] z-20 bg-indigo-50/30 px-2 py-1.5 text-[11px] font-bold text-right border-l border-indigo-100">{(matrixData.settlementInfo[date]?.qty || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    <td className="sticky right-[100px] z-20 bg-emerald-50/20 px-2 py-1.5 text-[11px] font-bold text-center border-l border-emerald-100">{matrixData.settlementInfo[date]?.pallets || 0} PL</td>
                    <td className="sticky right-0 z-20 bg-amber-50/20 px-2 py-1.5 text-[11px] font-black text-right text-amber-700 border-l border-amber-100">{(matrixData.settlementInfo[date]?.amount || 0).toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-slate-100 font-bold sticky bottom-0 z-20">
                  <td className="sticky left-0 z-30 bg-slate-100 px-4 py-2 text-[11px] text-slate-700 border-r border-slate-200">총계</td>
                  {matrixData.places.map(place => {
                    const totalQty = matrixData.placeTotals[place.code] || 0;
                    // 총계의 파렛트 합산은 각 날짜별 파렛트의 합이어야 함 (단순 총박스/78 아님)
                    const totalPL = matrixData.dates.reduce((acc, date) => {
                      const dayQty = matrixData.grid[date]?.[place.code] || 0;
                      return acc + (dayQty > 0 ? Math.ceil(dayQty / 78) : 0);
                    }, 0);
                    return (
                      <React.Fragment key={`total-${place.code}`}>
                        <td className="px-2 py-2 text-[11px] text-right border-r border-slate-200">{totalQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="px-2 py-2 text-[11px] text-center border-r border-slate-300 bg-indigo-100/50 text-indigo-700">{totalPL.toLocaleString()} PL</td>
                      </React.Fragment>
                    );
                  })}
                  <td className="sticky right-[180px] z-30 bg-indigo-100 px-2 py-2 text-[11px] text-right border-l border-indigo-200">{Object.values(matrixData.settlementInfo).reduce((a, b) => a + b.qty, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                  <td className="sticky right-[100px] z-30 bg-emerald-100 px-2 py-2 text-[11px] text-center border-l border-emerald-200">{Object.values(matrixData.settlementInfo).reduce((acc, cur) => acc + cur.pallets, 0).toLocaleString()} PL</td>
                  <td className="sticky right-0 z-30 bg-amber-100 px-2 py-2 text-[11px] text-right border-l border-amber-200">{Object.values(matrixData.settlementInfo).reduce((acc, cur) => acc + cur.amount, 0).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-20 text-slate-400">데이터가 없습니다.</div>
          )}
        </div>

        {!loading && data.length > 0 && (
          <div className="bg-indigo-900 text-white px-4 py-2.5 flex justify-end gap-12 sticky bottom-0 z-20">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-indigo-300">TOTAL QTY</span>
              <span className="text-[15px] font-black">{totals.qty.toLocaleString()} 박스</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
