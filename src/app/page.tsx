'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Download, 
  Printer, 
  Calendar,
  FileSpreadsheet,
  Loader2,
  Search,
  MoreVertical,
  CheckCircle,
  AlertCircle,
  Truck,
  Plus,
  Trash2,
  Edit2,
  X
} from 'lucide-react';
import { saveFixedSettlement, deleteFixedSettlement } from '@/actions/billing';
import { getIntegratedBillingSummary } from '@/actions/settlements';
import { saveMonthlyClosing, getMonthlyClosing, deleteMonthlyClosing } from '@/actions/closing';
import { MonthSelector } from '@/components/MonthSelector';
import * as XLSX from 'xlsx-js-style';
import { useSettlementStore } from '@/store/useSettlementStore';

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

  const { integrated, setIntegratedState, syncDateAcrossPages } = useSettlementStore();
  const { query, data: integratedDataRaw, isSaved: isClosed, hasSearched } = integrated;
  const integratedData = integratedDataRaw || { daily: [], gs: null, gsJinju: null, emergency: [], inquiry: [], fixed: [] };
  const safeData = integratedData;
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

  const [loading, setLoading] = useState(false);
  const [closedAt, setClosedAt] = useState<string | null>(null);
  const [closingLoading, setClosingLoading] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetchData = useCallback(async (start: string, end: string) => {
    setLoading(true);
    
    // 1. 마감 데이터 확인
    const closingRes = await getMonthlyClosing({ startDate: start, endDate: end });
    if (closingRes.success && closingRes.data) {
      setClosedAt(new Date(closingRes.data.closedAt).toLocaleString());
      setIntegratedState({ data: closingRes.data.data as any, isSaved: true, hasSearched: true });
      setLoading(false);
      return;
    } else {
      setClosedAt(null);
    }

    // 2. 실시간 데이터 조회
    const result = await getIntegratedBillingSummary({ startDate: start, endDate: end });
    if (result.success && result.data) {
      setIntegratedState({ data: result.data, isSaved: false, hasSearched: true });
    } else {
      console.error('Fetch data failed:', result.error);
      alert(result.error || '데이터를 가져오는데 실패했습니다.');
      setIntegratedState({ data: { daily: [], gs: null, gsJinju: null, emergency: [], inquiry: [], fixed: [] }, isSaved: false, hasSearched: true });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!hasSearched) {
      fetchData(startDate, endDate);
    }
  }, [startDate, endDate, hasSearched, fetchData]);

  const handleSearch = () => fetchData(startDate, endDate);

  // 엑셀 다운로드 구현
  const handleExcelDownload = () => {
    if (integratedData.daily.length === 0 && !integratedData.gs && integratedData.emergency.length === 0 && integratedData.inquiry.length === 0 && integratedData.fixed.length === 0 && (integratedData.gsJinju?.count || 0) === 0) {
      alert('다운로드할 데이터가 없습니다.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const wsData: any[] = [];

    // 스타일 정의
    const sHeader = {
      font: { sz: 16, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      fill: { fgColor: { rgb: "4F46E5" } }, // indigo-600
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    };
    const sPeriod = {
      font: { sz: 10, bold: true },
      alignment: { horizontal: "center" },
      fill: { fgColor: { rgb: "F8FAFC" } },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    };
    const sSection = {
      font: { sz: 12, bold: true, color: { rgb: "4F46E5" } },
      fill: { fgColor: { rgb: "EEF2FF" } }, // indigo-50
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    };
    const sTableHead = {
      font: { sz: 10, bold: true, color: { rgb: "475569" } }, // slate-600
      alignment: { horizontal: "center" },
      fill: { fgColor: { rgb: "F1F5F9" } }, // slate-100
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    };
    const sCell = {
      font: { sz: 10 },
      border: { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } }
    };
    const sCellNumber = {
      ...sCell,
      alignment: { horizontal: "right" },
      numFmt: "#,##0"
    };
    const sTotalLabel = {
      font: { sz: 12, bold: true },
      alignment: { horizontal: "center" },
      fill: { fgColor: { rgb: "F1F5F9" } },
      border: { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } }
    };
    const sTotalValue = {
      font: { sz: 14, bold: true, color: { rgb: "059669" } }, // emerald-600
      alignment: { horizontal: "right" },
      fill: { fgColor: { rgb: "ECFDF5" } }, // emerald-50
      numFmt: "#,##0",
      border: { top: { style: "medium" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } }
    };

    const emptyCell = { v: '', s: sCell };

    // 타이틀 및 기간
    wsData.push([
      { v: '지점청구 통합 요약 보고서', s: sHeader }, 
      { v: '', s: sHeader }, { v: '', s: sHeader }, { v: '', s: sHeader }, { v: '', s: sHeader }, { v: '', s: sHeader }
    ]);
    wsData.push([
      { v: `조회 기간: ${startDate} ~ ${endDate}`, s: sPeriod },
      { v: '', s: sPeriod }, { v: '', s: sPeriod }, { v: '', s: sPeriod }, { v: '', s: sPeriod }, { v: '', s: sPeriod }
    ]);
    wsData.push([]); // 빈 줄

    // 1. 고정 비용 정산 섹션
    if (integratedData.fixed.length > 0) {
      wsData.push([
        { v: '[1. 고정 비용 정산 (월 고정 청구)]', s: sSection },
        { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }
      ]);
      wsData.push([
        { v: '항목명', s: sTableHead }, { v: '구분', s: sTableHead }, { v: '단가(금액)', s: sTableHead }, 
        { v: '배송횟수', s: sTableHead }, { v: '청구금액', s: sTableHead }, { v: '비고', s: sTableHead }
      ]);
      integratedData.fixed.forEach(item => {
        wsData.push([
          { v: item.name, s: sCell },
          { v: '고정비용', s: sCell },
          { v: item.rate || item.amount, t: 'n', s: sCellNumber },
          { v: item.count || 1, t: 'n', s: sCellNumber },
          { v: item.amount, t: 'n', s: sCellNumber },
          { v: item.note || '-', s: sCell }
        ]);
      });
      wsData.push([]);
    }

    // 2. GS 출고 정산 섹션 ('GS수퍼_부산(냉동)' 포함)
    const gsBusanFrozen = integratedData.daily.find(item => item.placeName === 'GS수퍼_부산(냉동)');
    if (integratedData.gs || gsBusanFrozen) {
      wsData.push([
        { v: '[2. GS 출고 정산 요약 (부산/양산 통합)]', s: sSection },
        { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }
      ]);
      wsData.push([
        { v: '납품처', s: sTableHead }, { v: '구분', s: sTableHead }, { v: '단가', s: sTableHead }, 
        { v: '배송횟수', s: sTableHead }, { v: '청구금액', s: sTableHead }, { v: '비고', s: sTableHead }
      ]);
      
      if (integratedData.gs) {
        const gs = integratedData.gs.summary;
        wsData.push([
          { v: 'GS수퍼 (부산/양산 통합)', s: sCell },
          { v: 'KAM1팀', s: sCell },
          { v: 150000, t: 'n', s: sCellNumber },
          { v: gs.weekday + gs.saturday + gs.sunday, t: 'n', s: sCellNumber },
          { v: gs.totalAmount, t: 'n', s: sCellNumber },
          { v: `평일 ${gs.weekday}/토 ${gs.saturday}/일 ${gs.sunday}${gs.extraTrucks > 0 ? ` (+2회전 ${gs.extraTrucks}회)` : ''}`, s: sCell }
        ]);

        if (integratedData.gsJinju && integratedData.gsJinju.count > 0) {
          wsData.push([
            { v: 'GS 진주', s: sCell },
            { v: 'CVS리테일팀', s: sCell },
            { v: 150000, t: 'n', s: sCellNumber },
            { v: integratedData.gsJinju.count, t: 'n', s: sCellNumber },
            { v: integratedData.gsJinju.totalAmount, t: 'n', s: sCellNumber },
            { v: 'GS 진주 일요일 출고', s: sCell }
          ]);
        }
      }
      
      if (gsBusanFrozen) {
        wsData.push([
          { v: gsBusanFrozen.placeName, s: sCell },
          { v: gsBusanFrozen.billingRecipient || 'KAM1팀', s: sCell },
          { v: Math.round(gsBusanFrozen.totalAmount / gsBusanFrozen.deliveryDays), t: 'n', s: sCellNumber },
          { v: gsBusanFrozen.deliveryDays, t: 'n', s: sCellNumber },
          { v: gsBusanFrozen.totalAmount, t: 'n', s: sCellNumber },
          { v: 'GS 냉동 정산', s: sCell }
        ]);
      }
      wsData.push([]);
    }

    // 3. 1일 출고 정산 섹션 ('GS수퍼_부산(냉동)' 제외)
    const filteredDaily = integratedData.daily.filter(item => item.placeName !== 'GS수퍼_부산(냉동)');
    if (filteredDaily.length > 0) {
      wsData.push([
        { v: '[3. 1일 출고 정산 요약]', s: sSection },
        { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }
      ]);
      wsData.push([
        { v: '납품처', s: sTableHead }, { v: '구분', s: sTableHead }, { v: '단가', s: sTableHead }, 
        { v: '배송횟수', s: sTableHead }, { v: '청구금액', s: sTableHead }, { v: '비고', s: sTableHead }
      ]);
      filteredDaily.forEach(item => {
        wsData.push([
          { v: item.placeName, s: sCell },
          { v: item.billingRecipient || '본사청구', s: sCell },
          { v: Math.round(item.totalAmount / item.deliveryDays), t: 'n', s: sCellNumber },
          { v: item.deliveryDays, t: 'n', s: sCellNumber },
          { v: item.totalAmount, t: 'n', s: sCellNumber },
          { v: '정산 정보', s: sCell }
        ]);
      });
      wsData.push([]);
    }

    // 4. 긴급 출고 정산 내역
    if (integratedData.emergency.length > 0) {
      wsData.push([
        { v: '[4. 긴급 출고 정산 내역]', s: sSection },
        { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }
      ]);
      wsData.push([
        { v: '납품처', s: sTableHead }, { v: '구분', s: sTableHead }, { v: '단가', s: sTableHead }, 
        { v: '배송횟수', s: sTableHead }, { v: '청구금액', s: sTableHead }, { v: '비고', s: sTableHead }
      ]);
      integratedData.emergency.forEach(item => {
        const formattedDates = (item.dates && Array.isArray(item.dates))
          ? item.dates.map((d: string) => {
              const parts = d.split('-');
              if (parts.length < 3) return d;
              return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
            }).join(', ')
          : (item.memo && item.memo.includes('[') ? item.memo.split('[')[1].split(']')[0] : '-');

        wsData.push([
          { v: item.name, s: sCell },
          { v: '긴급출고', s: sCell },
          { v: item.rate, t: 'n', s: sCellNumber },
          { v: item.count, t: 'n', s: sCellNumber },
          { v: item.rate * item.count, t: 'n', s: sCellNumber },
          { v: formattedDates, s: sCell }
        ]);
      });
      wsData.push([]);
    }

    // 5. 청구 조회 정산 내역 섹션
    if (integratedData.inquiry.length > 0) {
      wsData.push([
        { v: '[5. 청구 조회 정산 내역]', s: sSection },
        { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }
      ]);
      wsData.push([
        { v: '납품처', s: sTableHead }, { v: '구분', s: sTableHead }, { v: '단가', s: sTableHead }, 
        { v: '배송횟수', s: sTableHead }, { v: '청구금액', s: sTableHead }, { v: '비고', s: sTableHead }
      ]);
      integratedData.inquiry.forEach(item => {
        wsData.push([
          { v: item.nap, s: sCell },
          { v: item.chung || item.so, s: sCell },
          { v: Math.round(item.kum / 1), t: 'n', s: sCellNumber },
          { v: 1, t: 'n', s: sCellNumber },
          { v: item.kum, t: 'n', s: sCellNumber },
          { v: item.date, s: sCell }
        ]);
      });
      wsData.push([]);
    }

    // 최종 합계
    wsData.push([
      { v: '[최종 통합 합계]', s: sSection },
      { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }, { v: '', s: sSection }
    ]);
    wsData.push([
      { v: '항목', s: sTableHead }, { v: '', s: sTableHead }, { v: '', s: sTableHead }, 
      { v: '총 배송횟수', s: sTableHead }, { v: '총 청구금액', s: sTableHead }, { v: '', s: sTableHead }
    ]);
    wsData.push([
      { v: '통합 합계', s: sTotalLabel },
      { v: '', s: sTotalLabel },
      { v: '', s: sTotalLabel },
      { v: totals.count, t: 'n', s: sTotalValue },
      { v: totals.cost, t: 'n', s: sTotalValue },
      { v: '', s: sTotalValue }
    ]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // 병합 설정 (타이틀, 섹션 제목 등)
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }, // 메인 타이틀
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }, // 기간
    ];

    // 자동 병합 (섹션 헤더 등)
    wsData.forEach((row, rowIndex) => {
      if (row.length > 0 && typeof row[0].v === 'string' && row[0].v.startsWith('[')) {
        ws['!merges']?.push({ s: { r: rowIndex, c: 0 }, e: { r: rowIndex, c: 5 } });
      }
    });

    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 30 }, // 납품처
      { wch: 15 }, // 구분
      { wch: 12 }, // 단가
      { wch: 12 }, // 배송횟수
      { wch: 15 }, // 청구금액
      { wch: 40 }, // 비고
    ];

    XLSX.utils.book_append_sheet(wb, ws, '통합청구요약');
    
    const fileName = `지점청구_통합요약_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}${isClosed ? '_마감문서' : ''}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // 마감 처리
  const handleClosing = async () => {
    if (integratedData.daily.length === 0 && !integratedData.gs && integratedData.emergency.length === 0 && integratedData.inquiry.length === 0 && integratedData.fixed.length === 0) {
      alert('마감할 데이터가 없습니다.');
      return;
    }

    if (!confirm(`${startDate} ~ ${endDate} 기간의 정산 데이터를 마감하시겠습니까?\n마감 시 현재 화면의 내용이 영구 보존되며, 원본 데이터 수정 시에도 반영되지 않습니다.`)) {
      return;
    }

    setClosingLoading(true);
    const res = await saveMonthlyClosing({
      startDate,
      endDate,
      data: integratedData
    });

    if (res.success) {
      alert('성공적으로 마감되었습니다.');
      fetchData(startDate, endDate);
    } else {
      alert(res.error || '마감에 실패했습니다.');
    }
    setClosingLoading(false);
  };

  // 마감 취소
  const handleCancelClosing = async () => {
    if (!confirm('마감을 취소하시겠습니까?\n마감 취소 시 실시간 집계 데이터가 다시 표시됩니다.')) {
      return;
    }

    setClosingLoading(true);
    const res = await deleteMonthlyClosing({ startDate, endDate });
    if (res.success) {
      alert('마감이 취소되었습니다.');
      fetchData(startDate, endDate);
    } else {
      alert(res.error || '마감 취소에 실패했습니다.');
    }
    setClosingLoading(false);
  };

  // 고정 비용 관리 상태
  const [isAddingFixed, setIsAddingFixed] = useState(false);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [fixedForm, setFixedForm] = useState({ name: '', billingRecipient: '', amount: 0, count: 0, rate: 0, memo: '' });

  const handleSaveFixed = async () => {
    if (!fixedForm.name || fixedForm.amount <= 0) {
      alert('항목명과 금액을 올바르게 입력해 주세요.');
      return;
    }
    const res = await saveFixedSettlement({
      id: editingFixedId || undefined,
      ...fixedForm
    });
    if (res.success) {
      setIsAddingFixed(false);
      setEditingFixedId(null);
      setFixedForm({ name: '', billingRecipient: '', amount: 0, count: 0, rate: 0, memo: '' });
      fetchData(startDate, endDate);
    } else {
      alert(res.error);
    }
  };

  const handleDeleteFixed = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;
    const res = await deleteFixedSettlement(id);
    if (res.success) {
      fetchData(startDate, endDate);
    }
  };

  // 합계 계산
  const totals = React.useMemo(() => {
    let cost = 0;
    let count = 0;
    let dailyCost = 0;
    let gsCost = 0;
    let emergencyCost = 0;
    let inquiryCost = 0;
    let fixedCost = 0;

    // 1일 출고
    safeData.daily.forEach(item => {
      dailyCost += item.totalAmount;
      count += item.deliveryDays;
    });

    // GS 출고
    if (safeData.gs) {
      gsCost += safeData.gs.summary.totalAmount;
      const gsDays = (safeData.gs.summary.weekday + safeData.gs.summary.saturday + safeData.gs.summary.sunday);
      count += gsDays;
    }
    if (safeData.gsJinju) {
      gsCost += safeData.gsJinju.totalAmount;
      count += safeData.gsJinju.count;
    }

    // 긴급 출고
    safeData.emergency.forEach(item => {
      emergencyCost += (item.rate * item.count);
      count += item.count;
    });

    // 청구 조회
    safeData.inquiry.forEach(item => {
      inquiryCost += item.kum;
      count += 1;
    });

    // 고정 비용
    safeData.fixed.forEach(item => {
      fixedCost += item.amount;
    });

    cost = dailyCost + gsCost + emergencyCost + inquiryCost + fixedCost;

    return { cost, count, dailyCost, gsCost, emergencyCost, inquiryCost, fixedCost };
  }, [safeData]);

  return (
    <div className="space-y-4 pb-20">
      {/* Top Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex flex-wrap items-center gap-4">
          <MonthSelector currentDate={selectedMonth} onChange={setSelectedMonth} />
          <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>
          <span className="text-[12px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
            {startDate} ~ {endDate}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-[13px] font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-100 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            조회하기
          </button>
          <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>
          <button 
            onClick={handleExcelDownload}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-slate-700 rounded-lg text-[12px] font-bold text-white hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
          >
            <Download size={15} /> 엑셀 다운로드
          </button>
          
          {!isClosed ? (
            <button 
              onClick={handleClosing}
              disabled={loading || closingLoading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 rounded-lg text-[12px] font-bold text-white hover:bg-emerald-700 transition-all active:scale-95 shadow-md shadow-emerald-100 disabled:opacity-50"
            >
              {closingLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              월간 마감
            </button>
          ) : (
            <button 
              onClick={handleCancelClosing}
              disabled={loading || closingLoading}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500 rounded-lg text-[12px] font-bold text-white hover:bg-rose-600 transition-all active:scale-95 shadow-md shadow-rose-100 disabled:opacity-50"
            >
              {closingLoading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              마감 취소
            </button>
          )}
        </div>
      </div>

      {isClosed && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-emerald-900">본 보고서는 마감된 자료입니다.</p>
              <p className="text-[12px] text-emerald-600 font-medium">마감 일시: {closedAt} (데이터 정정 불가)</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded uppercase tracking-wider">snapshot mode</span>
        </div>
      )}

      {/* Main Table Container */}
      <div className="bg-white rounded-xl shadow-sm border-2 border-slate-200 overflow-hidden">
        <div className="overflow-x-auto min-h-[600px]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b-2 border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">납품처</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">청구처</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">단가</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">배송/횟수</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">청구금액</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">비고/정보</th>
                {!isClosed && <th className="px-4 py-3 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-20 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    데이터를 집계하고 있습니다...
                  </td>
                </tr>
              ) : (
                <>
                  {/* 1. 고정 비용 */}
                  <tr className="bg-indigo-50/50">
                    <td colSpan={7} className="px-4 py-2 text-[11px] font-black text-indigo-700 border-y-2 border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={12} /> 1. 고정 비용 정산 (월 고정 청구)
                      </div>
                      {!isClosed && !isAddingFixed && (
                        <button 
                          onClick={() => { setIsAddingFixed(true); setEditingFixedId(null); setFixedForm({ name: '', billingRecipient: '', amount: 0, count: 0, rate: 0, memo: '' }); }}
                          className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700"
                        >
                          <Plus size={10} /> 추가
                        </button>
                      )}
                    </td>
                  </tr>

                  {isAddingFixed && (
                    <tr className="bg-indigo-50/30">
                      <td className="px-4 py-2"><input type="text" placeholder="항목명" value={fixedForm.name} onChange={e => setFixedForm({...fixedForm, name: e.target.value})} className="w-full px-2 py-1 text-[12px] border-2 rounded" /></td>
                      <td className="px-4 py-2"><input type="text" placeholder="청구처" value={fixedForm.billingRecipient} onChange={e => setFixedForm({...fixedForm, billingRecipient: e.target.value})} className="w-full px-2 py-1 text-[12px] border-2 rounded" /></td>
                      <td className="px-4 py-2 text-right"><input type="number" placeholder="단가" value={fixedForm.rate || ''} onChange={e => { const rate = Number(e.target.value); setFixedForm({...fixedForm, rate, amount: fixedForm.count * rate}); }} className="w-24 px-2 py-1 text-[12px] border-2 rounded text-right" /></td>
                      <td className="px-4 py-2 text-center"><input type="number" placeholder="횟수" value={fixedForm.count || ''} onChange={e => { const count = Number(e.target.value); setFixedForm({...fixedForm, count, amount: count * fixedForm.rate}); }} className="w-16 px-2 py-1 text-[12px] border-2 rounded text-center" /></td>
                      <td className="px-4 py-2 text-right font-bold text-indigo-600">₩{fixedForm.amount.toLocaleString()}</td>
                      <td className="px-4 py-2"><input type="text" placeholder="비고" value={fixedForm.memo} onChange={e => setFixedForm({...fixedForm, memo: e.target.value})} className="w-full px-2 py-1 text-[12px] border-2 rounded" /></td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <button onClick={handleSaveFixed} className="text-emerald-600"><CheckCircle size={14}/></button>
                          <button onClick={() => setIsAddingFixed(false)} className="text-slate-400"><X size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {integratedData.fixed.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800">{item.name}</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500">{item.billingRecipient || '본사청구'}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400 text-right">₩{(item.rate || 0).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-700 font-bold text-center">{item.count || 0}회</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-indigo-600 text-right">₩{item.amount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400 uppercase">{item.note || '-'}</td>
                      {!isClosed && (
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setIsAddingFixed(true); setEditingFixedId(item.id); setFixedForm({ name: item.name, billingRecipient: item.billingRecipient || '', amount: item.amount, count: item.count || 0, rate: item.rate || 0, memo: item.note || '' }); }} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 size={13}/></button>
                            <button onClick={() => handleDeleteFixed(item.id)} className="p-1 text-slate-400 hover:text-rose-500"><Trash2 size={13}/></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}

                  {/* 2. GS 출고 */}
                  <tr className="bg-emerald-50/50">
                    <td colSpan={7} className="px-4 py-2 text-[11px] font-black text-emerald-700 border-y-2 border-emerald-100 flex items-center gap-2">
                      <Truck size={12} /> 2. GS 출고 정산 요약 (부산/양산/진주)
                    </td>
                  </tr>
                  {integratedData.gs && (
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800">GS수퍼 (부산/양산 통합)</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500">KAM1팀</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400 text-right">₩150,000</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-700 text-center">{integratedData.gs.summary.weekday + integratedData.gs.summary.saturday + integratedData.gs.summary.sunday}일</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-emerald-600 text-right">₩{integratedData.gs.summary.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-500">
                        평일{integratedData.gs.summary.weekday}/토{integratedData.gs.summary.saturday}/일{integratedData.gs.summary.sunday} 
                        {integratedData.gs.summary.extraTrucks > 0 && ` (+2회전 ${integratedData.gs.summary.extraTrucks})`}
                      </td>
                      {!isClosed && <td className="px-4 py-2.5"></td>}
                    </tr>
                  )}
                  {integratedData.gsJinju && integratedData.gsJinju.count > 0 && (
                    <tr className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800">GS 진주</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500">CVS리테일팀</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400 text-right">₩150,000</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-700 text-center">{integratedData.gsJinju.count}일</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-emerald-600 text-right">₩{integratedData.gsJinju.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-500">GS 진주 일요일 출고</td>
                      {!isClosed && <td className="px-4 py-2.5"></td>}
                    </tr>
                  )}
                  {/* GS수퍼_부산(냉동) 이동 수록 */}
                  {integratedData.daily.filter(item => item.placeName === 'GS수퍼_부산(냉동)').map((item, idx) => (
                    <tr key={`gs-frozen-${idx}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800">{item.placeName}</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500">{item.billingRecipient || 'KAM1팀'}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400 text-right">₩{Math.round(item.totalAmount / item.deliveryDays).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-700 text-center">{item.deliveryDays}일</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-emerald-600 text-right">₩{item.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-500">GS 냉동 정산</td>
                      {!isClosed && <td className="px-4 py-2.5"></td>}
                    </tr>
                  ))}

                  {/* 3. 1일 출고 */}
                  <tr className="bg-blue-50/50">
                    <td colSpan={7} className="px-4 py-2 text-[11px] font-black text-blue-700 border-y-2 border-blue-100 flex items-center gap-2">
                      <Truck size={12} /> 3. 1일 출고 정산 요약
                    </td>
                  </tr>
                  {integratedData.daily.filter(item => item.placeName !== 'GS수퍼_부산(냉동)').map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-700">{item.placeName}</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500">{item.billingRecipient || '본사청구'}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400 text-right">₩{(item.totalAmount / item.deliveryDays).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-700 text-center">{item.deliveryDays}일</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-blue-600 text-right">₩{item.totalAmount.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400 capitalize">정산 정보</td>
                      {!isClosed && <td className="px-4 py-2.5"></td>}
                    </tr>
                  ))}

                  {/* 4. 긴급 출고 */}
                  <tr className="bg-rose-50/50">
                    <td colSpan={7} className="px-4 py-2 text-[11px] font-black text-rose-700 border-y-2 border-rose-100 flex items-center gap-2">
                      <AlertCircle size={12} /> 4. 긴급 출고 정산 내역
                    </td>
                  </tr>
                  {integratedData.emergency.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800">{item.name}</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500">{item.chung || '-'}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400 text-right">₩{item.rate.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-700 text-center">{item.count}회</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-rose-600 text-right">₩{(item.rate * item.count).toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400 truncate max-w-[200px]">{Array.isArray(item.dates) ? item.dates.map((d: any) => d.split('-').slice(1).join('/')).join(', ') : '-'}</td>
                      {!isClosed && <td className="px-4 py-2.5"></td>}
                    </tr>
                  ))}

                  {/* 5. 청구 조회 */}
                  <tr className="bg-amber-50/50">
                    <td colSpan={7} className="px-4 py-2 text-[11px] font-black text-amber-700 border-y-2 border-amber-100 flex items-center gap-2">
                      <FileSpreadsheet size={12} /> 5. 청구 조회 정산 내역 (t_il_car)
                    </td>
                  </tr>
                  {integratedData.inquiry.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800">{item.nap}</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500">{item.chung || item.so}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400 text-right">₩{item.kum.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-slate-700 text-center">1회</td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-amber-600 text-right">₩{item.kum.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-[11px] text-slate-400">{item.date}</td>
                      {!isClosed && <td className="px-4 py-2.5"></td>}
                    </tr>
                  ))}
                  
                  {/* Total Row */}
                  {(totals.count > 0 || totals.cost > 0) && (
                    <tr className="bg-slate-800 text-white font-bold">
                      <td colSpan={3} className="px-4 py-4 text-[13px] text-center uppercase tracking-widest font-black">통합 청구 합계</td>
                      <td className="px-4 py-4 text-center border-x-2 border-white/10">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/20 text-[11px] font-black">
                          {totals.count}회 전체 배송
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[16px] text-amber-400 text-right font-black">
                        ₩{totals.cost.toLocaleString()}
                      </td>
                      <td colSpan={!isClosed ? 2 : 1} className="px-4 py-4 text-[11px] text-slate-400 text-right italic font-normal">
                        * 각 정산 메뉴에서 &apos;결과 저장&apos;된 데이터만 취합됩니다.
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
