import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface QueryOptions {
  where?: Record<string, any>;
  select?: Record<string, boolean>;
  include?: Record<string, any>;
  orderBy?: Record<string, 'asc' | 'desc'>;
  skip?: number;
  take?: number;
}

class Repository {
  constructor(
    private readonly table: any[],
    private readonly database: DatabaseService,
    private readonly name: string,
  ) {}

  async findUnique(options: QueryOptions = {}) {
    const record = this.table.find((item) => this.matches(item, options.where));
    return record ? this.project(record, options) : null;
  }

  async findMany(options: QueryOptions = {}) {
    let records = this.table.filter((item) => this.matches(item, options.where));
    for (const [field, direction] of Object.entries(options.orderBy ?? {})) {
      records = [...records].sort((left, right) => {
        const a = left[field] instanceof Date ? left[field].getTime() : left[field];
        const b = right[field] instanceof Date ? right[field].getTime() : right[field];
        return (a < b ? -1 : a > b ? 1 : 0) * (direction === 'asc' ? 1 : -1);
      });
    }
    if (options.skip) records = records.slice(options.skip);
    if (options.take !== undefined) records = records.slice(0, options.take);
    return records.map((record) => this.project(record, options));
  }

  async create(options: { data: Record<string, any>; select?: Record<string, boolean> }) {
    const record = {
      id: randomUUID(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...options.data,
    };
    this.table.push(record);
    return this.project(record, { select: options.select });
  }

  async update(options: { where?: Record<string, any>; data: Record<string, any>; select?: Record<string, boolean> }) {
    const record = this.table.find((item) => this.matches(item, options.where));
    if (!record) throw new Error(`${this.name} record not found`);
    Object.assign(record, options.data, { updatedAt: new Date() });
    return this.project(record, { select: options.select });
  }

  private matches(record: any, where?: Record<string, any>): boolean {
    if (!where) return true;
    return Object.entries(where).every(([field, condition]) => {
      if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
        if ('some' in condition) {
          return this.database.tables.patientAssignment.some(
            (item) => item.patientId === record.id && this.matches(item, condition.some),
          );
        }
        if ('gte' in condition) return record[field] >= condition.gte;
      }
      return record[field] === condition;
    });
  }

  private project(record: any, options: QueryOptions) {
    const selected = options.select
      ? Object.fromEntries(Object.keys(options.select).filter((key) => options.select![key]).map((key) => [key, record[key]]))
      : { ...record };
    if (!options.include) return selected;
    for (const [relation, relationOptions] of Object.entries(options.include)) {
      selected[relation] = this.database.related(this.name, record, relation, relationOptions);
    }
    return selected;
  }
}

@Injectable()
export class DatabaseService {
  readonly tables: Record<string, any[]> = {
    user: [],
    patient: [],
    patientAssignment: [],
    physicianOrder: [],
    physicianNote: [],
    courseInWard: [],
    claim: [],
    auditLog: [],
  };

  readonly user = new Repository(this.tables.user, this, 'User');
  readonly patient = new Repository(this.tables.patient, this, 'Patient');
  readonly patientAssignment = new Repository(this.tables.patientAssignment, this, 'PatientAssignment');
  readonly physicianOrder = new Repository(this.tables.physicianOrder, this, 'PhysicianOrder');
  readonly physicianNote = new Repository(this.tables.physicianNote, this, 'PhysicianNote');
  readonly courseInWard = new Repository(this.tables.courseInWard, this, 'CourseInWard');
  readonly claim = new Repository(this.tables.claim, this, 'Claim');
  readonly auditLog = new Repository(this.tables.auditLog, this, 'AuditLog');

  related(model: string, record: any, relation: string, options: any) {
    const relationMap: Record<string, [string, string]> = {
      'Patient:orders': ['physicianOrder', 'patientId'],
      'Patient:notes': ['physicianNote', 'patientId'],
      'Patient:coursesInWard': ['courseInWard', 'patientId'],
      'CourseInWard:patient': ['patient', 'id'],
      'Claim:patient': ['patient', 'id'],
      'Claim:courseInWard': ['courseInWard', 'id'],
      'PhysicianOrder:orderingPhysician': ['user', 'id'],
      'PhysicianOrder:enteredBy': ['user', 'id'],
      'PhysicianNote:patient': ['patient', 'id'],
      'AuditLog:user': ['user', 'id'],
    };
    const [target, key] = relationMap[`${model}:${relation}`] ?? [];
    if (!target) return null;
    if (target === 'patient' || target === 'user') {
      const foreignKey = relation === 'patient' ? 'patientId' : relation === 'user' ? 'userId' : `${relation}Id`;
      const item = this.tables[target].find((entry) => entry.id === record[foreignKey]);
      return item ? this.selectRelation(item, options) : null;
    }
    const matches = this.tables[target].filter((entry) => entry[key] === record.id);
    return matches.map((entry) => this.selectRelation(entry, options));
  }

  private selectRelation(record: any, options: any) {
    const result = options?.select
      ? Object.fromEntries(Object.keys(options.select).filter((key) => options.select[key]).map((key) => [key, record[key]]))
      : { ...record };
    return result;
  }

  async ordersOverTime() {
    const counts = new Map<string, number>();
    for (const order of this.tables.physicianOrder) {
      const period = order.orderDate.toISOString().slice(0, 10);
      counts.set(period, (counts.get(period) ?? 0) + 1);
    }
    return [...counts.entries()].sort(([a], [b]) => b.localeCompare(a)).slice(0, 100).map(([period, count]) => ({ period, count }));
  }
}
