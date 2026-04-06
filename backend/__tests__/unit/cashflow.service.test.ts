/**
 * Unit tests — cashflowService
 * Prisma is mocked so no database is needed.
 */

// Mock Prisma before importing the service
jest.mock('../../src/utils/prisma', () => ({
  __esModule: true,
  default: {
    cashflow: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import prisma from '../../src/utils/prisma';
import { cashflowService } from '../../src/modules/cashflow/cashflow.service';

const mockFindMany = prisma.cashflow.findMany as jest.Mock;
const mockCreate   = prisma.cashflow.create   as jest.Mock;

describe('cashflowService.getSummary()', () => {
  it('tính đúng income, expense và balance', async () => {
    mockFindMany.mockResolvedValue([
      { id: 1, type: 'income',  amount: 500_000, date: new Date() },
      { id: 2, type: 'income',  amount: 300_000, date: new Date() },
      { id: 3, type: 'expense', amount: 200_000, date: new Date() },
    ]);

    const result = await cashflowService.getSummary();

    expect(result.income).toBe(800_000);
    expect(result.expense).toBe(200_000);
    expect(result.balance).toBe(600_000);
  });

  it('trả về 0 khi không có giao dịch', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await cashflowService.getSummary();

    expect(result.income).toBe(0);
    expect(result.expense).toBe(0);
    expect(result.balance).toBe(0);
  });

  it('balance âm khi expense > income', async () => {
    mockFindMany.mockResolvedValue([
      { id: 1, type: 'expense', amount: 1_000_000, date: new Date() },
      { id: 2, type: 'income',  amount: 300_000,   date: new Date() },
    ]);

    const result = await cashflowService.getSummary();

    expect(result.balance).toBe(-700_000);
  });
});

describe('cashflowService.create()', () => {
  it('tạo cashflow entry với date mặc định là hôm nay', async () => {
    const fakeEntry = { id: 1, type: 'income', amount: 100_000, category: 'Bán hàng', date: new Date() };
    mockCreate.mockResolvedValue(fakeEntry);

    const result = await cashflowService.create({
      type: 'income',
      category: 'Bán hàng',
      amount: 100_000,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0].data;
    expect(callArg.type).toBe('income');
    expect(callArg.amount).toBe(100_000);
    expect(callArg.date).toBeInstanceOf(Date);
    expect(result).toEqual(fakeEntry);
  });

  it('dùng date được truyền vào thay vì hôm nay', async () => {
    const specificDate = '2025-01-15';
    mockCreate.mockResolvedValue({ id: 2 });

    await cashflowService.create({
      type: 'expense',
      category: 'Tiền điện',
      amount: 50_000,
      date: specificDate,
    });

    const callArg = mockCreate.mock.calls[0][0].data;
    expect(callArg.date).toEqual(new Date(specificDate));
  });
});
