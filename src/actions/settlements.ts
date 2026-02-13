'use server';

import mysql from 'mysql2/promise';
import iconv from 'iconv-lite';
import { promises as fs } from 'fs';
import path from 'path';

export async function getDailySettlements(params: {
  startDate: string;
  endDate: string;
  searchTerm?: string;
  type?: 'daily' | 'gs' | 'gs-picking';
}) {
  const { startDate, endDate, searchTerm, type = 'daily' } = params;

  try {
    // MySQL 직접 연결 (Prisma의 인코딩 문제 회피)
    const connection = await mysql.createConnection(process.env.MYSQL_URL as string);
    
    // DB가 latin1로 인식하더라도 실제 데이터는 EUC-KR인 경우를 위해 latin1 설정
    await connection.query("SET NAMES 'latin1'");

    // 1. 기간 내 모든 데이터를 가져와서 메모리에서 필터링
    const [rows]: any[] = await connection.execute(
      `SELECT 
        b.B_DATE, b.B_C_CODE, b.B_C_NAME, b.B_P_NO, b.B_P_NAME, b.B_QTY, b.B_IN_QTY, b.B_KG, b.B_MEMO,
        p.P_IPSU
      FROM t_balju b
      LEFT JOIN t_product p ON b.B_P_NO = p.P_CODE
      WHERE b.B_DATE >= ? AND b.B_DATE <= ? 
      ORDER BY b.B_DATE ASC, b.B_C_CODE ASC`,
      [startDate, endDate]
    );

    await connection.end();

    // 한글 변환 함수
    const decode = (val: any) => {
      if (!val) return '';
      return iconv.decode(Buffer.from(val, 'binary'), 'euckr').trim();
    };

    // [중요] 자동 정산 필터링 (WhiteList) 및 마스터 명칭 맵 생성
    let searchTerms: string[] = [];
    let criteria: 'name' | 'code' = (type === 'gs' || type === 'gs-picking') ? 'code' : 'name';
    const masterNames: Record<string, string> = {};

    // 청구 비용 데이터 로드
    let billingItems: any[] = [];
    try {
      const filePath = path.join(process.cwd(), 'data', 'billing.json');
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const billingData = JSON.parse(fileContent);
      billingItems = billingData.items;

      // 마스터 명칭 맵 구성 (코드 -> 이름)
      billingItems.forEach((item: any) => {
        if (item.code) {
          masterNames[String(item.code).trim()] = item.name;
        }
      });
    } catch (err) {
      console.warn('Billing data not found or error reading:', err);
    }

    const isGSType = type === 'gs' || type === 'gs-picking';

    if (searchTerm) {
      searchTerms = searchTerm.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
    } else {
      // [수정] 해당 타입의 기준(criteria)과 일치하는 마스터 항목만 추출
      searchTerms = billingItems
        .filter((item: any) => item.mergeCriteria === criteria)
        .map((item: any) => (criteria === 'code' ? String(item.code || '') : String(item.name || '')).trim())
        .filter((t) => t.length > 0);
    }

    // 데이터 가공 및 필터링
    const groupedRows: { [key: string]: any } = {};

    rows.forEach((curr: any) => {
      const date = curr.B_DATE instanceof Date 
        ? curr.B_DATE.toISOString().split('T')[0] 
        : (typeof curr.B_DATE === 'string' ? curr.B_DATE.substring(0, 10) : '');
      const code = String(curr.B_C_CODE || '').trim();
      
      // GS 타입인 경우 코드 기준으로 마스터 명칭 사용, 아니면 DB 명칭 사용
      const name = (isGSType && masterNames[code]) ? masterNames[code] : decode(curr.B_C_NAME);
      
      const memo = decode(curr.B_MEMO);
      
      // [수정] 박스 수량 산출 식 적용: 출고수량(B_QTY) / 입수(B_IN_QTY) = 박스
      const b_qty = Number(curr.B_QTY || 0);
      const b_in_qty = Number(curr.B_IN_QTY || curr.P_IPSU || 1);
      const boxes = b_qty / b_in_qty;

      const weight = Number(curr.B_KG || 0);

      // 필터링 적용
      let matches = false;
      const compareValue = isGSType ? code : name;

      if (searchTerms.length > 0) {
        matches = searchTerms.some(term => {
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
            note: memo
          };
        }
        
        groupedRows[key].qty += boxes;
        groupedRows[key].weight += weight;
      }
    });

    const result = Object.values(groupedRows)
      .sort((a: any, b: any) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const sortKey = (type === 'gs' || type === 'gs-picking') ? 'code' : 'name';
        return a[sortKey].localeCompare(b[sortKey]);
      })
      .map((item: any, index: number) => ({
        no: index + 1,
        ...item,
        // UI 표시 및 합계를 위해 소수점 2자리 유지 (데이터 정확성 확보)
        qty: Math.round(item.qty * 100) / 100,
        // 중량 올림 처리 (사용자 요청)
        weight: Math.ceil(item.weight)
      }));

    return { success: true, data: result };
  } catch (error) {
    console.error('Failed to fetch settlements:', error);
    return { success: false, error: '데이터를 가져오는 중 오류가 발생했습니다.' };
  }
}
