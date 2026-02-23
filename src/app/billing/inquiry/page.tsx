'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  RotateCcw,
  ArrowRight,
  Save,
  CheckCircle2,
  Calculator,
  X,
  AlertCircle
} from 'lucide-react';
import { getInquiryBilling, saveInquirySettlements, deleteInquirySettlements } from '@/actions/billing';

export default function BillingInquiryPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
    const savedFilter = sessionStorage.getItem('billing-inquiry-filter');
    const savedData = sessionStorage.getItem('billing-inquiry-data');
    
    if (savedFilter) {
      const { start, end, term } = JSON.parse(savedFilter);
      setStartDate(start);
      setEndDate(end);
      setSearchTerm(term);
      
      if (savedData) {
        setData(JSON.parse(savedData));
        // 데이터가 이미 로드된 경우 isSaved 상태도 확인해야 함
        fetchData(start, end, term);
      } else {
        fetchData(start, end, term);
      }
    } else {
      const today = getKSTToday();
      const startStr = formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 26));
      const endStr = formatDate(new Date(today.getFullYear(), today.getMonth(), 25));
      
      setStartDate(startStr);
      setEndDate(endStr);
      fetchData(startStr, endStr, '');
    }
  }, []);

  const fetchData = async (start: string, end: string, term: string) => {
    setLoading(true);
    const result = await getInquiryBilling({ startDate: start, endDate: end, searchTerm: term });
    if (result.success && result.data) {
      setData(result.data);
      setIsSaved(!!result.isSaved);
      setSelectedIds(new Set());
      sessionStorage.setItem('billing-inquiry-filter', JSON.stringify({ start, end, term }));
      sessionStorage.setItem('billing-inquiry-data', JSON.stringify(result.data));
    } else {
      setData([]);
      setIsSaved(false);
    }
    setLoading(false);
  };

  const handleSearch = () => {
    fetchData(startDate, endDate, searchTerm);
  };

  const setMonthCurrent = () => {
    const today = getKSTToday();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const start = formatDate(firstDay);
    const end = formatDate(today);
    setStartDate(start);
    setEndDate(end);
    fetchData(start, end, searchTerm);
  };

  const setMonthPrevious = () => {
    const today = getKSTToday();
    const firstDayPrev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastDayPrev = new Date(today.getFullYear(), today.getMonth(), 0); 
    const start = formatDate(firstDayPrev);
    const end = formatDate(lastDayPrev);
    setStartDate(start);
    setEndDate(end);
    fetchData(start, end, searchTerm);
  };

  const setPayCycleRange = () => {
    const today = getKSTToday();
    const start = formatDate(new Date(today.getFullYear(), today.getMonth() - 1, 26));
    const end = formatDate(new Date(today.getFullYear(), today.getMonth(), 25));
    setStartDate(start);
    setEndDate(end);
    fetchData(start, end, searchTerm);
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(data.map(item => item.no)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectRow = (no: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(no)) {
      newSelected.delete(no);
    } else {
      newSelected.add(no);
    }
    setSelectedIds(newSelected);
  };

  const handleSaveSettlement = async () => {
    const selectedRecords = data.filter(item => selectedIds.has(item.no));
    if (selectedRecords.length === 0) return;

    setSaving(true);
    try {
      const result = await saveInquirySettlements({
        records: selectedRecords.map(r => ({
          ...r,
          startDate,
          endDate
        }))
      });

      if (result.success) {
        alert('정산 기록이 저장되었습니다.');
        setShowModal(false);
        setSelectedIds(new Set());
        fetchData(startDate, endDate, searchTerm);
      } else {
        alert(result.error);
      }
    } catch (err) {
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSettlement = async () => {
    setSaving(true);
    try {
      const selectedRecords = data.filter(item => selectedIds.has(item.no) && item.savedId);
      const idsToDelete = selectedRecords.map(r => r.savedId);
      
      const result = await deleteInquirySettlements({ 
        startDate, 
        endDate,
        ids: idsToDelete.length > 0 ? idsToDelete : undefined
      });

      if (result.success) {
        alert(idsToDelete.length > 0 ? `${idsToDelete.length}건의 정산 데이터가 취소되었습니다.` : '해당 기간의 모든 정산 데이터가 취소되었습니다.');
        setShowDeleteModal(false);
        fetchData(startDate, endDate, searchTerm);
      } else {
        alert(result.error);
      }
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
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
            {isSaved ? (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md ring-1 ring-emerald-200">
                <CheckCircle2 size={10} /> 정산 완료됨 ({startDate} ~ {endDate})
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-md">STATUS</span>
            )}
            <h3 className="text-[12px] font-bold text-slate-800">
              조회 결과 <span className="text-indigo-600 ml-1">{data.length}건</span>
              {selectedIds.size > 0 && <span className="text-indigo-400 ml-2">({selectedIds.size}건 선택됨)</span>}
            </h3>
          </div>
          <div className="flex gap-2">
            {isSaved && (
              <button 
                onClick={() => setShowDeleteModal(true)}
                disabled={loading || saving}
                className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[11px] font-bold hover:bg-rose-100 transition-all flex items-center gap-1 disabled:opacity-50"
              >
                <RotateCcw size={13} />
                정산 취소
              </button>
            )}
            <button 
              onClick={() => {
                if (selectedIds.size === 0) {
                  alert('저장할 항목을 선택해주세요.');
                  return;
                }
                setShowModal(true);
              }}
              disabled={loading || saving}
              className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <Save size={13} />
              {isSaved ? '정산 수정 저장' : '정산 결과 저장'}
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <table className="w-full text-left table-fixed border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="w-10 px-4 py-2 text-center">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                    checked={data.length > 0 && selectedIds.size === data.length}
                    onChange={toggleSelectAll}
                  />
                </th>
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
                    <td colSpan={12} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-full" /></td>
                  </tr>
                ))
              ) : data.length > 0 ? (
                data.map((row, i) => {
                  const isSelected = selectedIds.has(row.no);
                  return (
                    <tr 
                      key={i} 
                      className={`hover:bg-slate-50/80 transition-colors group cursor-pointer ${isSelected ? 'bg-indigo-50/30' : (row.isRowSaved ? 'bg-emerald-50/30' : '')}`}
                      onClick={() => toggleSelectRow(row.no)}
                    >
                      <td className="px-4 py-1.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-2">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(row.no)}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-1.5 text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                          {row.no}
                          {row.isRowSaved && (
                            <span className="text-[9px] font-bold px-1 bg-emerald-100 text-emerald-600 rounded-sm whitespace-nowrap">
                              완료
                            </span>
                          )}
                        </div>
                      </td>
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
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="px-4 py-20 text-center">
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

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Calculator className="text-indigo-600" size={20} />
                <h3 className="text-[16px] font-bold text-slate-800">정산 기록 저장 확인</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full transition-all">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <div>
                  <p className="text-[11px] text-indigo-400 font-bold uppercase tracking-wider">대상 기간</p>
                  <p className="text-[14px] font-black text-indigo-900">{startDate} ~ {endDate}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-[11px] text-indigo-400 font-bold uppercase tracking-wider">선택 항목</p>
                  <p className="text-[14px] font-black text-indigo-900">{selectedIds.size}건</p>
                </div>
              </div>
              <p className="text-[13px] text-slate-600 text-center">
                선택하신 {selectedIds.size}건의 내역을 해당 기간의 정산 데이터로 저장하시겠습니까?
              </p>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-[13px] font-bold text-slate-500 hover:text-slate-700">취소</button>
              <button 
                onClick={handleSaveSettlement} 
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-[13px] font-bold hover:bg-indigo-700 flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}
                정산 기록 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-[16px] font-bold text-slate-800">정산 취소 확인</h3>
                <p className="text-[13px] text-slate-500">
                  {selectedIds.size > 0 
                    ? `선택하신 ${selectedIds.size}건의 정산 데이터를 취소하시겠습니까?`
                    : `${startDate} ~ ${endDate} 기간의 모든 정산 데이터를 취소하시겠습니까?`
                  }<br/>
                  취소 후에는 다시 정산 저장이 가능합니다.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3">
              <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 text-[13px] font-bold text-slate-500">취소</button>
              <button 
                onClick={handleDeleteSettlement} 
                disabled={saving}
                className="px-6 py-2 bg-rose-600 text-white rounded-lg text-[13px] font-bold hover:bg-rose-700 flex items-center gap-2 disabled:opacity-50"
              >
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <RotateCcw size={16} />}
                정산 취소 수행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
