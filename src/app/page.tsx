'use client';

import React, { useState, useEffect } from 'react';
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
  Edit2
} from 'lucide-react';
import { getIntegratedBillingSummary } from '@/actions/settlements';
import { saveFixedSettlement, deleteFixedSettlement } from '@/actions/billing';
import * as XLSX from 'xlsx-js-style';

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
    // 기본값: 전월 26일 ~ 당월 25일
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 26);
    return formatDate(start);
  });
  const [endDate, setEndDate] = useState(() => {
    const today = getKSTToday();
    const end = new Date(today.getFullYear(), today.getMonth(), 25);
    return formatDate(end);
  });
  
  const [integratedData, setIntegratedData] = useState<{
    daily: any[];
    gs: any | null;
    gsJinju: any | null;
    emergency: any[];
    inquiry: any[];
    fixed: any[];
  }>({ daily: [], gs: null, gsJinju: null, emergency: [], inquiry: [], fixed: [] });
  const [loading, setLoading] = useState(false);

  const fetchData = async (start: string, end: string) => {
    setLoading(true);
    const result = await getIntegratedBillingSummary({ startDate: start, endDate: end });
    if (result.success && result.data) {
      setIntegratedData(result.data);
    } else {
      console.error('Fetch data failed:', result.error);
      alert(result.error || '데이터를 가져오는데 실패했습니다.');
      setIntegratedData({ daily: [], gs: null, gsJinju: null, emergency: [], inquiry: [], fixed: [] });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData(startDate, endDate);
  }, []);

  const handleSearch = () => fetchData(startDate, endDate);

  // 당월 (26일 기준): 전월 26일 ~ 당월 25일
  const setMonthCurrent = () => {
    const today = getKSTToday();
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 26);
    const end = new Date(today.getFullYear(), today.getMonth(), 25);
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

  // 전월 (26일 기준): 전전월 26일 ~ 전월 25일
  const setMonthPrevious = () => {
    const today = getKSTToday();
    const start = new Date(today.getFullYear(), today.getMonth() - 2, 26);
    const end = new Date(today.getFullYear(), today.getMonth() - 1, 25);
    setStartDate(formatDate(start));
    setEndDate(formatDate(end));
  };

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
          { v: item.amount, t: 'n', s: sCellNumber },
          { v: '월 고정', s: sCell },
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
            { v: 'KAM1팀', s: sCell },
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
          { v: item.so, s: sCell },
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
    
    const fileName = `지점청구_통합요약_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  // 고정 비용 관리 상태
  const [isAddingFixed, setIsAddingFixed] = useState(false);
  const [editingFixedId, setEditingFixedId] = useState<string | null>(null);
  const [fixedForm, setFixedForm] = useState({ name: '', amount: 0, memo: '' });

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
      setFixedForm({ name: '', amount: 0, memo: '' });
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

    // 1일 출고
    integratedData.daily.forEach(item => {
      cost += item.totalAmount;
      count += item.deliveryDays;
    });

    // GS 출고
    if (integratedData.gs) {
      cost += integratedData.gs.summary.totalAmount;
      const gsDays = (integratedData.gs.summary.weekday + integratedData.gs.summary.saturday + integratedData.gs.summary.sunday);
      count += gsDays;
    }
    if (integratedData.gsJinju) {
      cost += integratedData.gsJinju.totalAmount;
      count += integratedData.gsJinju.count;
    }

    // 긴급 출고
    integratedData.emergency.forEach(item => {
      cost += (item.rate * item.count);
      count += item.count;
    });

    // 청구 조회
    integratedData.inquiry.forEach(item => {
      cost += item.kum;
      count += 1; // 저장된 레코드당 1회로 간주
    });

    // 고정 비용 (추가)
    integratedData.fixed.forEach(item => {
      cost += item.amount;
    });

    return { cost, count };
  }, [integratedData]);

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
          <button 
            onClick={handleExcelDownload}
            disabled={loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-700 rounded-lg text-[11px] font-bold text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
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
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">단가</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">배송횟수</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">청구금액</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">비고/정산기준</th>
                <th className="px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    데이터를 통합하고 있습니다...
                  </td>
                </tr>
              ) : (integratedData.daily.length === 0 && !integratedData.gs && integratedData.emergency.length === 0 && integratedData.inquiry.length === 0 && integratedData.fixed.length === 0 && (integratedData.gsJinju?.count || 0) === 0) ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    저장된 정산 요약 데이터가 없습니다. 각 정산 페이지에서 &apos;결과 저장&apos;을 먼저 진행해 주세요.
                  </td>
                </tr>
              ) : (
                <>
                  {/* Section 1: 고정 비용 정산 (최상단 이동) */}
                  <tr className="bg-slate-50/50">
                    <td colSpan={7} className="px-4 py-2 text-[11px] font-black text-indigo-600 border-y border-slate-200 uppercase tracking-tighter flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <FileSpreadsheet size={12} /> 1. 고정 비용 정산 (월 고정 청구)
                       </div>
                       {!isAddingFixed && (
                         <button 
                           onClick={() => {
                             setIsAddingFixed(true);
                             setEditingFixedId(null);
                             setFixedForm({ name: '', amount: 0, memo: '' });
                           }}
                           className="flex items-center gap-1 px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-bold hover:bg-indigo-700"
                         >
                           <Plus size={10} /> 정산 항목 추가
                         </button>
                       )}
                    </td>
                  </tr>
                  
                  {isAddingFixed && (
                    <tr className="bg-indigo-50/20">
                      <td className="px-4 py-2">
                        <input 
                          type="text" 
                          placeholder="항목명 (거래처 등)"
                          value={fixedForm.name}
                          onChange={e => setFixedForm({...fixedForm, name: e.target.value})}
                          className="w-full px-2 py-1 text-[12px] border rounded"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <span className="text-[11px] text-slate-400">-</span>
                      </td>
                      <td className="px-4 py-2" colSpan={2}>
                        <input 
                          type="number" 
                          placeholder="금액"
                          value={fixedForm.amount || ''}
                          onChange={e => setFixedForm({...fixedForm, amount: Number(e.target.value)})}
                          className="w-full px-2 py-1 text-[12px] border rounded text-right"
                        />
                      </td>
                      <td colSpan={1}></td>
                      <td className="px-4 py-2">
                        <input 
                          type="text" 
                          placeholder="비고"
                          value={fixedForm.memo}
                          onChange={e => setFixedForm({...fixedForm, memo: e.target.value})}
                          className="w-full px-2 py-1 text-[12px] border rounded"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center gap-1">
                          <button onClick={handleSaveFixed} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><CheckCircle size={14}/></button>
                          <button onClick={() => {setIsAddingFixed(false); setEditingFixedId(null);}} className="p-1 text-slate-400 hover:bg-slate-50 rounded"><AlertCircle size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  )}

                  {integratedData.fixed.map((item, idx) => (
                    <tr key={`fixed-${idx}`} className="hover:bg-indigo-50/10 transition-colors group">
                      <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-800">{item.name}</td>
                      <td className="px-4 py-2.5 text-[12px] text-slate-500">고정비용</td>
                      <td className="px-4 py-2.5 text-[12px] font-medium text-slate-500 text-right">
                        {item.amount.toLocaleString()}원
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-[10px] font-bold text-amber-600">월 고정</span>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] font-bold text-amber-600 text-right">{item.amount.toLocaleString()}원</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] text-slate-700 font-medium">{item.note || '-'}</span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setIsAddingFixed(true);
                              setEditingFixedId(item.id);
                              setFixedForm({ name: item.name, amount: item.amount, memo: item.note || '' });
                            }}
                            className="p-1 text-slate-400 hover:text-indigo-600"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button 
                            onClick={() => handleDeleteFixed(item.id)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {/* Section 2: GS 출고 정산 ('GS수퍼_부산(냉동)' 통합) */}
                  {(() => {
                    const gsBusanFrozen = integratedData.daily.find(item => item.placeName === 'GS수퍼_부산(냉동)');
                    if (!integratedData.gs && !gsBusanFrozen) return null;

                    return (
                      <>
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-4 py-2 text-[11px] font-black text-indigo-600 border-y border-slate-200 uppercase tracking-tighter flex items-center gap-2">
                             <Truck size={12} /> 2. GS 출고 정산 요약 (부산/양산 통합)
                          </td>
                        </tr>
                        {integratedData.gs && (() => {
                          const gs = integratedData.gs.summary;
                          const formattedDates = (gs.dates && Array.isArray(gs.dates))
                            ? gs.dates.map((d: string) => {
                                const parts = d.split('-');
                                if (parts.length < 3) return d;
                                return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
                              }).join(', ')
                            : '-';

                          return (
                            <tr className="hover:bg-indigo-50/10 transition-colors bg-amber-50/5">
                              <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-800">GS수퍼 (부산/양산 통합)</td>
                              <td className="px-4 py-2.5 text-[12px] text-slate-500">KAM1팀</td>
                              <td className="px-4 py-2.5 text-[12px] font-medium text-slate-500 text-right">150,000원</td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">
                                  {gs.weekday + gs.saturday + gs.sunday}일
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-[12px] font-bold text-indigo-600 text-right">{gs.totalAmount.toLocaleString()}원</td>
                              <td className="px-4 py-2.5">
                                <div className="text-[11px] text-slate-700 font-bold">
                                  평일 {gs.weekday} / 토 {gs.saturday} / 일 {gs.sunday}
                                  {gs.extraTrucks > 0 && <span className="ml-2 text-amber-600 font-black">(+2회전 {gs.extraTrucks}회 가산)</span>}
                                </div>
                              </td>
                              <td className="px-4 py-2.5"></td>
                            </tr>
                          );
                        })()}
                        {integratedData.gsJinju && integratedData.gsJinju.count > 0 && (
                          <tr className="hover:bg-indigo-50/10 transition-colors bg-amber-50/5">
                            <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-800">GS 진주</td>
                            <td className="px-4 py-2.5 text-[12px] text-slate-500">KAM1팀</td>
                            <td className="px-4 py-2.5 text-[12px] font-medium text-slate-500 text-right">150,000원</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">
                                {integratedData.gsJinju.count}일
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[12px] font-bold text-indigo-600 text-right">{integratedData.gsJinju.totalAmount.toLocaleString()}원</td>
                            <td className="px-4 py-2.5">
                              <span className="text-[11px] text-slate-700 font-bold">GS 진주 일요일 출고</span>
                            </td>
                            <td className="px-4 py-2.5"></td>
                          </tr>
                        )}
                        {gsBusanFrozen && (
                          <tr className="hover:bg-indigo-50/10 transition-colors bg-amber-50/5">
                            <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-800">{gsBusanFrozen.placeName}</td>
                            <td className="px-4 py-2.5 text-[12px] text-slate-500">{gsBusanFrozen.billingRecipient || 'KAM1팀'}</td>
                            <td className="px-4 py-2.5 text-[12px] font-medium text-slate-500 text-right">
                              {Math.round(gsBusanFrozen.totalAmount / gsBusanFrozen.deliveryDays).toLocaleString()}원
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-indigo-100 text-[10px] font-bold text-indigo-700">{gsBusanFrozen.deliveryDays}일</span>
                            </td>
                            <td className="px-4 py-2.5 text-[12px] font-bold text-indigo-600 text-right">{gsBusanFrozen.totalAmount.toLocaleString()}원</td>
                            <td className="px-4 py-2.5">
                              <span className="text-[11px] text-slate-500 font-medium">GS 냉동 정산</span>
                            </td>
                            <td className="px-4 py-2.5"></td>
                          </tr>
                        )}
                      </>
                    );
                  })()}

                  {/* Section 3: 1일 출고 정산 ('GS수퍼_부산(냉동)' 제외) */}
                  {(() => {
                    const filteredDaily = integratedData.daily.filter(item => item.placeName !== 'GS수퍼_부산(냉동)');
                    if (filteredDaily.length === 0) return null;
                    
                    return (
                      <>
                        <tr className="bg-slate-50/50">
                          <td colSpan={7} className="px-4 py-2 text-[11px] font-black text-indigo-600 border-y border-slate-200 uppercase tracking-tighter flex items-center gap-2">
                             <Truck size={12} /> 3. 1일 출고 정산 요약
                          </td>
                        </tr>
                        {filteredDaily.map((item, idx) => {
                          const formattedDates = (item.deliveryDates && Array.isArray(item.deliveryDates))
                            ? item.deliveryDates.map((d: string) => {
                                const parts = d.split('-');
                                if (parts.length < 3) return d;
                                return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
                              }).join(', ')
                            : '정산 정보';

                          return (
                            <tr key={`daily-${idx}`} className="hover:bg-indigo-50/10 transition-colors">
                              <td className="px-4 py-2.5 text-[12px] font-semibold text-slate-800">{item.placeName}</td>
                              <td className="px-4 py-2.5 text-[12px] text-slate-500">{item.billingRecipient || '본사청구'}</td>
                              <td className="px-4 py-2.5 text-[12px] font-medium text-slate-500 text-right">
                                {Math.round(item.totalAmount / item.deliveryDays).toLocaleString()}원
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-600">{item.deliveryDays}일</span>
                              </td>
                              <td className="px-4 py-2.5 text-[12px] font-bold text-slate-700 text-right">{item.totalAmount.toLocaleString()}원</td>
                              <td className="px-4 py-2.5">
                                <span className="text-[11px] text-slate-400 font-medium">정산 정보</span>
                              </td>
                              <td className="px-4 py-2.5"></td>
                            </tr>
                          );
                        })}
                      </>
                    );
                  })()}

                  {/* Section 4: 긴급 출고 정산 내역 */}
                  {integratedData.emergency.length > 0 && (
                    <>
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="px-4 py-2 text-[11px] font-black text-indigo-600 border-y border-slate-200 uppercase tracking-tighter flex items-center gap-2">
                           <AlertCircle size={12} /> 4. 긴급 출고 정산 내역
                        </td>
                      </tr>
                      {integratedData.emergency.map((item, idx) => {
                        const formattedDates = (item.dates && Array.isArray(item.dates))
                          ? item.dates.map((d: string) => {
                              const parts = d.split('-');
                              if (parts.length < 3) return d;
                              return `${parseInt(parts[1], 10)}/${parseInt(parts[2], 10)}`;
                            }).join(', ')
                          : (item.memo && item.memo.includes('[') ? item.memo.split('[')[1].split(']')[0] : '-');

                        return (
                          <tr key={`emergency-${idx}`} className="hover:bg-indigo-50/10 transition-colors">
                            <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800">{item.name}</td>
                            <td className="px-4 py-2.5 text-[12px] text-slate-500"></td>
                            <td className="px-4 py-2.5 text-[12px] font-medium text-slate-500 text-right">{item.rate.toLocaleString()}원</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-50 text-[10px] font-bold text-red-600">{item.count}회</span>
                            </td>
                            <td className="px-4 py-2.5 text-[12px] font-bold text-red-600 text-right">{(item.rate * item.count).toLocaleString()}원</td>
                            <td className="px-4 py-2.5">
                              <span className="text-[11px] text-slate-700 font-medium">{formattedDates}</span>
                            </td>
                            <td className="px-4 py-2.5"></td>
                          </tr>
                        );
                      })}
                    </>
                  )}

                  {/* Section 5: 청구 조회 정산 내역 */}
                  {integratedData.inquiry.length > 0 && (
                    <>
                      <tr className="bg-slate-50/50">
                        <td colSpan={7} className="px-4 py-2 text-[11px] font-black text-indigo-600 border-y border-slate-200 uppercase tracking-tighter flex items-center gap-2">
                           <FileSpreadsheet size={12} /> 5. 청구 조회 정산 내역
                        </td>
                      </tr>
                      {integratedData.inquiry.map((item, idx) => (
                        <tr key={`inquiry-${idx}`} className="hover:bg-indigo-50/10 transition-colors">
                          <td className="px-4 py-2.5 text-[12px] font-bold text-slate-800">{item.nap}</td>
                          <td className="px-4 py-2.5 text-[12px] text-slate-500">{item.so}</td>
                          <td className="px-4 py-2.5 text-[12px] font-medium text-slate-500 text-right">
                            {item.kum.toLocaleString()}원
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-600">1회</span>
                          </td>
                          <td className="px-4 py-2.5 text-[12px] font-bold text-emerald-600 text-right">{item.kum.toLocaleString()}원</td>
                          <td className="px-4 py-2.5">
                            <span className="text-[11px] text-slate-700 font-medium">{item.date}</span>
                          </td>
                          <td className="px-4 py-2.5"></td>
                        </tr>
                      ))}
                    </>
                  )}
                </>
              )}
              {/* Total Row */}
              {!loading && totals.count > 0 && (
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td colSpan={3} className="px-4 py-4 text-[13px] text-slate-900 text-center uppercase tracking-widest font-black">최종 통합 합계</td>
                  <td className="px-4 py-4 text-center">
                     <span className="inline-flex items-center px-2 py-1 rounded bg-indigo-600 text-[12px] font-black text-white shadow-sm">
                        {totals.count}회 배송
                      </span>
                  </td>
                  <td className="px-4 py-4 text-[16px] text-emerald-600 text-right font-black">
                    ₩{totals.cost.toLocaleString()}
                  </td>
                  <td colSpan={2} className="px-4 py-4 text-[11px] text-slate-500 text-right italic">
                     * 각 정산 메뉴에서 &apos;결과 저장&apos; 버튼을 누른 데이터만 반영됩니다.
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
