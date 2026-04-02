'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Search, 
  Calendar, 
  RotateCcw,
  ArrowRight,
  Save,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { getDailySettlements, saveGSSettlements, saveGSSummary } from '@/actions/settlements';
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

export default function GSReleaseSettlementPage() {
  const { gs, setGsState, syncDateAcrossPages } = useSettlementStore();
  const { query, data: storeData, isSaved: isSavedData, hasSearched } = gs;

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
  const setSearchTerm = (term: string) => setGsState({ query: { ...query, searchTerm: term } });
  
  const data = storeData || EMPTY_ARRAY;

  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // 편집 상태 관리 (key: date_code, value: 수정된 필드들)
  const [editState, setEditState] = useState<Record<string, any>>({});
  
  // 날짜별 세부내역 및 비고 등 수정 상태
  const [dateDetails, setDateDetails] = useState<Record<string, { amount: number; details: string; remarks: string }>>({});

  const totals = React.useMemo(() => {
    if (data.length > 0) {
      const qSum = data.reduce((acc: number, cur: any) => acc + Number(String(cur.qty).replace(/,/g, '')), 0);
      const wSum = data.reduce((acc: number, cur: any) => acc + Number(String(cur.weight).replace(/,/g, '')), 0);
      return { qty: qSum, weight: wSum };
    }
    return { qty: 0, weight: 0 };
  }, [data]);

  const fetchData = useCallback(async (start: string, end: string, term: string) => {
    setLoading(true);
    setHasChanges(false);
    setEditState({});

    const result = await getDailySettlements({ 
      startDate: start, 
      endDate: end, 
      searchTerm: term,
      type: 'gs' 
    });
    
    if (result.success && result.data) {
      setGsState({ data: result.data, isSaved: !!result.isSaved, hasSearched: true });
      if (result.dateDetails && Object.keys(result.dateDetails).length > 0) {
        setDateDetails(result.dateDetails);
      } else {
        setDateDetails({}); // reset
      }
    } else {
      setGsState({ data: [], isSaved: false, hasSearched: true });
    }
    setLoading(false);
  }, [setGsState]);


  const handleSave = async () => {
    if (data.length === 0) return;
    setSaving(true);
    
    const mergedDetails: any = {};
    matrixData.dates.forEach(date => {
       const existing = dateDetails[date];
       mergedDetails[date] = {
         amount: existing?.amount !== undefined ? existing.amount : (matrixData.settlementInfo[date]?.amount || 0),
         details: existing?.details !== undefined ? existing.details : (matrixData.settlementInfo[date]?.details || ''),
         remarks: existing?.remarks !== undefined ? existing.remarks : ''
       };
    });

    // 요약 데이터 생성
    const summary = {
      weekday: summaryInfo.weekday,
      saturday: summaryInfo.saturday,
      sunday: summaryInfo.sunday,
      extraTrucks: summaryInfo.totalExtraTrucks,
      totalAmount: summaryInfo.totalAmount,
      dates: matrixData.dates,
      dateDetails: mergedDetails
    };
    
    const [summaryResult, dataResult] = await Promise.all([
      saveGSSummary({
        startDate,
        endDate,
        summary
      }),
      saveGSSettlements(data)
    ]);
    
    if (summaryResult.success && dataResult.success) {
      setGsState({ isSaved: true });
      setHasChanges(false);
      alert('정산 정보가 저장되었습니다.');
      fetchData(startDate, endDate, searchTerm);
    } else {
      alert('저장에 실패했습니다.');
    }
    setSaving(false);
  };

  // 조회 버튼 클릭 시 호출
  const handleSearch = () => {
    setGsState({ isSaved: false });
    fetchData(startDate, endDate, searchTerm);
  };

  // 값 변경 핸들러
  const handleCellChange = (date: string, code: string, field: string, value: string) => {
    const key = `${date}_${code}`;
    
    setEditState(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value
      }
    }));
    // data 상태에도 반영하여 즉시 UI 업데이트 (입력 반응성)
    const newData = data.map(item => {
      if (item.date === date && item.code === code) {
        return {
          ...item,
          [field]: value 
        };
      }
      return item;
    });
    setGsState({ data: newData });
    
    setHasChanges(true);
  };

  const handleDateDetailChange = (date: string, field: 'amount' | 'details' | 'remarks', value: string) => {
    setDateDetails(prev => {
      const prevEntry = prev[date] || {
        amount: matrixData.settlementInfo[date]?.amount || 0, 
        details: matrixData.settlementInfo[date]?.details || '', 
        remarks: ''
      };

      let newAmount = prevEntry.amount;
      if (field === 'details') {
        const parts = value.split('+').map(p => parseFloat(p.trim())).filter(n => !isNaN(n));
        newAmount = parts.reduce((acc, curr) => acc + curr * 10000, 0);
      } else if (field === 'amount') {
        newAmount = Number(value.replace(/,/g, '')) || 0;
      }

      return {
        ...prev,
        [date]: {
          ...prevEntry,
          [field]: field === 'amount' ? newAmount : value,
          ...(field === 'details' ? { amount: newAmount } : {})
        }
      };
    });
    setHasChanges(true);
  };

  // 매트릭스 데이터 인터페이스 정의
  interface MatrixData {
    dates: string[];
    places: { code: string; name: string }[];
    grid: Record<string, Record<string, any>>;
    dateTotals: Record<string, number>;
    placeTotals: Record<string, number>;
    placeCounts: Record<string, number>;
    settlementInfo: Record<string, { amount: number; details: string }>;
  }

  // 매트릭스 데이터 계산
  const matrixData: MatrixData = React.useMemo(() => {
    if (data.length === 0) return { 
      dates: [], places: [], grid: {}, dateTotals: {}, 
      placeTotals: {}, placeCounts: {}, settlementInfo: {} 
    };

    const dates = Array.from(new Set(data.map(d => d.date))).sort();
    
    // [중요] 납품처 코드(code) 기준으로 유니크한 납품처 목록 생성
    const placeCodes = Array.from(new Set(data.map(d => d.code))).sort();
    
    const places = placeCodes.map(code => ({
      code,
      name: data.find(d => d.code === code)?.name || 'UNKNOWN'
    }));

    const grid: Record<string, Record<string, any>> = {};
    const dateTotals: Record<string, number> = {}; 
    const placeTotals: Record<string, number> = {}; 
    const placeCounts: Record<string, number> = {}; 
    
    // 일자별 센터 수 계산용
    const dateCenterCounts: Record<string, number> = {};

    data.forEach(d => {
      if (!grid[d.date]) grid[d.date] = {};
      
      const weight = Number(String(d.weight).replace(/,/g, ''));
      const qty = Number(String(d.qty).replace(/,/g, ''));
      
      // 키를 납품처 코드(d.code)로 사용
      grid[d.date][d.code] = {
        weight,
        qty,
        remarks: d.remarks || d.note // note from DB, remarks from JSON
      };

      dateTotals[d.date] = (dateTotals[d.date] || 0) + weight;
      placeTotals[d.code] = (placeTotals[d.code] || 0) + weight;
      placeCounts[d.code] = (placeCounts[d.code] || 0) + 1;
      
      if (!dateCenterCounts[d.date]) dateCenterCounts[d.date] = 0;
      dateCenterCounts[d.date]++;
    });

    // 정산 금액 계산 로직
    const settlementInfo: Record<string, { amount: number; details: string }> = {};
    dates.forEach(date => {
      const centers = dateCenterCounts[date] || 0;
      const totalWeight = dateTotals[date] || 0;
      
      if (centers === 0) {
        settlementInfo[date] = { amount: 0, details: '-' };
        return;
      }

      let base = 120000;
      let centerBonus = centers >= 2 ? 30000 : 0;
      
      // 누적 차량 가산 로직: 550kg 단위로 차량 추가 (+12만)
      const extraTrucks = Math.max(0, Math.ceil(totalWeight / 550) - 1);
      let weightBonus = extraTrucks * 120000;

      let total = base + centerBonus + weightBonus;
      let detailArr = ['12'];
      if (centerBonus > 0) detailArr.push('3');
      for (let i = 0; i < extraTrucks; i++) {
        detailArr.push('12');
      }

      settlementInfo[date] = {
        amount: total,
        details: detailArr.join(' + ')
      };
    });

    return { dates, places, grid, dateTotals, placeTotals, placeCounts, settlementInfo };
  }, [data]);

  // [수정] 전체 요약 통계 계산 (평일/토/일 및 2회전 횟수 합산, 수정한 정산금액 반영)
  const summaryInfo = React.useMemo(() => {
    let weekday = 0;
    let saturday = 0;
    let sunday = 0;
    let totalExtraTrucks = 0;
    let totalAmount = 0;

    matrixData.dates.forEach(dateStr => {
      const dateVal = new Date(dateStr);
      const day = dateVal.getDay();
      if (day === 0) sunday++;
      else if (day === 6) saturday++;
      else weekday++;

      // 550kg 초과 시 추가된 차량 수 (2회전 등)
      const weight = matrixData.dateTotals[dateStr] || 0;
      const extra = Math.max(0, Math.ceil(weight / 550) - 1);
      totalExtraTrucks += extra;

      // 정산 금액: 수정된 내역이 있으면 수정액 기준, 없으면 자동 계산 결과 기준
      const amount = dateDetails[dateStr]?.amount !== undefined
        ? dateDetails[dateStr].amount
        : (matrixData.settlementInfo[dateStr]?.amount || 0);

      totalAmount += amount;
    });

    return { weekday, saturday, sunday, totalExtraTrucks, totalAmount };
  }, [matrixData.dates, matrixData.dateTotals, matrixData.settlementInfo, dateDetails]);

  const dayCounts = summaryInfo; // 기존 변수 호환성 유지

  return (
    <div className="space-y-2">
      {/* Ultra-Compact Search Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1.5 px-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          {/* Date Picker Range (MonthSelector) */}
          <div className="flex items-center gap-3">
            <MonthSelector currentDate={selectedMonth} onChange={setSelectedMonth} />
            <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              {startDate} ~ {endDate}
            </span>
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
              disabled={loading || saving || (data.length === 0)}
              className={`
                px-4 py-1.5 rounded-lg text-[12px] font-bold shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50
                ${hasChanges 
                  ? 'bg-amber-500 text-white hover:bg-amber-600 animate-pulse' 
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}
              `}
            >
              {saving ? (
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Save size={13} />
              )}
              {isSavedData ? '저장(수정)' : '결과 저장'}
            </button>

            <button 
              onClick={() => {
                const nowKST = getKSTToday();
                syncDateAcrossPages(nowKST.toISOString());
                setGsState({ query: { selectedMonth: nowKST.toISOString(), searchTerm: '' }, hasSearched: false });
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
            {isSavedData ? (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md ring-1 ring-emerald-200">
                <CheckCircle size={10} /> 저장된 데이터
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">
                LIVE 데이터
              </span>
            )}
            
            <h3 className="text-[12px] font-bold text-slate-800 flex items-center gap-3">
              <span>조회 결과 <span className="text-indigo-600 ml-1">{data.length}건</span></span>
              {data.length > 0 && (
                <span className="flex items-center gap-1.5 ml-2">
                  <span className="text-[11px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200 font-medium">평일 {dayCounts.weekday}</span>
                  <span className="text-[11px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded border border-blue-100 font-medium">토 {dayCounts.saturday}</span>
                  <span className="text-[11px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-100 font-bold">일 {dayCounts.sunday}</span>
                </span>
              )}
            </h3>
            
            {summaryInfo.totalExtraTrucks > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md ring-1 ring-amber-200">
                2회전 {summaryInfo.totalExtraTrucks}회 발생
              </span>
            )}
            
            {hasChanges && (
              <span className="ml-2 text-[11px] text-amber-600 font-bold flex items-center gap-1 animate-bounce">
                <AlertCircle size={12} /> 수정된 내용이 있습니다. 저장해주세요.
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-[12px] font-black text-indigo-700">
            <span>총 정산액: <span className="text-[14px] text-emerald-600 font-black">{summaryInfo.totalAmount.toLocaleString()}원</span></span>
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
                    날짜 \ 코드
                  </th>
                  {matrixData.places.map(place => (
                    <th key={place.code} className="min-w-[100px] px-2 py-2 text-center border-r border-slate-100" title={place.name}>
                      <div className="text-[10px] text-slate-400 truncate mb-0.5">{place.code}</div>
                      <div className="text-[11px] text-slate-600 truncate mb-0.5">{place.name}</div>
                      <div className="text-[15px] font-black text-indigo-600 leading-tight">{matrixData.placeCounts[place.code] || 0}일</div>
                    </th>
                  ))}
                  <th className="sticky right-[330px] z-30 bg-indigo-50 min-[80px]:w-auto w-[80px] px-2 py-2 text-[11px] font-bold text-indigo-700 uppercase tracking-wider text-center border-l border-indigo-100">
                    합계
                  </th>
                  <th className="sticky right-[220px] z-30 bg-emerald-50 min-[110px]:w-auto w-[110px] px-2 py-2 text-[11px] font-bold text-emerald-700 uppercase tracking-wider text-center border-l border-emerald-100">
                    정산금액
                  </th>
                  <th className="sticky right-[100px] z-30 bg-slate-50 min-[120px]:w-auto w-[120px] px-2 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center border-l border-slate-200">
                    정산세부내역
                  </th>
                  <th className="sticky right-0 z-30 bg-amber-50 min-[100px]:w-auto w-[100px] px-2 py-2 text-[11px] font-bold text-amber-700 uppercase tracking-wider text-center border-l border-amber-200">
                    비고
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
                      const val = matrixData.grid[date]?.[place.code];
                      const isEdited = editState[`${date}_${place.code}`] !== undefined;
                      
                      return (
                        <td key={place.code} className={`px-2 py-1.5 border-r border-slate-50 ${isEdited ? 'bg-amber-50' : ''}`}>
                          <div className="flex flex-col gap-1">
                             {/* Weight Editing */}
                             <input 
                               type="text"
                               value={val ? val.weight : ''}
                               onChange={(e) => handleCellChange(date, place.code, 'weight', e.target.value)}
                               placeholder="-"
                               className={`
                                 w-full text-right text-[11px] bg-transparent outline-none p-0.5
                                 ${isEdited ? 'text-amber-700 font-bold border-b border-amber-300' : 'text-slate-600 border-b border-transparent hover:border-slate-200'}
                               `}
                             />
                             {/* Remarks (Visible only if has content or edited) */}
                             {(val?.remarks || isEdited) && (
                               <input 
                                 type="text"
                                 value={val ? val.remarks || '' : ''}
                                 onChange={(e) => handleCellChange(date, place.code, 'remarks', e.target.value)}
                                 placeholder="비고"
                                 className="w-full text-right text-[9px] text-slate-400 bg-transparent outline-none"
                               />
                             )}
                          </div>
                        </td>
                      );
                    })}
                    <td className={`sticky right-[330px] z-20 bg-indigo-50/30 px-2 py-1.5 text-[11px] font-bold text-right border-l border-indigo-100 ${matrixData.dateTotals[date] > 550 ? 'text-red-600 font-black' : 'text-indigo-700'}`}>
                      {(matrixData.dateTotals[date] || 0).toLocaleString()}
                    </td>
                    <td className="sticky right-[220px] z-20 bg-emerald-50/20 px-2 py-1.5 text-[11px] font-black text-right text-emerald-700 border-l border-emerald-100">
                      <input 
                        type="text"
                        value={(dateDetails[date]?.amount !== undefined ? dateDetails[date].amount : (matrixData.settlementInfo[date]?.amount || 0)).toLocaleString()}
                        onChange={(e) => handleDateDetailChange(date, 'amount', e.target.value)}
                        className="w-full text-right bg-transparent outline-none border-b border-transparent hover:border-emerald-200 focus:border-emerald-400"
                      />
                    </td>
                    <td className="sticky right-[100px] z-20 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-500 border-l border-slate-100 text-center">
                      <input 
                        type="text"
                        value={dateDetails[date]?.details !== undefined ? dateDetails[date].details : (matrixData.settlementInfo[date]?.details || '')}
                        onChange={(e) => handleDateDetailChange(date, 'details', e.target.value)}
                        placeholder="-"
                        className="w-full text-center bg-transparent outline-none border-b border-transparent hover:border-slate-200 focus:border-slate-400"
                      />
                    </td>
                    <td className="sticky right-0 z-20 bg-amber-50/10 px-2 py-1.5 text-[11px] font-medium text-slate-600 border-l border-slate-100 text-center">
                      <input 
                        type="text"
                        value={dateDetails[date]?.remarks || ''}
                        onChange={(e) => handleDateDetailChange(date, 'remarks', e.target.value)}
                        placeholder="비고"
                        className="w-full text-center bg-transparent outline-none border-b border-transparent hover:border-amber-200 focus:border-amber-400"
                      />
                    </td>
                  </tr>
                ))}
                {/* Grand Total Row */}
                <tr className="bg-slate-100 font-bold sticky bottom-0 z-20">
                  <td className="sticky left-0 z-30 bg-slate-100 px-4 py-2 text-[11px] text-slate-700 border-r border-slate-200 border-t border-slate-300 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                    총계
                  </td>
                  {matrixData.places.map(place => (
                    <td key={place.code} className="px-2 py-2 text-[11px] text-right text-slate-700 border-r border-slate-200 border-t border-slate-300">
                      {(matrixData.placeTotals[place.code] || 0).toLocaleString()}
                    </td>
                  ))}
                  <td className="sticky right-[330px] z-30 bg-indigo-100 px-2 py-2 text-[11px] text-right text-indigo-800 border-l border-indigo-200 border-t border-indigo-300">
                    {Object.values(matrixData.placeTotals || {}).reduce((a, b) => a + b, 0).toLocaleString()}
                  </td>
                  <td className="sticky right-[220px] z-30 bg-emerald-100 px-2 py-2 text-[11px] text-right text-emerald-800 border-l border-emerald-200 border-t border-emerald-300">
                    {matrixData.dates.reduce((acc, date) => acc + (dateDetails[date]?.amount !== undefined ? dateDetails[date].amount : (matrixData.settlementInfo[date]?.amount || 0)), 0).toLocaleString()}
                  </td>
                  <td className="sticky right-[100px] z-30 bg-slate-100 px-2 py-2 text-[11px] text-right text-slate-500 border-l border-slate-200 border-t border-slate-300">
                    -
                  </td>
                  <td className="sticky right-0 z-30 bg-slate-100 px-2 py-2 text-[11px] text-right text-slate-500 border-l border-slate-200 border-t border-slate-300">
                    -
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
