'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  RotateCcw,
  ArrowRight,
  Settings,
  Save,
  X,
  Copy,
  Check
} from 'lucide-react';
import { getDailySettlements, getGSPickingConfig, updateGSPickingConfig } from '@/actions/settlements';
import { MonthSelector } from '@/components/MonthSelector';
import { toPng } from 'html-to-image';

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

export default function GSPickingSettlementPage() {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return getKSTToday(); // defaults to current KST date
  });

  // GS Picking calculates based on the 1st to the last day of the selected month
  const getBillingPeriod = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0); // Last day of the month
    return { startDate: formatDate(start), endDate: formatDate(end) };
  };

  const { startDate, endDate } = React.useMemo(() => getBillingPeriod(selectedMonth), [selectedMonth]);

  const [searchTerm, setSearchTerm] = useState('');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [totals, setTotals] = useState({ qty: 0 });

  // Configuration State
  const [config, setConfig] = useState({ boxesPerPallet: 78, ratePerPallet: 8000 });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState({ boxesPerPallet: 78, ratePerPallet: 8000 });
  const [savingConfig, setSavingConfig] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const tableRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load config
    const loadConfig = async () => {
      const res = await getGSPickingConfig();
      if (res.success) {
        setConfig(res.data);
        setTempConfig(res.data);
      }
    };
    loadConfig();
  }, []);
  // 초기 데이터 조회
  useEffect(() => {
    fetchData(startDate, endDate, searchTerm);
  }, [startDate, endDate]); // Re-fetch when the month selector changes the derived dates

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

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    const res = await updateGSPickingConfig(tempConfig);
    if (res.success) {
      setConfig(tempConfig);
      setIsSettingsModalOpen(false);
    } else {
      alert('설정 저장 실패');
    }
    setSavingConfig(false);
  };

  const copyAsImage = async () => {
    if (!tableRef.current || data.length === 0) return;
    
    setCopying(true);
    try {
      // html-to-image works best when the element is visible and has a background
      const dataUrl = await toPng(tableRef.current, {
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          borderRadius: '0',
        },
        filter: (node: any) => {
          if (node.dataset?.ignoreCapture === 'true') return false;
          return true;
        }
      });
      
      const blob = await (await fetch(dataUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Copy as image failed:', err);
      alert('이미지 복사 중 오류가 발생했습니다.');
    } finally {
      setCopying(false);
    }
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
          const pallets = Math.ceil(qty / config.boxesPerPallet);
          dailyPallets += pallets;
        }
      });
      dailyAmount = dailyPallets * config.ratePerPallet;
      settlementInfo[date] = { amount: dailyAmount, pallets: dailyPallets, qty: dailyQty };
    });

    return { dates, places, grid, dateTotals, placeTotals, settlementInfo };
  }, [data, config]);

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
          <div className="flex items-center gap-3">
            <MonthSelector currentDate={selectedMonth} onChange={setSelectedMonth} />
            <span className="text-[11px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
              {startDate} ~ {endDate}
            </span>
          </div>
          <div className="flex gap-1.5">
            <button 
              onClick={() => {
                setTempConfig(config);
                setIsSettingsModalOpen(true);
              }}
              className="px-3 py-1.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[12px] font-bold hover:bg-slate-200 flex items-center gap-1.5"
            >
              <Settings size={13} /> 설정
            </button>
            <button onClick={handleSearch} disabled={loading} className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-[12px] font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
              {loading ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={13} />} 조회
            </button>
            <button 
              onClick={() => {
                setSelectedMonth(getKSTToday());
                setSearchTerm('');
              }} 
              className="p-1.5 bg-slate-100 border border-slate-200 text-slate-500 rounded-md hover:bg-slate-200"
              title="초기화"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px] flex flex-col" ref={tableRef}>
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
                  <span className="text-[10px] text-slate-400 ml-2 font-normal">(기준: 파렛트당 {config.boxesPerPallet}박스 / {config.ratePerPallet.toLocaleString()}원)</span>
                </span>
              )}
            </h3>
          </div>
          {data.length > 0 && (
            <button
              onClick={copyAsImage}
              disabled={copying}
              data-ignore-capture="true"
              className={`
                flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold transition-all shadow-sm
                ${copySuccess 
                  ? 'bg-emerald-500 text-white shadow-emerald-100' 
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 shadow-slate-100'}
              `}
            >
              {copying ? (
                <div className="w-3 h-3 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
              ) : copySuccess ? (
                <><Check size={13} /> 복사완료</>
              ) : (
                <><Copy size={13} /> 화면 복사(이미지)</>
              )}
            </button>
          )}
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
                      const pl = qty > 0 ? Math.ceil(qty / config.boxesPerPallet) : 0;
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
                    // 총계의 파렛트 합산은 각 날짜별 파렛트의 합이어야 함 (단순 총박스/boxesPerPallet 아님)
                    const totalPL = matrixData.dates.reduce((acc, date) => {
                      const dayQty = matrixData.grid[date]?.[place.code] || 0;
                      return acc + (dayQty > 0 ? Math.ceil(dayQty / config.boxesPerPallet) : 0);
                    }, 0);
                    return (
                      <React.Fragment key={`total-${place.code}`}>
                        <td className="px-2 py-2 text-[11px] text-right border-r border-slate-200">{totalQty.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="px-2 py-2 text-[11px] text-center border-r border-slate-300 bg-indigo-100/50 text-indigo-700">{totalPL.toLocaleString()} PL</td>
                      </React.Fragment>
                    );
                  })}
                  <td className="sticky right-[180px] z-30 bg-indigo-100 px-2 py-2 text-[11px] text-right border-l border-indigo-200">{Object.values(matrixData.settlementInfo).reduce((a, b) => a + (b as any).qty, 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                  <td className="sticky right-[100px] z-30 bg-emerald-100 px-2 py-2 text-[11px] text-center border-l border-emerald-200">{Object.values(matrixData.settlementInfo).reduce((acc, cur) => acc + (cur as any).pallets, 0).toLocaleString()} PL</td>
                  <td className="sticky right-0 z-30 bg-amber-100 px-2 py-2 text-[11px] text-right border-l border-amber-200">{Object.values(matrixData.settlementInfo).reduce((acc, cur) => acc + (cur as any).amount, 0).toLocaleString()}</td>
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

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="text-indigo-600" size={18} />
                <h3 className="font-bold text-slate-800">피킹 비용 정산 기준 설정</h3>
              </div>
              <button 
                onClick={() => setIsSettingsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                disabled={savingConfig}
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-1.5 text-center">
                   <div className="text-[14px] font-bold text-slate-700">파렛트당 박스 수 기준</div>
                   <div className="text-[11px] text-slate-400 leading-relaxed">
                     한 파렛트를 구성하는 기본 박스 수량을 입력하세요.<br/>
                     예: 78박스 초과 시 2파렛트로 계산됩니다.
                   </div>
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    value={tempConfig.boxesPerPallet}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, boxesPerPallet: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-[18px] font-bold text-indigo-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">박스</span>
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              <div className="space-y-4">
                <div className="space-y-1.5 text-center">
                   <div className="text-[14px] font-bold text-slate-700">파렛트당 단가 설정</div>
                   <div className="text-[11px] text-slate-400 leading-relaxed">
                     계산된 파렛트(PL)당 적용할 단가를 입력하세요.
                   </div>
                </div>
                <div className="relative">
                  <input 
                    type="number" 
                    value={tempConfig.ratePerPallet}
                    onChange={(e) => setTempConfig(prev => ({ ...prev, ratePerPallet: Number(e.target.value) }))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-center text-[18px] font-bold text-emerald-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">원</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-[14px] font-bold hover:bg-slate-200 transition-all"
                  disabled={savingConfig}
                >
                  취소
                </button>
                <button 
                  onClick={handleSaveConfig}
                  className="flex-2 px-8 py-3 bg-indigo-600 text-white rounded-xl text-[14px] font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                  disabled={savingConfig}
                >
                  {savingConfig ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  설정 저장 및 적용
                </button>
              </div>
              <p className="text-[10px] text-center text-slate-400 italic">
                * 저장 시 현재 조회된 데이터와 표에 즉시 반영됩니다.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
