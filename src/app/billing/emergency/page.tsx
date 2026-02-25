'use client';

import React, { useState, useEffect } from 'react';
import { 
  AlertCircle,
  Search, 
  RotateCcw,
  Calendar,
  ArrowRight,
  FileSearch,
  Calculator,
  Save,
  X,
  CheckCircle2,
  CheckCircle,
  DollarSign,
  MapPin,
} from 'lucide-react';
import { getEmergencyShipments, saveEmergencySettlements, updateEmergencyRate, deleteEmergencySettlements } from '@/actions/billing';
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

export default function EmergencyShipmentPage() {
  const { emergency, setEmergencyState, syncDateAcrossPages } = useSettlementStore();
  const { query, data: storeData, isSaved, hasSearched } = emergency;

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

  const data = storeData || EMPTY_ARRAY;
  
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // 모달 관련 상태
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false); // 삭제 모달 추가
  const [saving, setSaving] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchData = React.useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      const result = await getEmergencyShipments({ startDate: start, endDate: end });
      if (result.success) {
        setEmergencyState({ data: result.data || [], isSaved: !!result.isSaved, hasSearched: true });
        setSelectedIds(new Set()); // 데이터 갱신 시 선택 초기화
      } else {
        setEmergencyState({ data: [], isSaved: false, hasSearched: true });
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 스토어에 데이터가 없거나 처음 진입 시 조회
  useEffect(() => {
    if (!hasSearched) {
      fetchData(startDate, endDate);
    }
  }, [hasSearched, startDate, endDate, fetchData]);

  const handleSearch = () => {
    setSelectedMonth(getKSTToday());
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(data.map(item => item.name)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectRow = (name: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(name)) {
      newSelected.delete(name);
    } else {
      newSelected.add(name);
    }
    setSelectedIds(newSelected);
  };

  // 대기 단가 수정 핸들러 (메모리 상태 업데이트)
  const handleRateChange = (name: string, value: string) => {
    const numericValue = parseInt(value) || 0;
    const newData = data.map(item => 
      item.name === name ? { ...item, rate: numericValue } : item
    );
    setEmergencyState({ data: newData });
  };

  // 청구처 수정 핸들러
  const handleChungChange = (name: string, value: string) => {
    const newData = data.map(item => 
      item.name === name ? { ...item, chung: value } : item
    );
    setEmergencyState({ data: newData });
  };

  // 저장 버튼 클릭 시 (단가 있는 항목 자동 선택)
  const handleStartSave = () => {
    // 단가가 0보다 큰 항목만 필터링
    const targetNames = data.filter(item => (item.rate || 0) > 0).map(item => item.name);
    
    if (targetNames.length === 0) {
      alert('저장할 데이터(단가 입력 항목)가 없습니다.');
      return;
    }

    // 대상 항목들을 자동으로 선택 상태로 변경
    setSelectedIds(new Set(targetNames));
    setShowModal(true);
  };

  // 정산 취소 전 체크
  const handleStartDelete = () => {
    if (selectedIds.size === 0) {
      alert('취소할 정산 항목을 먼저 선택해주세요. "정산 완료됨" 상태인 항목만 취소 가능합니다.');
      return;
    }
    setShowDeleteModal(true);
  };

  // 정산 기록 저장
  const handleSaveSettlement = async () => {
    const selectedRecords = data.filter(item => selectedIds.has(item.name));
    
    if (selectedRecords.length === 0) {
      alert('선택된 항목이 없습니다.');
      return;
    }

    setSaving(true);
    try {
      // 1. 개별 정산 기록 저장
      const saveResult = await saveEmergencySettlements({ 
        records: selectedRecords.map(item => ({
          name: item.name,
          startDate: startDate,
          endDate: endDate,
          count: item.count,
          rate: item.rate,
          total: item.count * item.rate,
          chung: item.chung,
          memo: (item.memo ? `${item.memo} ` : '') + (item.dates ? `[${item.dates.map((d: string) => {
            const parts = d.split('-');
            if (parts.length < 3) return d;
            return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
          }).reverse().join(', ')}]` : ''), // 최신순에서 과거순으로 정렬 (조회 화면과 맞춤)
          dates: item.dates // 향후 활용을 위해 날짜 원본 배열도 저장
        }))
      });

      if (saveResult.success) {
        // 2. 마스터 단가 및 청구처 동시에 업데이트
        await Promise.all(selectedRecords.map(item => 
          updateEmergencyRate(item.name, item.rate, item.chung || '')
        ));

        alert('정산 기록 및 마스터 단가가 저장되었습니다.');
        setShowModal(false);
        setSelectedIds(new Set());
        fetchData(startDate, endDate); // 상태 갱신 (isSaved 반영)
      } else {
        alert(saveResult.error);
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 정산 기록 삭제 (정산 취소)
  const handleDeleteSettlement = async () => {
    setSaving(true);
    try {
      // 선택된 명단 추출
      const names = Array.from(selectedIds);
      const result = await deleteEmergencySettlements({ 
        startDate, 
        endDate,
        names // 선택된 것만 전달
      });
      if (result.success) {
        alert('선택한 정산 데이터가 취소되었습니다.');
        setShowDeleteModal(false);
        setSelectedIds(new Set()); // 취소 후 선택 초기화
        await fetchData(startDate, endDate); // 상태 갱신 대기
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar with Description */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 px-4 sticky top-0 z-40 bg-white/95 backdrop-blur-sm">
        <div className="flex flex-col gap-2">
          {/* Description line - Minimalist */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-1.5 mb-0.5">
            <AlertCircle size={14} className="text-amber-500" />
            <p className="text-[11px] text-slate-500 font-medium">납품처명에 '긴급' 또는 '*'가 포함된 거래처 목록 (납품처명 기준 중복 제외)</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MonthSelector currentDate={selectedMonth} onChange={setSelectedMonth} />
              <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                {startDate} ~ {endDate}
              </span>
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
                onClick={() => {
                  const nowKST = getKSTToday();
                  syncDateAcrossPages(nowKST.toISOString());
                  setEmergencyState({ query: { selectedMonth: nowKST.toISOString(), searchTerm: '' }, hasSearched: false });
                }}
                className="p-2 bg-slate-100 border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-200 transition-all"
                title="초기화"
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isSaved ? (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-md ring-1 ring-emerald-200">
                <CheckCircle2 size={10} /> 정산 완료됨 ({startDate} ~ {endDate})
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-md">
                LIVE 데이터
              </span>
            )}
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-2">조회 결과</span>
            {data.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                {data.length}개 거래처
              </span>
            )}
            {selectedIds.size > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold ml-1">
                {selectedIds.size}개 선택됨
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            {isSaved && (
              <button 
                onClick={handleStartDelete}
                disabled={loading || saving}
                className="px-4 py-1.5 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-[12px] font-bold hover:bg-rose-100 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <RotateCcw size={14} />
                정산 취소
              </button>
            )}
            <button 
              onClick={handleStartSave}
              disabled={loading || saving}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[12px] font-bold hover:bg-indigo-700 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={14} />
              {isSaved ? '정산 수정 저장' : '정산 결과 저장'}
            </button>
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
                  <th className="w-12 px-4 py-3 text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      checked={data.length > 0 && selectedIds.size === data.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="w-12 px-2 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">No</th>
                  <th className="w-16 px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">코드</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">납품처명</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">주소</th>
                  <th className="w-16 px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">횟수</th>
                  <th className="w-24 px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">단가</th>
                  <th className="w-28 px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">청구처</th>
                  <th className="w-28 px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">총 금액</th>
                  <th className="w-60 px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">날짜</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">비고</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((row, idx) => {
                  const isSelected = selectedIds.has(row.name);
                  const totalAmount = row.count * (row.rate || 0);
                  
                  // 날짜 포맷팅: YYYY-MM-DD -> M/D (단가가 있을 때만)
                  // 예: 2026-02-19 -> 2/19, 2026-02-09 -> 2/9
                  const formattedDates = (row.rate > 0 && row.dates) 
                    ? row.dates.map((d: string) => {
                        const parts = d.split('-');
                        if (parts.length < 3) return d;
                        const month = parseInt(parts[1], 10);
                        const day = parseInt(parts[2], 10);
                        return `${month}/${day}`;
                      }).join(', ') 
                    : '-';

                  return (
                    <tr 
                      key={idx} 
                      className={`hover:bg-amber-50/30 transition-colors group cursor-pointer ${isSelected ? 'bg-amber-50/20' : ''}`}
                      onClick={() => toggleSelectRow(row.name)}
                    >
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelectRow(row.name)}
                        />
                      </td>
                      <td className="px-2 py-3 text-[12px] text-slate-400 font-medium text-center">{idx + 1}</td>
                      <td className="px-4 py-3 text-center">
                        <code className="text-[10px] bg-slate-100 px-1 py-0.5 rounded text-slate-500 font-mono">{row.code || '-'}</code>
                      </td>
                      <td className="px-4 py-3 min-w-[120px]">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-bold text-slate-700 whitespace-nowrap">{row.name}</span>
                          {(row.name.includes('*') || row.name.includes('★')) && (
                            <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="별표 포함" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-1.5 max-w-[200px]">
                          <MapPin size={12} className="text-slate-300 mt-0.5 shrink-0" />
                          <span className="text-[12px] text-slate-500 line-clamp-2 leading-snug">{row.address || '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[13px] font-black text-amber-600 text-center">
                        {row.count}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {isSelected ? (
                          <div className="relative">
                            <input 
                              type="number" 
                              value={row.rate || ''}
                              onChange={(e) => handleRateChange(row.name, e.target.value)}
                              className="w-full pl-6 pr-2 py-1 text-[12px] font-bold border border-indigo-200 rounded bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all"
                              placeholder="0"
                            />
                            <DollarSign size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-indigo-400" />
                          </div>
                        ) : (
                          <div className="text-center text-[12px] text-slate-400">
                            {row.rate ? row.rate.toLocaleString() : '-'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {isSelected ? (
                          <input 
                            type="text" 
                            value={row.chung || ''}
                            onChange={(e) => handleChungChange(row.name, e.target.value)}
                            className="w-full px-2 py-1 text-[12px] font-bold border border-indigo-200 rounded bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none transition-all text-center text-slate-700"
                            placeholder="미설정"
                          />
                        ) : (
                          <div className="text-center text-[12px] text-slate-500 font-medium truncate max-w-[100px] mx-auto">
                            {row.chung || '-'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`text-[13px] font-black ${totalAmount > 0 ? 'text-slate-900' : 'text-slate-300'}`}>
                          {totalAmount > 0 ? totalAmount.toLocaleString() : '-'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 font-medium italic text-center">
                        {formattedDates}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-slate-500">
                        {row.memo || '-'}
                      </td>
                    </tr>
                  );
                })}
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

      {/* Confirmation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Calculator className="text-indigo-600" size={20} />
                <h3 className="text-[16px] font-bold text-slate-800">정산 기록 저장 확인</h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <Calendar className="text-indigo-500" size={18} />
                <div>
                  <p className="text-[11px] text-indigo-400 font-bold uppercase tracking-wider">대상 기간</p>
                  <p className="text-[14px] font-black text-indigo-900">{startDate} ~ {endDate}</p>
                </div>
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-[12px]">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-bold text-left">납품처명</th>
                      <th className="px-4 py-2 font-bold text-center">횟수</th>
                      <th className="px-4 py-2 font-bold text-right">입력 단가</th>
                      <th className="px-4 py-2 font-bold text-center">청구처</th>
                      <th className="px-4 py-2 font-bold text-right">총액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data.filter(item => selectedIds.has(item.name)).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-700">{item.name}</td>
                        <td className="px-4 py-3 text-center font-black text-amber-600">{item.count}회</td>
                        <td className="px-4 py-3 text-right text-slate-900 font-bold">
                          {item.rate?.toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600 font-bold">
                          {item.chung || '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-indigo-600">
                          {(item.count * (item.rate || 0)).toLocaleString()}원
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50/80 border-t border-slate-100">
                    <tr className="font-black text-slate-900">
                      <td colSpan={4} className="px-4 py-3 text-right text-indigo-600">최종 청구 총액</td>
                      <td className="px-4 py-3 text-right text-[15px] text-indigo-700">
                        {data.filter(item => selectedIds.has(item.name))
                          .reduce((acc, curr) => acc + (curr.count * (curr.rate || 0)), 0)
                          .toLocaleString()}원
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="text-[12px] text-slate-500 text-center">위 내역을 정산 기록으로 저장하시겠습니까?<br/>입력하신 단가는 각 업체별 **마스터 단가**로 자동 업데이트됩니다.</p>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
              <button 
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-[13px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
              >
                취소
              </button>
              <button 
                onClick={handleSaveSettlement}
                disabled={saving}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-[13px] font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <CheckCircle2 size={16} />
                )}
                기록 및 단가 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-[16px] font-bold text-slate-800">선택한 정산 취소 확인</h3>
                <p className="text-[13px] text-slate-500">
                  <span className="font-bold text-slate-700">{startDate} ~ {endDate}</span> 기간 중,<br/>
                  선택하신 <span className="font-bold text-rose-600">{selectedIds.size}개</span> 거래처의 정산 데이터를 정말로 취소하시겠습니까?<br/>
                  취소 후에는 단가가 초기화되며 <span className="text-amber-600 font-bold">LIVE 데이터</span> 상태로 변경됩니다.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center gap-3">
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-[13px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
              >
                취소
              </button>
              <button 
                onClick={handleDeleteSettlement}
                disabled={saving}
                className="px-6 py-2 bg-rose-600 text-white rounded-lg text-[13px] font-bold hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <RotateCcw size={16} />
                )}
                정산 삭제 수행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
