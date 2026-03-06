'use server';

import dbPool from '@/lib/mysql';
import iconv from 'iconv-lite';
import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';

interface GSPickingConfig {
  boxesPerPallet: number;
  ratePerPallet: number;
}


// GS 정산 데이터 저장
export async function saveGSSettlements(data: any[]) {
  try {
    const now = new Date();

    await prisma.$transaction(
      data.map((item) => {
        return prisma.gSSettlement.upsert({
          where: {
            GS_UNIQUE: {
              date: item.date,
              code: item.code
            }
          },
          update: {
            name: item.name,
            qty: item.qty,
            weight: item.weight,
            amount: item.amount || 0,
            remarks: item.remarks || '',
            modDate: now
          },
          create: {
            date: item.date,
            code: item.code,
            name: item.name,
            qty: item.qty,
            weight: item.weight,
            amount: item.amount || 0,
            remarks: item.remarks || '',
            modDate: now
          }
        });
      })
    );

    return { success: true };
  } catch (error) {
    console.error('Failed to save GS settlements:', error);
    return { success: false, error: '데이터 저장 중 오류가 발생했습니다.' };
  }
}

/**
 * GS 정산 요약 데이터 저장
 */
export async function saveGSSummary(params: {
  startDate: string;
  endDate: string;
  summary: {
    weekday: number;
    saturday: number;
    sunday: number;
    extraTrucks: number;
    totalAmount: number;
    dates?: string[];
  };
}) {
  try {
    await prisma.gSSummary.upsert({
      where: {
        GS_SUMMARY_UNIQUE: {
          startDate: params.startDate,
          endDate: params.endDate
        }
      },
      update: {
        weekday: params.summary.weekday,
        saturday: params.summary.saturday,
        sunday: params.summary.sunday,
        extraTrucks: params.summary.extraTrucks,
        totalAmount: params.summary.totalAmount,
        dates: params.summary.dates || []
      },
      create: {
        startDate: params.startDate,
        endDate: params.endDate,
        weekday: params.summary.weekday,
        saturday: params.summary.saturday,
        sunday: params.summary.sunday,
        extraTrucks: params.summary.extraTrucks,
        totalAmount: params.summary.totalAmount,
        dates: params.summary.dates || []
      }
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to save GS summary:', error);
    return { success: false, error: '요약 데이터 저장 중 오류가 발생했습니다.' };
  }
}

/**
 * 일일 출고 정산 요약 데이터 저장
 */
export async function saveDailySummary(params: {
  startDate: string;
  endDate: string;
  items: {
    placeName: string;
    deliveryDays: number;
    totalAmount: number;
    deliveryDates?: string[];
  }[];
}) {
  try {
    await prisma.$transaction(async (tx) => {
      // 기존 요약 삭제 (Cascading으로 아이템도 삭제됨)
      await tx.dailySummary.deleteMany({
        where: { startDate: params.startDate, endDate: params.endDate }
      });

      // 새 요약 생성
      const summary = await tx.dailySummary.create({
        data: {
          startDate: params.startDate,
          endDate: params.endDate
        }
      });

      // 요약 아이템 생성
      await tx.dailySummaryItem.createMany({
        data: params.items.map(item => ({
          summaryId: summary.id,
          placeName: item.placeName,
          deliveryDays: item.deliveryDays,
          totalAmount: item.totalAmount,
          deliveryDates: item.deliveryDates || []
        }))
      });
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to save daily summary:', error);
    return { success: false, error: '요약 데이터 저장 중 오류가 발생했습니다.' };
  }
}


/**
 * 저장된 일일, GS, 긴급 정산 요약 데이터를 기간별로 필터링하여 반환
 */
export async function getIntegratedBillingSummary(params: {
  startDate: string;
  endDate: string;
}) {
  const { startDate, endDate } = params;

  const startNum = Number(startDate.replace(/[^0-9]/g, ''));
  const endNum = Number(endDate.replace(/[^0-9]/g, ''));

  try {
    // 모든 데이터를 병렬로 로드하여 속도 개선
    const [
      dailySummary,
      gsSummary,
      emergencySettlements,
      inquirySettlements,
      fixedSettlements,
      billingItems
    ] = await Promise.all([
      prisma.dailySummary.findFirst({
        where: { startDate, endDate },
        include: { items: true }
      }),
      prisma.gSSummary.findFirst({
        where: { startDate, endDate }
      }),
      prisma.emergencySettlement.findMany({
        where: { startDate, endDate }
      }),
      prisma.inquirySettlement.findMany({
        where: { startDate, endDate }
      }),
      prisma.fixedSettlement.findMany(),
      prisma.billingItem.findMany()
    ]);

    // 일일 출고 항목에 청구처 정보 매핑
    const dailyWithBilling = (dailySummary?.items || []).map((item: any) => {
      const billingInfo = billingItems.find(bi => bi.name === item.placeName);
      return {
        ...item,
        billingRecipient: billingInfo?.billingRecipient || '본사청구'
      };
    });    // 고정비 결정
    let finalFixedCosts = fixedSettlements;

    // 청구 조회 항목에 청구처 정보 매핑 (chung이 비어있는 경우 마스터 데이터 활용)
    const inquiryWithBilling = inquirySettlements.map((item: any) => {
      // nap(납품처)으로 마스터 데이터 찾기
      const billingInfo = billingItems.find(bi => bi.name === item.nap);
      return {
        ...item,
        // 기존 chung이 있으면 유지, 없으면 마스터 데이터의 청구처, 그것도 없으면 본사청구
        chung: item.chung || billingInfo?.billingRecipient || '본사청구'
      };
    });

    return {
      success: true,
      data: {
        daily: dailyWithBilling,
        gs: gsSummary ? { summary: gsSummary } : null,
        emergency: emergencySettlements,
        inquiry: inquiryWithBilling,
        fixed: finalFixedCosts
      }
    };
  } catch (error: any) {
    console.error('Failed to get integrated billing summary:', error);
    return { success: false, error: '데이터를 가져오는 중 오류가 발생했습니다.' };
  }
}

export async function getDailySettlements(params: {
  startDate: string;
  endDate: string;
  searchTerm?: string;
  type?: 'daily' | 'gs' | 'gs-picking';
}) {
  const { startDate, endDate, searchTerm, type = 'daily' } = params;

  // GS 관련 타입인 경우 코드 기준 처리 (Release/Picking 모두 포함)
  const isGSType = type === 'gs' || type === 'gs-picking';

  try {
    // 0. 저장된 데이터 가져오기 (GS 관련 타입인 경우)
    let savedGSDataMap = new Map<string, any>();
    if (isGSType) {
      const savedGS = await prisma.gSSettlement.findMany({
        where: { date: { gte: startDate, lte: endDate } }
      });
      savedGS.forEach(item => {
        savedGSDataMap.set(`${item.date}_${item.code}`, item);
      });
    }

    // 2. [수정] 마스터 명칭 맵 구성을 위해 청구 비용 데이터 로드 (DB에서)
    const billingItems = await prisma.billingItem.findMany();
    const masterNames: Record<string, string> = {};

    // 마스터 명칭 맵 구성 (코드 -> 이름)
    billingItems.forEach((item: any) => {
      if (item.code) {
        masterNames[String(item.code).trim()] = item.name;
      }
    });

    // 한글 변환 함수
    const decode = (val: any) => {
      if (!val) return '';
      return iconv.decode(Buffer.from(val, 'binary'), 'euckr').trim();
    };

    // [중요] 자동 정산 필터링 (WhiteList) 및 마스터 명칭 맵 생성
    let searchTerms: string[] = [];
    let criteria: 'name' | 'code' = (type === 'gs' || type === 'gs-picking') ? 'code' : 'name';

    if (searchTerm) {
      searchTerms = searchTerm.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    } else {
      searchTerms = billingItems
        .filter((item: any) => {
          const isCriteriaMatch = item.mergeCriteria === criteria;
          if (type === 'daily' && isCriteriaMatch) {
            return !item.name.includes('긴급');
          }
          return isCriteriaMatch;
        })
        .map((item: any) => (criteria === 'code' ? String(item.code || '') : String(item.name || '')).trim())
        .filter((t) => t.length > 0);
    }

    // 1. [최적화] DB 쿼리 레벨에서 날짜/코드/이름 단위로 그룹핑(Aggregation) 적용
    let sqlQuery = `
      SELECT 
        b.B_DATE, 
        b.B_C_CODE, 
        b.B_C_NAME, 
        SUM(IFNULL(b.B_QTY, 0) / COALESCE(NULLIF(b.B_IN_QTY, 0), NULLIF(p.P_IPSU, 0), 1)) AS TOTAL_BOXES,
        SUM(IFNULL(b.B_KG, 0)) AS TOTAL_WEIGHT
      FROM t_balju b
      LEFT JOIN t_product p ON b.B_P_NO = p.P_CODE
      WHERE b.B_DATE >= ? AND b.B_DATE <= ? 
    `;

    // searchTerm이나 명확한 필터(IN 구문)가 있다면 여기서 더 필터링 가능하지만, 
    // EUC-KR 문자셋 변환 이슈를 안전하게 넘기기 위해 Grouping만 DB단에서 우선 수행하고 최종 필터링을 로직으로 처리.
    sqlQuery += `
      GROUP BY b.B_DATE, b.B_C_CODE, b.B_C_NAME
      ORDER BY b.B_DATE ASC, b.B_C_CODE ASC
    `;

    const [rows]: any[] = await dbPool.execute(sqlQuery, [startDate, endDate]);

    // 데이터 가공 및 필터링
    const groupedRows: { [key: string]: any } = {};

    rows.forEach((curr: any) => {
      const date = curr.B_DATE instanceof Date
        ? curr.B_DATE.toISOString().split('T')[0]
        : (typeof curr.B_DATE === 'string' ? curr.B_DATE.substring(0, 10) : '');
      const code = String(curr.B_C_CODE || '').trim();

      // GS 타입인 경우 코드 기준으로 마스터 명칭 사용, 아니면 DB 명칭 사용
      const name = (isGSType && masterNames[code]) ? masterNames[code] : decode(curr.B_C_NAME);
      const boxes = Number(curr.TOTAL_BOXES || 0);
      const weight = Number(curr.TOTAL_WEIGHT || 0);

      // 필터링 적용
      let matches = false;
      const compareValue = isGSType ? code : name;

      if (searchTerms.length > 0) {
        matches = searchTerms.some((term: string) => {
          const t = term.trim();
          return isGSType ? code === t : compareValue.includes(t);
        });
      } else {
        matches = true;
      }

      if (matches) {
        const groupKey = isGSType ? code : name;
        const key = `${date}_${groupKey}`;

        if (!groupedRows[key]) {
          groupedRows[key] = {
            date: date,
            code: code,
            name: name,
            qty: 0,
            weight: 0,
            remarks: '',
            isSaved: false
          };
        }

        groupedRows[key].qty += boxes;
        groupedRows[key].weight += weight;
      }
    });

    // [정산 데이터 병합] 저장된 데이터(JSON)가 있으면 덮어쓰기 또는 추가 (GS 전용)
    if (isGSType) {
      // 1. 기존 그룹화 데이터 업데이트
      Object.keys(groupedRows).forEach(key => {
        const saved = savedGSDataMap.get(key);
        if (saved) {
          groupedRows[key] = {
            ...groupedRows[key],
            ...saved,
            qty: Number(saved.qty),
            weight: Number(saved.weight),
            isSaved: true
          };
        }
      });

      // 2. DB에는 없으나 저장된 데이터에만 있는 항목 추가 (기간 내)
      savedGSDataMap.forEach((item, key) => {
        if (!groupedRows[key]) {
          const compareValue = isGSType ? item.code : item.name;
          let matches = false;
          if (searchTerms.length > 0) {
            matches = searchTerms.some((term: string) => {
              const t = term.trim();
              return isGSType ? item.code === t : String(compareValue).includes(t);
            });
          } else {
            matches = true;
          }

          if (matches) {
            groupedRows[key] = {
              ...item,
              qty: Number(item.qty),
              weight: Number(item.weight),
              isSaved: true
            };
          }
        }
      });
    }

    const result = Object.values(groupedRows)
      .sort((a: any, b: any) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const sortKey = (type === 'gs' || type === 'gs-picking') ? 'code' : 'name';
        return a[sortKey].localeCompare(b[sortKey]);
      })
      .map((item: any, index: number) => ({
        no: index + 1,
        ...item,
        qty: Math.round(item.qty * 100) / 100,
        weight: Math.ceil(item.weight)
      }));

    // [저장 상태 확인] 일일 출고 정산(daily)인 경우 확인
    let isSaved = false;
    if (type === 'daily') {
      const summary = await prisma.dailySummary.findFirst({
        where: { startDate, endDate }
      });
      isSaved = !!summary;
    } else if (isGSType) {
      isSaved = result.some((r: any) => r.isSaved);
    }

    return { success: true, data: result, isSaved };
  } catch (error) {
    console.error('Failed to fetch settlements:', error);
    return { success: false, error: '데이터를 가져오는 중 오류가 발생했습니다.' };
  }
}

/**
 * GS 피킹 설정 가져오기
 */
export async function getGSPickingConfig(): Promise<{ success: boolean; data: GSPickingConfig }> {
  try {
    const config = await prisma.config.findUnique({
      where: { key: 'gsPicking' }
    });

    if (config && config.data) {
      const data = config.data as any;
      return {
        success: true,
        data: {
          boxesPerPallet: data.boxesPerPallet ?? 78,
          ratePerPallet: data.ratePerPallet ?? 8000
        }
      };
    }

    return { success: true, data: { boxesPerPallet: 78, ratePerPallet: 8000 } };
  } catch (error) {
    console.error('Failed to get GS picking config:', error);
    return { success: false, data: { boxesPerPallet: 78, ratePerPallet: 8000 } };
  }
}

/**
 * GS 피킹 설정 업데이트
 */
export async function updateGSPickingConfig(params: GSPickingConfig) {
  try {
    await prisma.config.upsert({
      where: { key: 'gsPicking' },
      update: {
        data: {
          boxesPerPallet: params.boxesPerPallet,
          ratePerPallet: params.ratePerPallet,
          updatedAt: new Date().toISOString()
        } as any
      },
      create: {
        key: 'gsPicking',
        data: {
          boxesPerPallet: params.boxesPerPallet,
          ratePerPallet: params.ratePerPallet,
          updatedAt: new Date().toISOString()
        } as any
      }
    });
    return { success: true };
  } catch (error) {
    console.error('Failed to update GS picking config:', error);
    return { success: false, error: '설정 저장 중 오류가 발생했습니다.' };
  }
}
