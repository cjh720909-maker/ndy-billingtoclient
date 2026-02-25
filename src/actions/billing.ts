'use server';

import dbPool from '@/lib/mysql';
import iconv from 'iconv-lite';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';

// 날짜 정규화 유틸리티 (비교용)
const normalizeDateStr = (date: any) => {
  return String(date || '').trim().replace(/[^0-9]/g, ''); // 숫자만 추출 (2026-02-01 -> 20260201)
};

// 데이터 파일 경로 제거 (DB 사용)
// const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'billing.json');

// 타입 정의 (Prisma 모델과 호환되도록 유지)
export interface BillingRate {
  id: string;
  itemId: string;
  validFrom: string; // YYYY-MM-DD
  validTo: string | null; // YYYY-MM-DD or null
  amount: number;
  note: string;
  createdAt: string;
}

export interface BillingItem {
  id: string;
  code: string;
  name: string;
  billingRecipient: string;
  type: string;
  mergeCriteria: 'code' | 'name';
  note: string;
  rates: BillingRate[];
  createdAt: string;
  updatedAt: string;
}

// 헬퍼 제거

/**
 * 모든 청구 항목 조회 (현재 유효한 단가 포함)
 */
export async function getBillingItems() {
  const items = await prisma.billingItem.findMany({
    include: {
      rates: {
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  // 타입을 UI와 맞추기 위해 변환
  const formattedItems: BillingItem[] = items.map(item => ({
    ...item,
    mergeCriteria: item.mergeCriteria as 'code' | 'name',
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    rates: item.rates.map(rate => ({
      ...rate,
      createdAt: rate.createdAt.toISOString()
    }))
  }));

  return { success: true, data: formattedItems };
}

/**
 * 신규 청구 항목 추가
 */
export async function addBillingItem(params: {
  code: string;
  name: string;
  billingRecipient: string;
  amount: number;
  validFrom: string;
  note: string;
  mergeCriteria: 'code' | 'name';
}) {
  // 중복 체크
  if (params.code) {
    const existing = await prisma.billingItem.findFirst({
      where: { code: params.code, NOT: { code: '' } }
    });
    if (existing) return { success: false, error: '이미 존재하는 납품처 코드입니다.' };
  }
  if (params.name) {
    const existing = await prisma.billingItem.findFirst({
      where: { name: params.name }
    });
    if (existing) return { success: false, error: '이미 존재하는 납품처명입니다.' };
  }

  const result = await prisma.$transaction(async (tx) => {
    const newItem = await tx.billingItem.create({
      data: {
        code: params.code || '',
        name: params.name || '',
        billingRecipient: params.billingRecipient || '',
        mergeCriteria: params.mergeCriteria || 'name',
        note: params.note || '',
      }
    });

    await tx.billingRate.create({
      data: {
        itemId: newItem.id,
        validFrom: params.validFrom || new Date().toISOString().split('T')[0],
        amount: params.amount || 0,
        note: '최초 등록',
      }
    });

    return await tx.billingItem.findUnique({
      where: { id: newItem.id },
      include: { rates: true }
    });
  });

  if (!result) return { success: false, error: '등록 실패' };

  const formatted: BillingItem = {
    ...result,
    mergeCriteria: result.mergeCriteria as 'code' | 'name',
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
    rates: result.rates.map((r: any) => ({ ...r, createdAt: r.createdAt.toISOString() }))
  };

  return { success: true, data: formatted };
}

/**
 * 단가 변경 (이력 추가)
 */
export async function updateBillingRate(params: {
  itemId: string;
  newAmount: number;
  validFrom: string;
  note: string;
}) {
  const result = await prisma.$transaction(async (tx) => {
    // 현재 유효한 단가 찾기
    const currentRate = await tx.billingRate.findFirst({
      where: { itemId: params.itemId, validTo: null }
    });

    if (currentRate) {
      const validFromDate = new Date(params.validFrom);
      const validToDate = new Date(validFromDate);
      validToDate.setDate(validToDate.getDate() - 1);
      const validToStr = validToDate.toISOString().split('T')[0];

      await tx.billingRate.update({
        where: { id: currentRate.id },
        data: { validTo: validToStr }
      });
    }

    await tx.billingRate.create({
      data: {
        itemId: params.itemId,
        validFrom: params.validFrom,
        amount: params.newAmount,
        note: params.note,
      }
    });

    return await tx.billingItem.findUnique({
      where: { id: params.itemId },
      include: { rates: true }
    });
  });

  if (!result) return { success: false, error: '항목을 찾을 수 없습니다.' };

  const formatted: BillingItem = {
    ...result,
    mergeCriteria: result.mergeCriteria as 'code' | 'name',
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
    rates: result.rates.map((r: any) => ({ ...r, createdAt: r.createdAt.toISOString() }))
  };

  return { success: true, data: formatted };
}

/**
 * 청구 항목 정보 수정 (기본 정보만)
 */
export async function updateBillingItemInfo(params: {
  id: string;
  code?: string;
  name?: string;
  billingRecipient?: string;
  note?: string;
}) {
  const updated = await prisma.billingItem.update({
    where: { id: params.id },
    data: {
      code: params.code,
      name: params.name,
      billingRecipient: params.billingRecipient,
      note: params.note
    },
    include: { rates: true }
  });

  const formatted: BillingItem = {
    ...updated,
    mergeCriteria: updated.mergeCriteria as 'code' | 'name',
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
    rates: updated.rates.map(r => ({ ...r, createdAt: r.createdAt.toISOString() }))
  };

  return { success: true, data: formatted };
}

/**
 * 청구 항목 삭제
 */
export async function deleteBillingItem(id: string) {
  try {
    await prisma.billingItem.delete({
      where: { id }
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to delete billing item:', error);
    return { success: false, error: '삭제 요청 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * 청구 항목 직접 수정 (이력 관리 없이 데이터 자체를 수정)
 */
export async function updateBillingItemDirectly(params: {
  id: string;
  code: string;
  name: string;
  billingRecipient: string;
  amount: number;
  validFrom: string;
  note: string;
  mergeCriteria: 'code' | 'name';
}) {
  // 이름 수정 시 중복 체크 (본인 제외)
  const existing = await prisma.billingItem.findFirst({
    where: { name: params.name, NOT: { id: params.id } }
  });
  if (existing) return { success: false, error: '이미 존재하는 납품처명입니다.' };

  const result = await prisma.$transaction(async (tx) => {
    const updatedItem = await tx.billingItem.update({
      where: { id: params.id },
      data: {
        code: params.code || '',
        name: params.name,
        billingRecipient: params.billingRecipient || '',
        note: params.note || '',
        mergeCriteria: params.mergeCriteria,
      }
    });

    // 마지막 단가 정보 수정
    const lastRate = await tx.billingRate.findFirst({
      where: { itemId: params.id },
      orderBy: { createdAt: 'desc' }
    });

    if (lastRate) {
      await tx.billingRate.update({
        where: { id: lastRate.id },
        data: {
          amount: params.amount || 0,
          validFrom: params.validFrom || lastRate.validFrom
        }
      });
    }

    return await tx.billingItem.findUnique({
      where: { id: params.id },
      include: { rates: true }
    });
  });

  if (!result) return { success: false, error: '항목을 찾을 수 없습니다.' };

  const formatted: BillingItem = {
    ...result,
    mergeCriteria: result.mergeCriteria as 'code' | 'name',
    createdAt: result.createdAt.toISOString(),
    updatedAt: result.updatedAt.toISOString(),
    rates: result.rates.map((r: any) => ({ ...r, createdAt: r.createdAt.toISOString() }))
  };

  return { success: true, data: formatted };
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
    const [rows]: any[] = await dbPool.execute(
      `SELECT IC_DATE, IC_NAME, IC_SO, IC_NAP, IC_TON, IC_KUM, IC_YO, IC_CHUNG, IC_UN, IC_MEMO 
       FROM t_il_car 
       WHERE IC_DATE >= ? AND IC_DATE <= ? 
       ORDER BY IC_DATE ASC, IC_NAME ASC`,
      [startDate, endDate]
    );

    const savedItemsMap = new Map<string, string>(); // key -> id
    const savedKeys = new Set<string>();
    
    const savedSettlements = await prisma.inquirySettlement.findMany({
      where: { startDate, endDate }
    });

    savedSettlements.forEach(s => {
      const key = `${s.date}_${s.name}_${s.so}_${s.nap}_${s.kum}`;
      savedItemsMap.set(key, s.id);
      savedKeys.add(key);
    });

    const decode = (val: any) => {
      if (!val) return '';
      return iconv.decode(Buffer.from(val, 'binary'), 'euckr').trim();
    };

    const parsedRows = rows.map((row: any) => {
      const decodedName = decode(row.IC_NAME);
      const decodedSo = decode(row.IC_SO);
      const decodedNap = decode(row.IC_NAP);
      const decodedKum = Number(row.IC_KUM || 0);
      const decodedDate = row.IC_DATE;
      
      const key = `${decodedDate}_${decodedName}_${decodedSo}_${decodedNap}_${decodedKum}`;
      const savedId = savedItemsMap.get(key);
      
      if (savedId) {
        savedKeys.delete(key);
      }
      
      return {
        date: decodedDate,
        name: decodedName,
        so: decodedSo,
        nap: decodedNap,
        ton: decode(row.IC_TON),
        kum: decodedKum,
        yo: decode(row.IC_YO),
        chung: decode(row.IC_CHUNG),
        un: Number(row.IC_UN || 0),
        memo: decode(row.IC_MEMO),
        isRowSaved: !!savedId,
        savedId: savedId || null,
        isGhost: false
      };
    }).filter((row: any) => {
      const hasKeyword = (text: string) => text.includes('회수') || text.includes('회송');
      const isSpecialCase = hasKeyword(row.name) || hasKeyword(row.so) || hasKeyword(row.nap) || hasKeyword(row.memo);
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

    // DB에는 없는데 저장된 기록만 있는 경우 (고아 데이터)
    const ghostRows = Array.from(savedKeys).map(key => {
      const s = savedSettlements.find(item => item.id === savedItemsMap.get(key));
      if (!s) return null;
      return {
        date: s.date,
        name: s.name,
        so: s.so,
        nap: s.nap,
        ton: s.ton || '',
        kum: s.kum,
        yo: s.yo || '',
        chung: s.chung || '',
        un: s.un || 0,
        memo: (s.memo || '') + ' [원본 데이터 없음(삭제됨)]',
        isRowSaved: true,
        savedId: s.id,
        isGhost: true
      };
    }).filter(row => row !== null);

    // 필터링된 배열과 고아 데이터를 합친 후 일련번호(no) 부여
    const combinedData = [...parsedRows, ...ghostRows]
      .sort((a: any, b: any) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
      .map((item: any, index: number) => ({
        no: index + 1,
        ...item
      }));

    return { 
      success: true, 
      data: combinedData,
      isSaved: savedSettlements.length > 0
    };
  } catch (error: any) {
    console.error('Failed to fetch inquiry billing:', error);
    const errorMessage = error.code === 'ETIMEDOUT' ? 'MySQL 서버 연결 타임아웃' : `DB 접속 실패: ${error.message}`;
    return { success: false, error: errorMessage };
  }
}

/**
 * 청구 정산 저장 여부 확인
 */
async function checkInquirySaved(startDate: string, endDate: string) {
  try {
    const count = await prisma.inquirySettlement.count({
      where: { startDate, endDate }
    });
    return count > 0;
  } catch (e) {
    return false;
  }
}

/**
 * 청구 정산 기록 저장
 */
export async function saveInquirySettlements(params: {
  records: Array<{
    date: string;
    name: string;
    so: string;
    nap: string;
    ton: string;
    kum: number;
    yo: string;
    chung: string;
    un: number;
    memo: string;
    startDate: string;
    endDate: string;
  }>
}) {
  try {
    if (!params.records || params.records.length === 0) {
      return { success: false, error: '저장할 레코드가 없습니다.' };
    }

    const targetStart = params.records[0].startDate;
    const targetEnd = params.records[0].endDate;
    
    const newKeys = params.records.map((r: any) => ({
      date: r.date,
      name: r.name,
      so: r.so,
      nap: r.nap,
      kum: r.kum
    }));

    await prisma.$transaction(async (tx) => {
      for (const k of newKeys) {
        await tx.inquirySettlement.deleteMany({
          where: {
            startDate: targetStart,
            endDate: targetEnd,
            date: k.date,
            name: k.name,
            so: k.so,
            nap: k.nap,
            kum: k.kum
          }
        });
      }

      await tx.inquirySettlement.createMany({
        data: params.records.map(r => ({
          startDate: targetStart,
          endDate: targetEnd,
          date: r.date,
          name: r.name,
          so: r.so,
          nap: r.nap,
          ton: r.ton,
          kum: r.kum,
          yo: r.yo,
          chung: r.chung,
          un: r.un,
          memo: r.memo
        }))
      });
    });

    revalidatePath('/billing/inquiry');
    return { success: true };
  } catch (error) {
    console.error('Failed to save inquiry settlements:', error);
    return { success: false, error: '정산 기록 저장 중 오류가 발생했습니다.' };
  }
}

/**
 * 청구 정산 기록 삭제
 */
export async function deleteInquirySettlements(params: {
  startDate: string;
  endDate: string;
  ids?: string[];
}) {
  try {
    if (params.ids && params.ids.length > 0) {
      await prisma.inquirySettlement.deleteMany({
        where: { id: { in: params.ids } }
      });
    } else {
      await prisma.inquirySettlement.deleteMany({
        where: { startDate: params.startDate, endDate: params.endDate }
      });
    }

    revalidatePath('/billing/inquiry');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete inquiry settlements:', error);
    return { success: false, error: '정산 기록 삭제 중 오류가 발생했습니다.' };
  }
}

/**
 * 긴급 출고 단가 조회 (헬퍼)
 */
async function getEmergencyRates(): Promise<Record<string, { rate: number, chung: string }>> {
  try {
    const rates = await prisma.emergencyRate.findMany();
    return rates.reduce((acc, r) => {
      acc[r.name] = { rate: r.rate, chung: r.chung };
      return acc;
    }, {} as Record<string, { rate: number, chung: string }>);
  } catch (e) {
    return {};
  }
}

/**
 * 긴급 출고 단가 업데이트
 */
export async function updateEmergencyRate(name: string, rate: number, chung: string) {
  try {
    await prisma.emergencyRate.upsert({
      where: { name },
      update: { rate, chung },
      create: { name, rate, chung }
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to update emergency rate:', error);
    return { success: false };
  }
}

/**
 * 긴급 출고 조회 (t_balju 테이블)
 */
export async function getEmergencyShipments(params: {
  startDate: string;
  endDate: string;
}) {
  const { startDate, endDate } = params;

  try {
    const [rows]: any[] = await dbPool.execute(
      `SELECT B_C_CODE, B_C_NAME, B_MEMO, B_DATE, CB_ADDRESS 
       FROM t_balju 
       WHERE B_DATE >= ? AND B_DATE <= ? 
       ORDER BY B_DATE DESC`,
      [startDate, endDate]
    );

    const decode = (val: any) => {
      if (!val) return '';
      return iconv.decode(Buffer.from(val, 'binary'), 'euckr').trim();
    };

    const masterRates = await getEmergencyRates();
    const groupedData: Record<string, any> = {};
    const dateSets: Record<string, Set<string>> = {};

    rows.forEach((row: any) => {
      const name = decode(row.B_C_NAME);
      const memo = decode(row.B_MEMO);
      const address = decode(row.CB_ADDRESS);
      const dateStr = row.B_DATE instanceof Date 
        ? row.B_DATE.toISOString().split('T')[0] 
        : (typeof row.B_DATE === 'string' ? row.B_DATE.substring(0, 10) : '');
      
      if (name.includes('긴급') || name.includes('*') || name.includes('★')) {
        if (!groupedData[name]) {
          groupedData[name] = {
            code: String(row.B_C_CODE || '').trim(),
            name: name,
            address: address,
            memo: memo,
            latestDate: dateStr,
            rate: masterRates[name]?.rate || 0,
            chung: masterRates[name]?.chung || '',
          };
          dateSets[name] = new Set([dateStr]);
        } else {
          dateSets[name].add(dateStr);
          if (dateStr > groupedData[name].latestDate) groupedData[name].latestDate = dateStr;
          if (!groupedData[name].address && address) groupedData[name].address = address;
        }
      }
    });

    const result = Object.values(groupedData).map((item: any, index: number) => ({
      no: index + 1,
      ...item,
      count: dateSets[item.name].size,
      dates: Array.from(dateSets[item.name]).sort().reverse()
    }));

    const isSavedCount = await prisma.emergencySettlement.count({
      where: { startDate, endDate }
    });

    return { success: true, data: result, isSaved: isSavedCount > 0 };
  } catch (error: any) {
    console.error('Failed to fetch emergency shipments:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 통합 청구 요약 데이터 생성
 */
export async function getMonthlyBillingSummary(params: {
  startDate: string;
  endDate: string;
}) {
  const { startDate, endDate } = params;

  try {
    const [rows]: any[] = await dbPool.execute(
      `SELECT B_DATE, B_C_CODE, B_C_NAME, B_QTY, B_KG, B_MEMO 
       FROM t_balju 
       WHERE B_DATE >= ? AND B_DATE <= ? 
       ORDER BY B_DATE ASC`,
      [startDate, endDate]
    );

    const billingItems = await prisma.billingItem.findMany({
      include: { rates: true }
    });

    const decode = (val: any) => {
      if (!val) return '';
      return iconv.decode(Buffer.from(val, 'binary'), 'euckr').trim();
    };

    const summary: Record<string, any> = {};

    rows.forEach((row: any) => {
      const date = row.B_DATE instanceof Date 
        ? row.B_DATE.toISOString().split('T')[0] 
        : (typeof row.B_DATE === 'string' ? row.B_DATE.substring(0, 10) : '');
      const code = String(row.B_C_CODE || '').trim();
      const name = decode(row.B_C_NAME);
      
      const billingItem = billingItems.find((item: any) => {
        if (item.mergeCriteria === 'code') return item.code === code;
        return item.name === name;
      });

      if (!billingItem) return;

      const groupKey = billingItem.mergeCriteria === 'code' ? code : name;
      const uniqueDayKey = `${date}_${groupKey}`;

      if (!summary[groupKey]) {
        summary[groupKey] = {
          name: billingItem.name,
          delivery: name,
          cost: 0,
          count: 0,
          days: new Set(),
          remarks: billingItem.note || '',
          isGS: billingItem.mergeCriteria === 'code' && billingItem.name.includes('GS')
        };
      }

      summary[groupKey].days.add(uniqueDayKey);
    });

    const result = Object.values(summary).map((item: any) => {
      const billingItem = billingItems.find((bi: any) => bi.name === item.name);
      const count = item.days.size;
      const rate = billingItem?.rates?.find((r: any) => r.validTo === null)?.amount || 0;
      let cost = count * rate;

      if (item.isGS) {
        const bonus = 30000;
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
  } catch (error: any) {
    console.error('Failed to get monthly billing summary:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 긴급 출고 정산 기록 저장
 */
export async function saveEmergencySettlements(params: {
  records: Array<{
    name: string;
    startDate: string;
    endDate: string;
    count: number;
    rate: number;
    total: number;
    chung?: string;
    memo?: string;
    dates?: string[];
  }>
}) {
  try {
    if (!params.records || params.records.length === 0) {
      return { success: false, error: '저장할 레코드가 없습니다.' };
    }

    const targetStart = params.records[0].startDate;
    const targetEnd = params.records[0].endDate;

    await prisma.$transaction(async (tx) => {
      await tx.emergencySettlement.deleteMany({
        where: { startDate: targetStart, endDate: targetEnd }
      });

      await tx.emergencySettlement.createMany({
        data: params.records.map(record => ({
          name: record.name,
          startDate: targetStart,
          endDate: targetEnd,
          count: record.count,
          rate: record.rate,
          total: record.total,
          chung: record.chung || '',
          dates: record.dates || []
        }))
      });

      for (const r of params.records) {
        await tx.emergencyRate.upsert({
          where: { name: r.name },
          update: { rate: r.rate, chung: r.chung || '' },
          create: { name: r.name, rate: r.rate, chung: r.chung || '' }
        });
      }
    });

    revalidatePath('/billing/emergency');
    return { success: true };
  } catch (error) {
    console.error('Failed to save emergency settlements:', error);
    return { success: false, error: '정산 기록 저장 중 오류가 발생했습니다.' };
  }
}

/**
 * 긴급 출고 정산 기록 삭제
 */
export async function deleteEmergencySettlements(params: {
  startDate: string;
  endDate: string;
  names?: string[];
}) {
  try {
    const targetStart = params.startDate;
    const targetEnd = params.endDate;

    await prisma.$transaction(async (tx) => {
      if (params.names && params.names.length > 0) {
        await tx.emergencySettlement.deleteMany({
          where: {
            startDate: targetStart,
            endDate: targetEnd,
            name: { in: params.names }
          }
        });

        await tx.emergencyRate.deleteMany({
          where: { name: { in: params.names } }
        });
      } else {
        const targets = await tx.emergencySettlement.findMany({
          where: { startDate: targetStart, endDate: targetEnd },
          select: { name: true }
        });
        const targetNames = targets.map(t => t.name);

        await tx.emergencySettlement.deleteMany({
          where: { startDate: targetStart, endDate: targetEnd }
        });

        await tx.emergencyRate.deleteMany({
          where: { name: { in: targetNames } }
        });
      }
    });

    revalidatePath('/billing/emergency');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete emergency settlements:', error);
    return { success: false, error: '정산 기록 삭제 중 오류가 발생했습니다.' };
  }
}

/**
 * 저장된 청구 정산 기록 조회
 */
export async function getSavedInquirySettlements(params: {
  startDate: string;
  endDate: string;
  searchTerm?: string;
}) {
  try {
    const filtered = await prisma.inquirySettlement.findMany({
      where: {
        startDate: params.startDate,
        endDate: params.endDate,
        ...(params.searchTerm ? {
          OR: [
            { name: { contains: params.searchTerm, mode: 'insensitive' } },
            { so: { contains: params.searchTerm, mode: 'insensitive' } },
            { nap: { contains: params.searchTerm, mode: 'insensitive' } },
            { chung: { contains: params.searchTerm, mode: 'insensitive' } },
            { memo: { contains: params.searchTerm, mode: 'insensitive' } }
          ]
        } : {})
      },
      orderBy: { date: 'asc' }
    });

    return { success: true, data: filtered };
  } catch (error) {
    console.error('Failed to get saved inquiry settlements:', error);
    return { success: false, error: '저장된 정산 기록을 가져오는 중 오류가 발생했습니다.' };
  }
}

/**
 * 고정 비용 목록 조회
 */
export async function getFixedSettlements() {
  try {
    const data = await prisma.fixedSettlement.findMany({
      orderBy: { createdAt: 'desc' }
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to get fixed settlements:', error);
    return { success: false, error: '고정 비용 목록을 가져오는 중 오류가 발생했습니다.' };
  }
}

/**
 * 고정 비용 저장
 */
export async function saveFixedSettlement(params: {
  id?: string;
  name: string;
  billingRecipient: string;
  amount: number;
  memo: string;
}) {
  console.log('Saving Fixed Settlement:', params);
  try {
    if (params.id) {
      await prisma.fixedSettlement.update({
        where: { id: params.id },
        data: {
          name: params.name,
          billingRecipient: params.billingRecipient,
          amount: params.amount,
          note: params.memo
        }
      });
    } else {
      await prisma.fixedSettlement.create({
        data: {
          name: params.name,
          billingRecipient: params.billingRecipient,
          amount: params.amount,
          note: params.memo
        }
      });
    }

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to save fixed settlement:', error);
    return { success: false, error: '고정 비용 저장 중 오류가 발생했습니다.' };
  }
}

/**
 * 고정 비용 삭제
 */
export async function deleteFixedSettlement(id: string) {
  try {
    await prisma.fixedSettlement.delete({
      where: { id }
    });
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete fixed settlement:', error);
    return { success: false, error: '고정 비용 삭제 중 오류가 발생했습니다.' };
  }
}
