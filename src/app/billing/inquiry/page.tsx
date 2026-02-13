'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RotateCcw,
  ArrowRight
} from 'lucide-react';
import { getInquiryBilling } from '@/actions/billing';

export default function BillingInquiryPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

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
    const today = getKSTToday();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(today));
  }, []);

  const fetchData = async (start: string, end: string, term: string) => {
    setLoading(true);
    const result = await getInquiryBilling({ startDate: start, endDate: end, searchTerm: term });
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setData([]);
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

  return (
    <div className="space-y-2">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-1.5 px-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
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

          <div className="flex-1 min-w-[200px] relative">
            <input 
              type="text" 
              placeholder="명칭, 지점, 납품처, 청구처 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-3 py-1 pl-8 bg-slate-50 border border-slate-200 rounded-lg text-[12px] text-slate-700 focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all outline-none" 
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
          </div>

          <div className="flex gap-1.5">
            <button 
              onClick={handleSearch}
              disabled={loading}
              className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[12px] font-bold hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={13} />} 조회
            </button>
            <button 
              onClick={() => {setSearchTerm(''); setMonthCurrent();}}
              className="p-1 bg-slate-100 border border-slate-200 text-slate-500 rounded-md hover:bg-slate-200 transition-all"
              title="초기화"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col">
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">STATUS</span>
            <h3 className="text-[12px] font-bold text-slate-800">
              조회 결과 <span className="text-indigo-600 ml-1">{data.length}건</span>
            </h3>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left table-fixed border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="w-12 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">No</th>
                <th className="w-24 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">날짜</th>
                <th className="w-24 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">명칭</th>
                <th className="w-14 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">지점</th>
                <th className="w-40 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">납품처</th>
                <th className="w-40 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">톤수</th>
                <th className="w-28 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">청구 금액</th>
                <th className="w-24 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">요율</th>
                <th className="w-32 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">청구처</th>
                <th className="w-24 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">운임</th>
                <th className="w-40 px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={11} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                  </tr>
                ))
              ) : data.length > 0 ? (
                data.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-4 py-1.5 text-[11px] text-slate-400">{row.no}</td>
                    <td className="px-4 py-1.5 text-[11px] text-slate-500">{row.date}</td>
                    <td className="px-4 py-1.5 text-[12px] text-slate-700 truncate">{row.name}</td>
                    <td className="px-4 py-1.5 text-[12px] text-slate-700 truncate">{row.so}</td>
                    <td className="px-4 py-1.5 text-[12px] text-slate-700 truncate">{row.nap}</td>
                    <td className="px-4 py-1.5 text-[12px] text-slate-700">{row.ton}</td>
                    <td className="px-4 py-1.5 text-[12px] font-bold text-slate-700 text-right">{row.kum.toLocaleString()}</td>
                    <td className="px-4 py-1.5 text-[12px] text-slate-700">{row.yo}</td>
                    <td className="px-4 py-1.5 text-[12px] text-slate-700 truncate">{row.chung}</td>
                    <td className="px-4 py-1.5 text-[12px] font-bold text-indigo-600 text-right">{row.un.toLocaleString()}</td>
                    <td className="px-4 py-1.5 text-[11px] text-slate-400 font-medium truncate">{row.memo}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={11} className="px-4 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                        <Search className="text-slate-300" size={24} />
                      </div>
                      <p className="text-[13px] font-medium text-slate-400">조회된 데이터가 없습니다.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
