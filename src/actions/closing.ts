'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * 지점 청구 마감 데이터(스냅샷) 저장
 */
export async function saveMonthlyClosing(params: {
  startDate: string;
  endDate: string;
  data: any;
}) {
  try {
    const { startDate, endDate, data } = params;

    await prisma.monthlyClosing.upsert({
      where: {
        CLOSING_UNIQUE: {
          startDate,
          endDate
        }
      },
      update: {
        data,
        closedAt: new Date()
      },
      create: {
        startDate,
        endDate,
        data,
        closedAt: new Date()
      }
    });

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to save monthly closing:', error);
    return { success: false, error: '마감 처리 중 오류가 발생했습니다.' };
  }
}

/**
 * 지점 청구 마감 데이터 조회
 */
export async function getMonthlyClosing(params: {
  startDate: string;
  endDate: string;
}) {
  try {
    const { startDate, endDate } = params;

    const closing = await prisma.monthlyClosing.findUnique({
      where: {
        CLOSING_UNIQUE: {
          startDate,
          endDate
        }
      }
    });

    return { success: true, data: closing };
  } catch (error) {
    console.error('Failed to get monthly closing:', error);
    return { success: false, error: '마감 데이터를 가져오는 중 오류가 발생했습니다.' };
  }
}

/**
 * 지점 청구 마감 취소 (스냅샷 삭제)
 */
export async function deleteMonthlyClosing(params: {
  startDate: string;
  endDate: string;
}) {
  try {
    const { startDate, endDate } = params;

    await prisma.monthlyClosing.delete({
      where: {
        CLOSING_UNIQUE: {
          startDate,
          endDate
        }
      }
    });

    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error('Failed to delete monthly closing:', error);
    return { success: false, error: '마감 취소 중 오류가 발생했습니다.' };
  }
}
