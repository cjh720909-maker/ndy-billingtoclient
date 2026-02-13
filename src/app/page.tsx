'use client';

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Printer, 
  Calendar,
  FileSpreadsheet,
  Loader2,
  Search,
  MoreVertical
} from 'lucide-react';
import { getMonthlyBillingSummary } from '@/actions/billing';

export default function Home() {
  const getKSTToday = () => {
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    return new Date(now.getTime() + kstOffset);
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(() => {
    const today = getKSTToday();
    return formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => formatDate(getKSTToday()));
  
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async (start: string, end: string) => {
    setLoading(true);
    const result = await getMonthlyBillingSummary({ startDate: start, endDate: end });
    if (result.success) {
      setTableData(result.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData(startDate, endDate);
  }, []);

  const handleSearch = () => fetchData(startDate, endDate);

  // 당월: 이번 달 1일 ~ 오늘
  const setMonthCurrent = () => {
    const today = getKSTToday();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(formatDate(firstDay));
    setEndDate(formatDate(today));
  };

  // 전월: 지난 달 1일 ~ 지난 달 말일
  const setMonthPrevious = () => {
    const today = getKSTToday();
    const firstDayPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayPrev = new Date(today.getFullYear(), today.getMonth(), 0);
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

  const totalCost = tableData.reduce((acc, curr) => acc + Number(curr.cost.replace(/,/g, '')), 0);
  const totalCount = tableData.reduce((acc, curr) => acc + Number(curr.count), 0);

  return (
    <div className="space-y-3">
      {/* Date Filter Bar - Consolidated with Buttons */}
      <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 mr-1">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600">
              <Calendar size={13} className="text-slate-400" /> 시작
            </div>
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 w-[125px]"
            />
            <span className="text-slate-300">-</span>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600">
              <Calendar size={13} className="text-slate-400" /> 종료
            </div>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[12px] font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 w-[125px]"
            />
          </div>
          
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg gap-0.5">
            <button 
              onClick={setMonthCurrent}
              className="px-2.5 py-1.5 bg-white text-indigo-600 rounded-md text-[11px] font-bold shadow-sm hover:bg-slate-50 transition-all border border-slate-200"
            >
              당월
            </button>
            <button 
              onClick={setMonthPrevious}
              className="px-2.5 py-1.5 text-slate-500 hover:text-indigo-600 rounded-md text-[11px] font-bold transition-all"
            >
              전월
            </button>
            <button 
              onClick={setPayCycleRange}
              className="px-2.5 py-1.5 text-slate-500 hover:text-indigo-600 rounded-md text-[11px] font-bold transition-all"
            >
              25일
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[12px] font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-100"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            조회
          </button>
          <div className="w-[1px] h-4 bg-slate-200 mx-1"></div>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
            <Printer size={13} /> 인쇄
          </button>
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 rounded-lg text-[11px] font-bold text-white hover:bg-slate-800 transition-colors">
            <Download size={13} /> 엑셀
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        {/* Table Content */}
        <div className="overflow-x-auto min-h-[500px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">납품처</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">청구처</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">청구금액</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">배송횟수</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">비고/정산기준</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    데이터를 분석하고 있습니다...
                  </td>
                </tr>
              ) : tableData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                    조회된 데이터가 없습니다.
                  </td>
                </tr>
              ) : (
                tableData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-indigo-50/20 transition-colors group">
                    <td className="px-4 py-3 text-[12px] font-semibold text-slate-800">
                      {row.delivery}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-600">
                      {row.client}
                    </td>
                    <td className="px-4 py-3 text-[12px] font-bold text-indigo-600 text-right">
                      {row.cost}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-[11px] font-bold text-slate-600">
                        {row.count}회
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-500 font-medium">
                      {row.remarks}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button className="p-1 text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
              {/* Total Row */}
              {!loading && tableData.length > 0 && (
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                  <td colSpan={2} className="px-4 py-4 text-[12px] text-slate-800 text-center">통합 합계</td>
                  <td className="px-4 py-4 text-[14px] text-amber-600 text-right font-black">
                    ₩{totalCost.toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-center">
                     <span className="inline-flex items-center px-2 py-1 rounded bg-indigo-100 text-[11px] font-black text-indigo-700">
                        {totalCount}회
                      </span>
                  </td>
                  <td colSpan={2} className="px-4 py-4"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
