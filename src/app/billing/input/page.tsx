'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search,
  Plus,
  History,
  Trash2,
  AlertCircle,
  Calendar,
  CheckCircle2
} from 'lucide-react';
import { 
  getBillingItems, 
  addBillingItem, 
  updateBillingRate, 
  deleteBillingItem,
  updateBillingItemDirectly,
  BillingItem
} from '@/actions/billing';

export default function BillingInputPage() {
  const [items, setItems] = useState<BillingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 선택된 항목 (우측 패널용)
  const [selectedItem, setSelectedItem] = useState<BillingItem | null>(null);
  
  // 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false); // 수정 모달 추가

  // 폼 상태
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    amount: 0,
    validFrom: '',
    note: '',
    mergeCriteria: 'name' as 'code' | 'name' // 정산 기준 다시 복원 (기본값: 명칭)
  });

  // 데이터 로드 함수 정의 (useCallback)
  const loadData = React.useCallback(async () => {
    setLoading(true);
    const result = await getBillingItems();
    if (result.success && result.data) {
      setItems(result.data);
    }
    setLoading(false);
  }, []);

  // 초기 데이터 로드
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 검색 필터링
  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 현재 적용 중인 단가 찾기
  const getCurrentRate = (item: BillingItem) => {
    return item.rates.find(r => r.validTo === null) || item.rates[item.rates.length - 1];
  };

  // 신규 등록
  const handleAddItem = async () => {
    // [중요] 필수값 검증 제거 "아무거나 하나만 입력하면 된다"
    // 다만 최소한의 데이터도 없이 등록 버튼을 누르는 건 방지? 
    // 아니, 사용자가 "필수 이런 건 없어" 라고 했으니 그냥 보냄.
    // 서버 액션에서 중복 체크 등은 수행함.

    const result = await addBillingItem({
      code: formData.code,
      name: formData.name,
      amount: Number(formData.amount),
      validFrom: formData.validFrom,
      note: formData.note,
      mergeCriteria: formData.mergeCriteria
    });

    if (result.success) {
      alert('등록되었습니다.');
      setShowAddModal(false);
      setFormData({ code: '', name: '', amount: 0, validFrom: '', note: '', mergeCriteria: 'name' });
      loadData();
    } else {
      alert('등록 실패: ' + result.error);
    }
  };

  // 단가 변경 (이력 추가)
  const handleUpdateRate = async () => {
    if (!selectedItem || !formData.validFrom) return;

    const result = await updateBillingRate({
      itemId: selectedItem.id,
      newAmount: Number(formData.amount),
      validFrom: formData.validFrom,
      note: formData.note
    });

    if (result.success) {
      alert('단가가 변경되었습니다.');
      setShowRateModal(false);
      setFormData({ code: '', name: '', amount: 0, validFrom: '', note: '', mergeCriteria: 'name' });
      loadData();
      const updatedItem = result.data;
      if (updatedItem) setSelectedItem(updatedItem); 
    } else {
      alert('변경 실패: ' + result.error);
    }
  };

  // 항목 직접 수정 (이력 없이)
  const handleUpdateItemDirectly = async () => {
    if (!selectedItem) return;

    const result = await updateBillingItemDirectly({
      id: selectedItem.id,
      code: formData.code,
      name: formData.name,
      amount: Number(formData.amount),
      validFrom: formData.validFrom,
      note: formData.note,
      mergeCriteria: formData.mergeCriteria
    });

    if (result.success) {
      alert('수정되었습니다.');
      setShowEditModal(false);
      loadData();
      loadData();
      const updatedItem = result.data as BillingItem;
      if (updatedItem) setSelectedItem(updatedItem);
    } else {
      alert('수정 실패: ' + result.error);
    }
  };

  // 항목 삭제
  const handleDeleteItem = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까? 이력 데이터도 모두 삭제됩니다.')) return;
    
    const result = await deleteBillingItem(id);
    if (result.success) {
      setSelectedItem(null);
      loadData();
    } else {
      alert('삭제 실패: ' + result.error);
    }
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto h-[calc(100vh-100px)] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="text-indigo-600" />
            청구 비용 관리
          </h1>
          <p className="text-xs text-slate-500 mt-1">납품처별 정산 단가 및 변동 이력을 관리합니다.</p>
        </div>
        <button 
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            setFormData({ code: '', name: '', amount: 0, validFrom: today, note: '', mergeCriteria: 'name' });
            setShowAddModal(true);
          }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
        >
          <Plus size={16} /> 신규 등록
        </button>
      </div>

      <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
        {/* Left Panel: List */}
        <div className="col-span-4 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <input 
                type="text" 
                placeholder="납품처명 또는 코드 검색..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="text-center py-10 text-slate-400 text-sm">로딩 중...</div>
            ) : filteredItems.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm">등록된 항목이 없습니다.</div>
            ) : (
              filteredItems.map(item => {
                const currentRate = getCurrentRate(item);
                const isSelected = selectedItem?.id === item.id;
                
                return (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`
                      p-3 rounded-lg cursor-pointer transition-all border
                      ${isSelected 
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                        : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-slate-800 text-sm">{item.name || '(이름 없음)'}</span>
                      <div className="flex gap-1">
                        {/* 정산 기준 배지 복원 */}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.mergeCriteria === 'code' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                          코드
                        </span>
                         <span className={`text-[10px] px-1.5 py-0.5 rounded border ${item.mergeCriteria === 'name' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                          명칭
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{item.code || '-'}</span>
                         <span className="text-xs text-slate-500 truncate max-w-[80px]">{item.note || '-'}</span>
                      </div>
                      <span className={`text-sm font-bold ${isSelected ? 'text-indigo-600' : 'text-slate-700'}`}>
                        {currentRate?.amount.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Details & History */}
        <div className="col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          {selectedItem ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Detail Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-2xl font-bold text-slate-900">{selectedItem.name || '(이름 없음)'}</h2>
                     {/* 정산 기준 배지 상세 뷰 복원 */}
                     <span className={`px-2 py-1 text-xs font-bold rounded-md flex items-center gap-1 ${
                        selectedItem.mergeCriteria === 'code' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {selectedItem.mergeCriteria === 'code' ? '코드 기준 정산' : '명칭 기준 정산'}
                        <CheckCircle2 size={12} />
                      </span>
                  </div>
                   <div className="flex items-center gap-2 text-sm text-slate-500">
                      <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-xs">{selectedItem.code || '코드 없음'}</span>
                      <span>|</span>
                      <span>{selectedItem.note || '비고 없음'}</span>
                   </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      const currentRate = getCurrentRate(selectedItem);
                      setFormData({
                        code: selectedItem.code,
                        name: selectedItem.name,
                        amount: currentRate?.amount || 0,
                        validFrom: currentRate?.validFrom || '',
                        note: selectedItem.note,
                        mergeCriteria: selectedItem.mergeCriteria || 'name'
                      });
                      setShowEditModal(true);
                    }}
                    className="px-3 py-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2"
                  >
                    수정 (Edit)
                  </button>
                  <button 
                    onClick={() => handleDeleteItem(selectedItem.id)}
                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="삭제"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Current Status Card */}
              <div className="p-6 grid grid-cols-2 gap-6">
                <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block mb-1">현재 적용 단가</span>
                  <div className="text-3xl font-black text-indigo-900">
                    {getCurrentRate(selectedItem)?.amount.toLocaleString()}
                    <span className="text-lg font-bold text-indigo-400 ml-1">원</span>
                  </div>
                  <div className="mt-2 text-xs text-indigo-600 flex items-center gap-1">
                    <Calendar size={12} />
                    <span>적용 시작일: {getCurrentRate(selectedItem)?.validFrom}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-center border-2 border-dashed border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer group"
                     onClick={() => {
                        const today = new Date().toISOString().split('T')[0];
                        setFormData({ 
                          code: selectedItem.code, 
                          name: selectedItem.name, 
                          amount: getCurrentRate(selectedItem)?.amount || 0,
                          validFrom: today,
                          note: '',
                          mergeCriteria: selectedItem.mergeCriteria || 'name'
                        });
                        setShowRateModal(true);
                     }}
                >
                  <div className="text-center">
                    <History className="mx-auto text-slate-300 group-hover:text-indigo-400 mb-2" size={24} />
                    <span className="text-sm font-bold text-slate-500 group-hover:text-indigo-600">단가 변경 (이력 추가)</span>
                  </div>
                </div>
              </div>

              {/* History Table */}
              <div className="flex-1 overflow-auto px-6 pb-6">
                <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <History size={16} /> 
                  단가 변동 이력
                </h3>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 font-bold text-slate-500">적용 기간</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-right">단가</th>
                        <th className="px-4 py-3 font-bold text-slate-500">비고/사유</th>
                        <th className="px-4 py-3 font-bold text-slate-500 text-right">등록일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {[...selectedItem.rates].reverse().map((rate) => (
                        <tr key={rate.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-700">{rate.validFrom}</span>
                            <span className="text-slate-400 mx-2">~</span>
                            <span className={`${!rate.validTo ? 'text-emerald-600 font-bold' : 'text-slate-500'}`}>
                              {rate.validTo || '현재'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {rate.amount.toLocaleString()}원
                          </td>
                          <td className="px-4 py-3 text-slate-600">{rate.note}</td>
                          <td className="px-4 py-3 text-right text-slate-400 text-xs">
                            {new Date(rate.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Building2 size={48} className="mb-4 opacity-20" />
              <p>좌측 목록에서 항목을 선택하세요.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">신규 청구 항목 등록</h3>
            <div className="space-y-4">
              {/* 정산 기준 선택 복원 */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 mb-2">정산 매칭 기준 (필수)</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="mergeCriteria" 
                      value="name" 
                      checked={formData.mergeCriteria === 'name'} 
                      onChange={() => setFormData({...formData, mergeCriteria: 'name'})}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm text-slate-700">납품처명 (보통)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="mergeCriteria" 
                      value="code" 
                      checked={formData.mergeCriteria === 'code'} 
                      onChange={() => setFormData({...formData, mergeCriteria: 'code'})}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm text-slate-700">납품처 코드 (정밀)</span>
                  </label>
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  * 정산 시 어떤 값을 기준으로 매칭할지 선택합니다. (코드가 없는 경우 명칭 사용)
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">납품처 코드 (선택)</label>
                <input 
                  type="text" 
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="예: 1001"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">납품처명 (이름 없을 수 있음)</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="예: 화림유통"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">적용 단가 (원)</label>
                <input 
                  type="number" 
                  step={1000} // 1000원 단위
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">적용 시작일</label>
                <input 
                  type="date" 
                  value={formData.validFrom}
                  onChange={e => setFormData({...formData, validFrom: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">비고</label>
                <input 
                  type="text" 
                  value={formData.note}
                  onChange={e => setFormData({...formData, note: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="메모 사항"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                >
                  취소
                </button>
                <button 
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
                >
                  등록
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rate Change Modal */}
      {showRateModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">단가 변경 (이력 추가)</h3>
            <div className="p-3 bg-indigo-50 rounded-lg mb-4 text-sm text-indigo-700">
              <p className="font-bold">{selectedItem.name} ({selectedItem.code})</p>
              <p className="mt-1 text-xs">기존 단가는 변경일 하루 전날까지 유효 처리됩니다.</p>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">변경할 단가 (원)</label>
                <input 
                  type="number" 
                  step={1000} // 1000원 단위
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right font-bold text-indigo-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">변경 적용 시작일</label>
                <input 
                  type="date" 
                  value={formData.validFrom}
                  onChange={e => setFormData({...formData, validFrom: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">변경 사유 / 비고</label>
                <input 
                  type="text" 
                  value={formData.note}
                  onChange={e => setFormData({...formData, note: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  placeholder="예: 2026년 단가 인상"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button 
                  onClick={() => setShowRateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                >
                  취소
                </button>
                <button 
                  onClick={handleUpdateRate}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
                >
                  변경 저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Direct Edit Modal (New) */}
      {showEditModal && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">청구 항목 수정</h3>
            <div className="p-3 bg-amber-50 rounded-lg mb-4 text-xs text-amber-700 font-medium">
              <AlertCircle size={14} className="inline mr-1 mb-0.5" />
              이 수정은 이력을 남기지 않고 <strong>현재 데이터를 직접 변경</strong>합니다.
            </div>
            <div className="space-y-4">
              
              {/* 정산 기준 선택 복원 (수정 모드) */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-500 mb-2">정산 매칭 기준</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="editMergeCriteria" 
                      value="name" 
                      checked={formData.mergeCriteria === 'name'} 
                      onChange={() => setFormData({...formData, mergeCriteria: 'name'})}
                      className="w-4 h-4 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-700">납품처명</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="editMergeCriteria" 
                      value="code" 
                      checked={formData.mergeCriteria === 'code'} 
                      onChange={() => setFormData({...formData, mergeCriteria: 'code'})}
                      className="w-4 h-4 text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm text-slate-700">납품처 코드</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">납품처 코드</label>
                  <input 
                    type="text" 
                    value={formData.code}
                    onChange={e => setFormData({...formData, code: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">납품처명</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">현재 적용 단가 (원)</label>
                <input 
                  type="number" 
                  step={1000}
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-right font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">적용 시작일</label>
                <input 
                  type="date" 
                  value={formData.validFrom}
                  onChange={e => setFormData({...formData, validFrom: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">비고</label>
                <input 
                  type="text" 
                  value={formData.note}
                  onChange={e => setFormData({...formData, note: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button 
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium"
                >
                  취소
                </button>
                <button 
                  onClick={handleUpdateItemDirectly}
                  className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold hover:bg-amber-600 shadow-sm"
                >
                  수정 완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
