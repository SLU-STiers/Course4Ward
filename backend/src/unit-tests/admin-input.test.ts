// Validation of admin inputs: account names, report / log dates, and search text.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Role } from '@prisma/client';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { ReportRangeDto } from '../reports/dto/report-range.dto';
import { AuditLogQueryDto } from '../audit-log/dto/audit-log-query.dto';
import { escapeLike } from '../common/like';
import { endOfDateBound, startOfDateBound } from '../common/date-bounds';

const account = (overrides: Record<string, unknown> = {}) =>
  plainToInstance(CreateUserDto, {
    firstName: 'Maria',
    lastName: 'Santos',
    role: Role.CLAIMS_PROCESSOR,
    temporaryPassword: 'TempPass123',
    ...overrides,
  });
const failedFields = async (dto: object) => (await validate(dto)).map((e) => e.property);

describe('account names', () => {
  it('accepts a normal name and trims surrounding spaces', async () => {
    const dto = account({ firstName: '  Maria ', lastName: ' Santos  ' });
    expect(await failedFields(dto)).toEqual([]);
    expect(dto.firstName).toBe('Maria');
    expect(dto.lastName).toBe('Santos');
  });

  it.each([
    ['empty', ''],
    ['only spaces', '   '],
    ['longer than 50 characters', 'x'.repeat(51)],
  ])('rejects a first name that is %s', async (_label, firstName) => {
    expect(await failedFields(account({ firstName }))).toEqual(['firstName']);
  });

  it('rejects clearing a name on edit, but allows leaving it out', async () => {
    expect(await failedFields(plainToInstance(UpdateUserDto, { lastName: ' ' }))).toEqual(['lastName']);
    expect(await failedFields(plainToInstance(UpdateUserDto, { isActive: false }))).toEqual([]);
  });
});

describe('report and activity-log dates', () => {
  it.each([ReportRangeDto, AuditLogQueryDto])('%p accepts real dates and instants', async (Dto) => {
    const dto = plainToInstance(Dto, { from: '2026-02-28', to: '2026-11-10T08:00:00.000Z' });
    expect(await failedFields(dto)).toEqual([]);
  });

  it.each([ReportRangeDto, AuditLogQueryDto])('%p rejects impossible calendar dates', async (Dto) => {
    const dto = plainToInstance(Dto, { from: '2026-02-30', to: '2026-13-01' });
    expect((await failedFields(dto)).sort()).toEqual(['from', 'to']);
  });
});

describe('escapeLike', () => {
  it('makes LIKE wildcards and the escape character literal', () => {
    expect(escapeLike('100%_off\\now')).toBe('100\\%\\_off\\\\now');
    expect(escapeLike('Ana Reyes')).toBe('Ana Reyes');
  });
});

describe('activity-log date bounds', () => {
  it('a date-only "to" covers the whole day, so from=to=day is that full day', () => {
    expect(startOfDateBound('2026-11-09').toISOString()).toBe('2026-11-09T00:00:00.000Z');
    expect(endOfDateBound('2026-11-09').toISOString()).toBe('2026-11-09T23:59:59.999Z');
  });

  it('uses full instants as given', () => {
    expect(endOfDateBound('2026-11-09T05:00:00.000Z').toISOString()).toBe('2026-11-09T05:00:00.000Z');
    expect(startOfDateBound('2026-11-09T05:00:00+08:00').toISOString()).toBe('2026-11-08T21:00:00.000Z');
  });
});
