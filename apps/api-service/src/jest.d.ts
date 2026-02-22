declare global {
  namespace jest {
    interface Matchers<R> {
      toBeCloseTo(expected: number, precision?: number): R;
      toBeLessThan(expected: number): R;
      toBeLessThanOrEqual(expected: number): R;
      toBeGreaterThan(expected: number): R;
      toBeGreaterThanOrEqual(expected: number): R;
      toBe(expected: any): R;
      toEqual(expected: any): R;
      toHaveProperty(propertyName: string, value?: any): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledWith(...args: any[]): R;
    }
    interface Mock<T = any, U extends any[] = any[]> {
      (...args: U): T;
    }
    interface SpyInstance<T = any, U extends any[] = any[]> extends Mock<T, U> {}
  }

  function describe(name: string, fn: () => void): void;
  function it(name: string, fn: () => void | Promise<void>): void;
  function beforeEach(fn: () => void | Promise<void>): void;
  function afterEach(fn: () => void | Promise<void>): void;
  function before(fn: () => void | Promise<void>): void;
  function after(fn: () => void | Promise<void>): void;

  const jest: {
    fn<T extends (...args: any[]) => any>(implementation?: T): jest.Mock<ReturnType<T>, Parameters<T>>;
    spyOn<T, P extends PropertyKey>(
      object: T,
      method: P,
      accessType?: 'get' | 'set'
    ): jest.SpyInstance<any, any>;
    useFakeTimers(): void;
    useRealTimers(): void;
  };
}

export {};
