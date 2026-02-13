'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertCircle,
  Search, 
  RotateCcw,
  Calendar,
  ArrowRight,
  FileSearch,
} from 'lucide-react';
import { getEmergencyShipments } from '@/actions/billing';

export default function EmergencyShipmentPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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

  // 초기 날짜 설정 (당월 1일 ~ 오늘) 및 자동 조회
  useEffect(() => {
    const today = getKSTToday();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const startStr = formatDate(firstDay);
    const endStr = formatDate(today);
    
    setStartDate(startStr);
    setEndDate(endStr);
    
    fetchData(startStr, endStr);
  }, []);

  const fetchData = async (start: string, end: string) => {
    setLoading(true);
    try {
      const result = await getEmergencyShipments({ startDate: start, endDate: end });
      if (result.success) {
        setData(result.data || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchData(startDate, endDate);
  };

  // 퀵 버튼 함수들
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

  const resetFilters = () => {
    const today = getKSTToday();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(today));
    fetchData(formatDate(firstDay), formatDate(today));
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-100 rounded-lg text-amber-600">
              <AlertCircle size={18} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-800">긴급 출고 조회</h2>
          </div>
          <p className="text-[12px] text-slate-500 font-medium">납품처명에 '긴급' 또는 '*'가 포함된 거래처 목록 (납품처명 기준 중복 제외)</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 px-4 sticky top-0 z-40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus-within:border-amber-400 focus-within:bg-white transition-all shadow-inner">
              <Calendar size={14} className="text-slate-400" />
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent border-none text-[12px] text-slate-700 focus:ring-0 w-[120px] outline-none font-bold" 
              />
              <ArrowRight size={12} className="text-slate-300" />
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent border-none text-[12px] text-slate-700 focus:ring-0 w-[120px] outline-none font-bold" 
              />
            </div>
            
            <div className="flex gap-1">
              <button onClick={setMonthCurrent} className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-amber-400 hover:text-amber-600 transition-all shadow-sm">당월</button>
              <button onClick={setMonthPrevious} className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-amber-400 hover:text-amber-600 transition-all shadow-sm">전월</button>
              <button onClick={setPayCycleRange} className="px-2.5 py-1.5 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-amber-400 hover:text-amber-600 transition-all shadow-sm">25일 기준</button>
            </div>
          </div>

          <div className="flex gap-2">
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="px-5 py-2 bg-amber-600 text-white rounded-lg text-[12px] font-bold hover:bg-amber-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Search size={14} />
              )}
              조회
            </button>
            <button 
              onClick={resetFilters}
              className="p-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-200 transition-all"
              title="초기화"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">조회 결과</span>
            {data.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                {data.length}개 거래처
              </span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-[400px] gap-3">
              <div className="w-10 h-10 border-4 border-amber-600/20 border-t-amber-600 rounded-full animate-spin" />
              <p className="text-[13px] text-slate-400 font-medium">데이터를 분석 중입니다...</p>
            </div>
          ) : data.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="w-16 px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">No</th>
                  <th className="w-32 px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">납품처 코드</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">납품처명</th>
                  <th className="w-40 px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">최근 긴급일</th>
                  <th className="px-6 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row, idx) => (
                  <tr key={idx} className="hover:bg-amber-50/30 transition-colors group">
                    <td className="px-6 py-3 text-[12px] text-slate-400 font-medium">{idx + 1}</td>
                    <td className="px-6 py-3">
                      <code className="text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">{row.code || '-'}</code>
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-bold text-slate-700">{row.name}</span>
                        {(row.name.includes('*') || row.name.includes('★')) && (
                          <span className="w-2 h-2 rounded-full bg-amber-400" title="별표 포함" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-[12px] text-slate-500 font-medium italic">
                      {row.latestDate}
                    </td>
                    <td className="px-6 py-3 text-[12px] text-slate-500">
                      {row.memo || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] text-slate-400 italic">
              <div className="p-4 bg-slate-50 rounded-full mb-3">
                <FileSearch size={40} className="text-slate-200" />
              </div>
              <p className="text-[14px]">해당 기간 내 긴급 출고 내역이 없습니다.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
