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
  Calculator,
  X
} from 'lucide-react';
import { saveFixedSettlement, deleteFixedSettlement } from '@/actions/billing';
import { getIntegratedBillingSummary } from '@/actions/settlements';
import { saveMonthlyClosing, getMonthlyClosing, deleteMonthlyClosing } from '@/actions/closing';
import { MonthSelector } from '@/components/MonthSelector';
import * as XLSX from 'xlsx-js-style';
import { useSettlementStore } from '@/store/useSettlementStore';

// 섹션 카드 컴포넌트
interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  accentColor: 'indigo' | 'emerald' | 'blue' | 'rose' | 'amber' | 'slate';
  children: React.ReactNode;
  rightElement?: React.ReactNode;
}

const SectionCard = ({ title, icon, accentColor, children, rightElement }: SectionCardProps) => {
  const colors = {
    indigo: 'border-t-indigo-500 text-indigo-700 bg-indigo-50/10',
    emerald: 'border-t-emerald-500 text-emerald-700 bg-emerald-50/10',
    blue: 'border-t-blue-500 text-blue-700 bg-blue-50/10',
    rose: 'border-t-rose-500 text-rose-700 bg-rose-50/10',
    amber: 'border-t-amber-500 text-amber-700 bg-amber-50/10',
    slate: 'border-t-slate-500 text-slate-700 bg-slate-50/10',
  };

  return (
    <div className={`bg-white rounded-xl shadow-md border border-slate-200 border-t-4 ${colors[accentColor].split(' ')[0]} overflow-hidden flex flex-col transition-all hover:shadow-lg`}>
      <div className={`px-4 py-2.5 border-b border-slate-100 flex items-center justify-between ${colors[accentColor].split(' ').slice(2).join(' ')}`}>
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-white rounded-lg shadow-sm flex items-center justify-center">
            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement<any>, { size: 16, className: colors[accentColor].split(' ')[1] }) : icon}
          </div>
          <h3 className={`text-[13px] font-bold ${colors[accentColor].split(' ')[1]}`}>{title}</h3>
        </div>
        {rightElement}
      </div>
      <div className="overflow-x-auto">
        {children}
      </div>
    </div>
  );
};

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
    <div className="space-y-6 pb-20">
      {/* Top Bar */}
      <div className="bg-white/80 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
        <div className="flex flex-wrap items-center gap-4">
          <MonthSelector currentDate={selectedMonth} onChange={setSelectedMonth} />
          <div className="h-6 w-[1px] bg-slate-200 hidden sm:block"></div>
          <span className="text-[12px] font-bold text-slate-500 bg-slate-100/50 px-3 py-1.5 rounded-full border border-slate-200/50">
            {startDate} ~ {endDate}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleSearch}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl text-[13px] font-bold hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            조회하기
          </button>
          <div className="h-6 w-[1px] bg-slate-200 mx-1"></div>
          <button 
            onClick={handleExcelDownload}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 rounded-xl text-[12px] font-bold text-white hover:bg-slate-900 transition-all active:scale-95 disabled:opacity-50"
          >
            <Download size={15} /> 엑셀 다운로드
          </button>
          
          {!isClosed ? (
            <button 
              onClick={handleClosing}
              disabled={loading || closingLoading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 rounded-xl text-[12px] font-bold text-white hover:bg-emerald-700 transition-all active:scale-95 shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              {closingLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle size={15} />}
              월간 마감 완료
            </button>
          ) : (
            <button 
              onClick={handleCancelClosing}
              disabled={loading || closingLoading}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500 rounded-xl text-[12px] font-bold text-white hover:bg-rose-600 transition-all active:scale-95 shadow-lg shadow-rose-100 disabled:opacity-50"
            >
              {closingLoading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
              마감 취소
            </button>
          )}
        </div>
      </div>

      {isClosed && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-inner">
              <CheckCircle size={20} />
            </div>
            <div>
              <p className="text-[14px] font-black text-emerald-900">본 보고서는 마감된 자료입니다.</p>
              <p className="text-[12px] text-emerald-600 font-medium">마감 일시: {closedAt} (데이터 정정 불가)</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-emerald-600 text-white text-[10px] font-black rounded-full uppercase tracking-wider shadow-sm">snapshot mode</span>
        </div>
      )}

      {/* Summary Dashboard Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-5 rounded-3xl shadow-xl shadow-indigo-100 text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><Calculator size={80} /></div>
          <p className="text-[13px] font-bold opacity-80 mb-1 leading-none">전체 통합 청구 합계</p>
          <h2 className="text-[28px] font-black tracking-tighter">₩{totals.cost.toLocaleString()}</h2>
          <div className="mt-4 flex items-center gap-2 text-[11px] font-bold bg-white/10 w-fit px-2 py-1 rounded-lg"><Truck size={12} /> {totals.count}회 전체 배송</div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[12px] font-bold text-slate-400 mb-1">고정비 & 정산내역</p>
            <h3 className="text-[20px] font-black text-slate-800">₩{(totals.fixedCost + totals.inquiryCost).toLocaleString()}</h3>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${Math.min(100, ((totals.fixedCost + totals.inquiryCost) / (totals.cost || 1)) * 100)}%` }}></div></div>
            <span className="text-[11px] font-black text-slate-400">{Math.round(((totals.fixedCost + totals.inquiryCost) / (totals.cost || 1)) * 100)}%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[12px] font-bold text-slate-400 mb-1">일반 / GS 출고 합계</p>
            <h3 className="text-[20px] font-black text-slate-800">₩{(totals.dailyCost + totals.gsCost).toLocaleString()}</h3>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, ((totals.dailyCost + totals.gsCost) / (totals.cost || 1)) * 100)}%` }}></div></div>
            <span className="text-[11px] font-black text-slate-400">{Math.round(((totals.dailyCost + totals.gsCost) / (totals.cost || 1)) * 100)}%</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <p className="text-[12px] font-bold text-rose-400 mb-1">긴급 출고 합계</p>
            <h3 className="text-[20px] font-black text-slate-800">₩{totals.emergencyCost.toLocaleString()}</h3>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-rose-500" style={{ width: `${Math.min(100, (totals.emergencyCost / (totals.cost || 1)) * 100)}%` }}></div></div>
            <span className="text-[11px] font-black text-rose-500">{Math.round((totals.emergencyCost / (totals.cost || 1)) * 100)}%</span>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* 1. 고정 비용 */}
        <SectionCard title="1. 고정 비용 정산 (월 고정 청구)" icon={<FileSpreadsheet />} accentColor="indigo"
          rightElement={!isClosed && !isAddingFixed && (
            <button onClick={() => { setIsAddingFixed(true); setEditingFixedId(null); setFixedForm({ name: '', billingRecipient: '', amount: 0, count: 0, rate: 0, memo: '' }); }}
              className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600 text-white rounded-lg text-[11px] font-bold hover:bg-indigo-700 shadow-sm transition-all"><Plus size={12} /> 항목 추가</button>
          )}>
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">항목명</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">청구처</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">단가/조건</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-center">횟수</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">청구금액</th>
                <th className="px-4 py-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right w-20 px-4">비고</th>
                {!isClosed && <th className="px-4 py-2.5 w-16"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isAddingFixed && (
                 <tr className="bg-indigo-50/20">
                   <td className="px-4 py-2"><input type="text" value={fixedForm.name} onChange={e => setFixedForm({...fixedForm, name: e.target.value})} className="w-full px-2 py-1 text-[12px] border rounded" /></td>
                   <td className="px-4 py-2"><input type="text" value={fixedForm.billingRecipient} onChange={e => setFixedForm({...fixedForm, billingRecipient: e.target.value})} className="w-full px-2 py-1 text-[12px] border rounded" /></td>
                   <td className="px-4 py-2 text-right"><input type="number" value={fixedForm.rate || ''} onChange={e => { const rate = Number(e.target.value); setFixedForm({...fixedForm, rate, amount: fixedForm.count * rate}); }} className="w-20 px-2 py-1 text-[12px] border rounded text-right" /></td>
                   <td className="px-4 py-2 text-center"><input type="number" value={fixedForm.count || ''} onChange={e => { const count = Number(e.target.value); setFixedForm({...fixedForm, count, amount: count * fixedForm.rate}); }} className="w-16 px-2 py-1 text-[12px] border rounded text-center" /></td>
                   <td className="px-4 py-2 text-right font-bold text-indigo-600">₩{fixedForm.amount.toLocaleString()}</td>
                   <td className="px-4 py-2"><input type="text" value={fixedForm.memo} onChange={e => setFixedForm({...fixedForm, memo: e.target.value})} className="w-full px-2 py-1 text-[12px] border rounded text-right" /></td>
                   <td className="px-4 py-2 text-center"><div className="flex gap-1 justify-center"><button onClick={handleSaveFixed} className="text-emerald-600"><CheckCircle size={14}/></button><button onClick={() => setIsAddingFixed(false)} className="text-slate-400"><X size={14}/></button></div></td>
                 </tr>
              )}
              {integratedData.fixed.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800">{item.name}</td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-500">{item.billingRecipient || '본사청구'}</td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-400 text-right">₩{(item.rate || 0).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-[12px] text-slate-700 font-bold text-center">{item.count || 0}회</td>
                  <td className="px-4 py-2.5 text-[13px] font-black text-indigo-600 text-right">₩{item.amount.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-400 text-right">{item.note || '-'}</td>
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
            </tbody>
          </table>
        </SectionCard>

        {/* 2. GS 출고 */}
        <SectionCard title="2. GS 출고 정산 요약 (부산/양산/진주)" icon={<Truck />} accentColor="emerald">
          <table className="w-full text-left border-collapse">
            <tbody className="divide-y divide-slate-100">
              {integratedData.gs && (
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800 w-1/3">GS수퍼 (부산/양산 통합) <span className="text-[10px] text-slate-400 ml-2">KAM1팀</span></td>
                  <td className="px-4 py-2.5 text-right"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-black text-[10px]">{integratedData.gs.summary.weekday + integratedData.gs.summary.saturday + integratedData.gs.summary.sunday}일</span></td>
                  <td className="px-4 py-2.5 text-[14px] font-black text-emerald-600 text-right w-1/4">₩{integratedData.gs.summary.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-500 text-right">평일{integratedData.gs.summary.weekday}/토{integratedData.gs.summary.saturday}/일{integratedData.gs.summary.sunday} {integratedData.gs.summary.extraTrucks > 0 && `(+2회전 ${integratedData.gs.summary.extraTrucks})`}</td>
                </tr>
              )}
              {integratedData.gsJinju && integratedData.gsJinju.count > 0 && (
                <tr className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800 w-1/3">GS 진주 <span className="text-[10px] text-slate-400 ml-2">CVS리테일팀</span></td>
                  <td className="px-4 py-2.5 text-right"><span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-black text-[10px]">{integratedData.gsJinju.count}일</span></td>
                  <td className="px-4 py-2.5 text-[14px] font-black text-emerald-600 text-right w-1/4">₩{integratedData.gsJinju.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-[11px] text-slate-500 text-right">GS 진주 일요일 출고</td>
                </tr>
              )}
            </tbody>
          </table>
        </SectionCard>

        {/* 3. 1일 출고 */}
        <SectionCard title="3. 1일 출고 정산 요약" icon={<Truck />} accentColor="blue">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr><th className="px-4 py-2 text-[11px] font-bold text-slate-400">납품처</th><th className="px-4 py-2 text-right text-[11px] font-bold text-slate-400">배송일수</th><th className="px-4 py-2 text-right text-[11px] font-bold text-slate-400">청구금액</th><th className="px-4 py-2 text-right text-[11px] font-bold text-slate-400">청구처</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {integratedData.daily.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2 text-[12px] font-bold text-slate-700">{item.placeName}</td>
                  <td className="px-4 py-2 text-right"><span className="text-[11px] font-black text-blue-600">{item.deliveryDays}일</span></td>
                  <td className="px-4 py-2 text-right font-black text-slate-800 text-[13px]">₩{item.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-[11px] text-slate-400">{item.billingRecipient || '본사청구'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        {/* 4. 긴급 출고 */}
        <SectionCard title="4. 긴급 출고 정산 내역" icon={<AlertCircle />} accentColor="rose">
          <table className="w-full text-left">
            <tbody className="divide-y divide-slate-100">
              {integratedData.emergency.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800 w-1/3">{item.name} <span className="text-[10px] text-slate-400 ml-2">{item.chung || '-'}</span></td>
                  <td className="px-4 py-2.5 text-right"><span className="px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full font-black text-[10px]">{item.count}회</span></td>
                  <td className="px-4 py-2.5 text-[14px] font-black text-rose-600 text-right w-1/4">₩{(item.rate * item.count).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-[10px] text-slate-400 text-right">{Array.isArray(item.dates) ? item.dates.map((d: any) => d.split('-').slice(1).join('/')).join(', ') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        {/* 5. 청구 조회 */}
        <SectionCard title="5. 청구 조회 정산 내역 (t_il_car)" icon={<FileSpreadsheet />} accentColor="amber">
          <table className="w-full text-left">
            <tbody className="divide-y divide-slate-100">
              {integratedData.inquiry.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800 w-1/3">{item.nap} <span className="text-[10px] text-slate-400 ml-2">{item.chung || item.so}</span></td>
                  <td className="px-4 py-2.5 text-right"><span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-black text-[10px]">1회</span></td>
                  <td className="px-4 py-2.5 text-[14px] font-black text-amber-600 text-right w-1/4">₩{item.kum.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-[10px] text-slate-400 text-right">{item.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    </div>
  );
}
