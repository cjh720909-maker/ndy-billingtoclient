'use server';

import { promises as fs } from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';
import iconv from 'iconv-lite';

// 데이터 파일 경로
const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'billing.json');

// 타입 정의
export interface BillingRate {
  id: string;
  itemId: string;
  validFrom: string; // YYYY-MM-DD
  validTo: string | null; // YYYY-MM-DD or null (null이면 현재 유효)
  amount: number;
  note: string;
  createdAt: string;
}

export interface BillingItem {
  id: string;
  code: string;
  name: string;
  type: string; // '기본운임', '기타' 등
  mergeCriteria: 'code' | 'name'; // 정산 기준 다시 복원
  note: string;
  rates: BillingRate[];
  createdAt: string;
  updatedAt: string;
}

interface BillingData {
  version: string;
  items: BillingItem[];
}

// 헬퍼: 데이터 파일 읽기
async function readData(): Promise<BillingData> {
  try {
    const data = await fs.readFile(DATA_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // 파일 없으면 초기 데이터 생성 및 디렉토리 생성
      const initialData: BillingData = { version: '1.0', items: [] };
      await writeData(initialData);
      return initialData;
    }
    throw error;
  }
}

// 헬퍼: 데이터 파일 쓰기
async function writeData(data: BillingData): Promise<void> {
  const dirPath = path.dirname(DATA_FILE_PATH);
  
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (err: any) {
    if (err.code !== 'EEXIST') throw err;
  }
  
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 모든 청구 항목 조회 (현재 유효한 단가 포함)
 */
export async function getBillingItems() {
  const data = await readData();
  return { success: true, data: data.items };
}

/**
 * 신규 청구 항목 추가
 */
export async function addBillingItem(params: {
  code: string;
  name: string;
  amount: number;
  validFrom: string;
  note: string;
  mergeCriteria: 'code' | 'name';
}) {
  const data = await readData();
  
  // 필수값 검증 제거: 사용자가 "아무거나 하나만 입력하면 된다"고 했으므로 
  // 최소한의 데이터(식별 가능한 정보)가 하나라도 있는지 체크할 수도 있지만,
  // "필수 이런 건 없어"라는 말에 따라 강제 리턴하지 않음.
  // 다만 중복 체크를 위해 값이 있는 경우에만 검사.

  // 중복 체크: (값이 있는 경우에만)
  if (params.code) {
    const existingIndex = data.items.findIndex(item => item.code === params.code && item.code !== '');
    if (existingIndex !== -1) {
       // 경고는 주되, 저장을 막아야 할까? 중복이면 곤란하므로 막는 게 맞음.
       return { success: false, error: '이미 존재하는 납품처 코드입니다.' };
    }
  }
  if (params.name) {
    const existingIndex = data.items.findIndex(item => item.name === params.name && item.name !== '');
    if (existingIndex !== -1) {
       return { success: false, error: '이미 존재하는 납품처명입니다.' };
    }
  }

  const newItemId = crypto.randomUUID();
  const now = new Date().toISOString();

  const newRate: BillingRate = {
    id: crypto.randomUUID(),
    itemId: newItemId,
    validFrom: params.validFrom || now.split('T')[0], // 시작일 없으면 오늘
    validTo: null,
    amount: params.amount || 0,
    note: '최초 등록',
    createdAt: now,
  };

  const newItem: BillingItem = {
    id: newItemId,
    code: params.code || '',
    name: params.name || '',
    type: '기본운임',
    mergeCriteria: params.mergeCriteria || 'name', // 기본값 name
    note: params.note || '',
    rates: [newRate],
    createdAt: now,
    updatedAt: now,
  };

  data.items.push(newItem);
  await writeData(data);

  return { success: true, data: newItem };
}

/**
 * 단가 변경 (이력 추가)
 */
export async function updateBillingRate(params: {
  itemId: string;
  newAmount: number;
  validFrom: string; // 변경 시작일 (YYYY-MM-DD)
  note: string;
}) {
  const data = await readData();
  const itemIndex = data.items.findIndex(item => item.id === params.itemId);
  
  if (itemIndex === -1) {
    return { success: false, error: '청구 항목을 찾을 수 없습니다.' };
  }

  const item = data.items[itemIndex];
  
  // 현재 유효한(validTo가 null인) 마지막 이력을 찾아서 종료일 업데이트
  // [중요] 변경 시작일의 *하루 전날*을 종료일로 설정
  // 예: 2026-01-01부터 변경 -> 기존 이력은 2025-12-31까지 유효
  const currentRateIndex = item.rates.findIndex(r => r.validTo === null);
  
  if (currentRateIndex !== -1) {
    const validFromDate = new Date(params.validFrom);
    const validToDate = new Date(validFromDate);
    validToDate.setDate(validToDate.getDate() - 1); // 하루 전
    
    // YYYY-MM-DD 포맷
    const validToStr = validToDate.toISOString().split('T')[0];
    
    // 기존 이력 종료
    item.rates[currentRateIndex].validTo = validToStr;
  }

  // 새 이력 추가
  const newRate: BillingRate = {
    id: crypto.randomUUID(),
    itemId: item.id,
    validFrom: params.validFrom,
    validTo: null,
    amount: params.newAmount,
    note: params.note,
    createdAt: new Date().toISOString(),
  };

  item.rates.push(newRate);
  item.updatedAt = new Date().toISOString();
  
  // 데이터 업데이트
  data.items[itemIndex] = item;
  await writeData(data);

  return { success: true, data: item };
}

/**
 * 청구 항목 정보 수정 (기본 정보만)
 */
export async function updateBillingItemInfo(params: {
  id: string;
  code?: string;
  name?: string;
  note?: string;
}) {
  const data = await readData();
  const itemIndex = data.items.findIndex(item => item.id === params.id);
  
  if (itemIndex === -1) {
    return { success: false, error: '항목을 찾을 수 없습니다.' };
  }

  const item = data.items[itemIndex];
  if (params.code !== undefined) item.code = params.code; // 빈 문자열도 허용하므로 undefined 체크
  if (params.name !== undefined) item.name = params.name;
  if (params.note !== undefined) item.note = params.note;
  item.updatedAt = new Date().toISOString();

  data.items[itemIndex] = item;
  await writeData(data);

  return { success: true, data: item };
}

/**
 * 청구 항목 삭제
 */
export async function deleteBillingItem(id: string) {
  const data = await readData();
  const initialLength = data.items.length;
  
  // 해당 ID를 가진 항목 제외
  const newItems = data.items.filter(item => item.id !== id);

  if (newItems.length === initialLength) {
    return { success: false, error: '삭제할 항목이 없습니다.' };
  }
  
  data.items = newItems;
  await writeData(data);
  return { success: true };
}

/**
 * 청구 항목 직접 수정 (이력 관리 없이 데이터 자체를 수정)
 */
export async function updateBillingItemDirectly(params: {
  id: string;
  code: string;
  name: string;
  amount: number;
  validFrom: string;
  note: string;
}) {
  const data = await readData();
  const itemIndex = data.items.findIndex(item => item.id === params.id);
  
  if (itemIndex === -1) {
    return { success: false, error: '항목을 찾을 수 없습니다.' };
  }

  const item = data.items[itemIndex];
  
  // 이름 수정 시 중복 체크 (본인 제외)
  if (params.name !== item.name) {
      const existingIndex = data.items.findIndex(i => i.name === params.name && i.id !== params.id);
      if (existingIndex !== -1) {
          return { success: false, error: '이미 존재하는 납품처명입니다.' };
      }
  }

  // 1. 기본 정보 수정
  item.code = params.code || '';
  item.name = params.name; // 필수
  item.note = params.note || '';
  
  // 2. 현재 유효한(혹은 마지막) 단가 정보 수정
  // [주의] 이력을 새로 쌓는게 아니라, 기존 값을 덮어씀
  const currentRateIndex = item.rates.findIndex(r => r.validTo === null) !== -1
    ? item.rates.findIndex(r => r.validTo === null)
    : item.rates.length - 1;

  if (currentRateIndex !== -1) {
    item.rates[currentRateIndex].amount = params.amount || 0;
    if (params.validFrom) {
       item.rates[currentRateIndex].validFrom = params.validFrom;
    }
    // note, validTo 등은 건드리지 않음 (필요 시 수정 가능)
  }

  item.updatedAt = new Date().toISOString();
  
  data.items[itemIndex] = item;
  await writeData(data);

  return { success: true, data: item };
}

/**
 * 청구 조회 (t_il_car 테이블)
 */
export async function getInquiryBilling(params: {
  startDate: string;
  endDate: string;
  searchTerm?: string;
}) {
  const { startDate, endDate, searchTerm } = params;

  try {
    const connection = await mysql.createConnection(process.env.MYSQL_URL as string);
    await connection.query("SET NAMES 'latin1'");

    const [rows]: any[] = await connection.execute(
      'SELECT IC_DATE, IC_NAME, IC_SO, IC_NAP, IC_TON, IC_KUM, IC_YO, IC_CHUNG, IC_UN, IC_MEMO FROM t_il_car WHERE IC_DATE >= ? AND IC_DATE <= ? ORDER BY IC_DATE ASC, IC_NAME ASC',
      [startDate, endDate]
    );

    await connection.end();

    const decode = (val: any) => {
      if (!val) return '';
      return iconv.decode(Buffer.from(val, 'binary'), 'euckr').trim();
    };

    const result = rows.map((row: any, index: number) => ({
      no: index + 1,
      date: row.IC_DATE,
      name: decode(row.IC_NAME),
      so: decode(row.IC_SO),
      nap: decode(row.IC_NAP),
      ton: decode(row.IC_TON),
      kum: Number(row.IC_KUM || 0),
      yo: decode(row.IC_YO),
      chung: decode(row.IC_CHUNG),
      un: Number(row.IC_UN || 0),
      memo: decode(row.IC_MEMO),
    })).filter((row: any) => {
      // '회수' 또는 '회송' 키워드 포함 여부 확인
      const hasKeyword = (text: string) => text.includes('회수') || text.includes('회송');
      const isSpecialCase = hasKeyword(row.name) || hasKeyword(row.so) || hasKeyword(row.nap) || hasKeyword(row.memo);

      // 0원 데이터 기본 제외하되, '회수'/'회송' 키워드가 포함된 경우는 표시
      if (row.kum === 0 && !isSpecialCase) return false;
      
      if (!searchTerm) return true;
      const searchTerms = searchTerm.split(',').map(t => t.trim()).filter(t => t.length > 0);
      return searchTerms.some(term => 
        row.name.includes(term) || 
        row.so.includes(term) || 
        row.nap.includes(term) ||
        row.chung.includes(term)
      );
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to fetch inquiry billing:', error);
    return { success: false, error: '데이터를 가져오는 중 오류가 발생했습니다.' };
  }
}

/**
 * 긴급 출고 조회 (t_balju 테이블)
 * 납품처명에 '긴급' 또는 '*'가 포함된 데이터를 조회하여 중복 제거 후 반환
 */
export async function getEmergencyShipments(params: {
  startDate: string;
  endDate: string;
}) {
  const { startDate, endDate } = params;

  try {
    const connection = await mysql.createConnection(process.env.MYSQL_URL as string);
    await connection.query("SET NAMES 'latin1'");

    // 인코딩 문제 회피를 위해 기간 내 전체 데이터를 가져와서 메모리에서 필터링
    const [rows]: any[] = await connection.execute(
      `SELECT B_C_CODE, B_C_NAME, B_MEMO, B_DATE 
       FROM t_balju 
       WHERE B_DATE >= ? AND B_DATE <= ? 
       ORDER BY B_DATE DESC`,
      [startDate, endDate]
    );

    await connection.end();

    const decode = (val: any) => {
      if (!val) return '';
      return iconv.decode(Buffer.from(val, 'binary'), 'euckr').trim();
    };

    // 중복 제거를 위한 그룹화 (납품처명 기준)
    const groupedData: Record<string, any> = {};

    rows.forEach((row: any) => {
      const name = decode(row.B_C_NAME);
      const memo = decode(row.B_MEMO);
      
      // '긴급' 또는 '*' 또는 '★' 포함 여부 체크
      if (name.includes('긴급') || name.includes('*') || name.includes('★')) {
        // [중요] 납품처명으로만 중복 체크 (사용자 요청: 코드는 무시)
        if (!groupedData[name]) {
          groupedData[name] = {
            code: String(row.B_C_CODE || '').trim(),
            name: name,
            memo: memo,
            latestDate: row.B_DATE instanceof Date 
              ? row.B_DATE.toISOString().split('T')[0] 
              : (typeof row.B_DATE === 'string' ? row.B_DATE.substring(0, 10) : ''),
          };
        }
      }
    });

    const result = Object.values(groupedData).map((item: any, index: number) => ({
      no: index + 1,
      ...item
    }));

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to fetch emergency shipments:', error);
    return { success: false, error: '데이터를 가져오는 중 오류가 발생했습니다.' };
  }
}

/**
 * 통합 청구 요약 데이터 생성
 * t_balju 내역과 billing.json의 단가 정보를 결합하여 업체별 청합액 계산
 */
export async function getMonthlyBillingSummary(params: {
  startDate: string;
  endDate: string;
}) {
  const { startDate, endDate } = params;

  try {
    const connection = await mysql.createConnection(process.env.MYSQL_URL as string);
    await connection.query("SET NAMES 'latin1'");

    // 1. 기간 내 모든 배차 데이터 조회
    const [rows]: any[] = await connection.execute(
      `SELECT B_DATE, B_C_CODE, B_C_NAME, B_QTY, B_KG, B_MEMO 
       FROM t_balju 
       WHERE B_DATE >= ? AND B_DATE <= ? 
       ORDER BY B_DATE ASC`,
      [startDate, endDate]
    );

    await connection.end();

    // 2. 청구 단가 데이터 로드
    let billingData: any = { items: [] };
    try {
      const filePath = path.join(process.cwd(), 'data', 'billing.json');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      billingData = JSON.parse(fileContent);
    } catch (err) {
      console.warn('Billing data not found:', err);
    }

    const decode = (val: any) => {
      if (!val) return '';
      return iconv.decode(Buffer.from(val, 'binary'), 'euckr').trim();
    };

    // 3. 데이터 집계 (업체별)
    const summary: Record<string, any> = {};

    rows.forEach((row: any) => {
      const date = row.B_DATE instanceof Date 
        ? row.B_DATE.toISOString().split('T')[0] 
        : (typeof row.B_DATE === 'string' ? row.B_DATE.substring(0, 10) : '');
      const code = String(row.B_C_CODE || '').trim();
      const name = decode(row.B_C_NAME);
      
      // billing.json에서 해당 업체 설정 찾기
      const billingItem = billingData.items.find((item: any) => {
        if (item.mergeCriteria === 'code') return item.code === code;
        return item.name === name;
      });

      if (!billingItem) return;

      const groupKey = billingItem.mergeCriteria === 'code' ? code : name;
      const uniqueDayKey = `${date}_${groupKey}`;

      if (!summary[groupKey]) {
        summary[groupKey] = {
          name: billingItem.name,
          delivery: name, // 배송지명 (참고용)
          cost: 0,
          count: 0,
          days: new Set(),
          remarks: billingItem.note || '',
          isGS: billingItem.mergeCriteria === 'code' && billingItem.name.includes('GS')
        };
      }

      summary[groupKey].days.add(uniqueDayKey);
    });

    // 4. 금액 계산
    const result = Object.values(summary).map((item: any) => {
      const billingItem = billingData.items.find((bi: any) => {
        if (bi.mergeCriteria === 'code' && bi.name === item.name) return true;
        return bi.name === item.name;
      });

      const count = item.days.size;
      const rate = billingItem?.rates?.[0]?.amount || 0;
      let cost = count * rate;

      // [특수 로직] GS 정산 가산금 (12+3 등)
      // 단순화를 위해 billing.json의 단가를 합산 금액으로 사용하고
      // 비고란에 상세 내역 표시
      if (item.isGS) {
        const bonus = 30000; // GS 고정 가산금 (예시)
        cost = count * (rate + bonus);
        item.remarks = `${(rate/10000).toLocaleString()}+${(bonus/10000).toLocaleString()} (가산금 포함)`;
      } else {
        item.remarks = `${(rate/10000).toLocaleString()}만 * ${count}회`;
      }

      return {
        delivery: item.delivery,
        client: item.name,
        cost: cost.toLocaleString(),
        date: `${startDate} ~ ${endDate}`,
        count: String(count),
        remarks: item.remarks
      };
    });

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to get monthly billing summary:', error);
    return { success: false, error: '데이터를 가져오는 중 오류가 발생했습니다.' };
  }
}
