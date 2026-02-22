declare module 'typeorm' {
  export class Repository<T> {
    create(plainObject?: any): T;
    save(entity: any): Promise<any>;
    find(options?: any): Promise<any[]>;
    delete(criteria: any): Promise<any>;
  }
  export function Entity(name?: string): ClassDecorator;
  export function PrimaryGeneratedColumn(type?: 'uuid' | 'increment'): PropertyDecorator;
  export function Column(options?: any): PropertyDecorator;
  export function CreateDateColumn(options?: any): PropertyDecorator;
  export function Index(columns: string[]): ClassDecorator;
  export interface DeleteResult {
    raw: any;
    affected?: number;
  }
}
