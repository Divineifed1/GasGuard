declare module '@nestjs/common' {
  export function Injectable(): ClassDecorator;
  export function Module(options: any): ClassDecorator;
  export function Controller(path?: string): ClassDecorator;
  export function Post(path?: string): MethodDecorator;
  export function Get(path?: string): MethodDecorator;
  export function Body(): ParameterDecorator;
  export function Param(param?: string): ParameterDecorator;
  export function HttpCode(code: number): MethodDecorator;
  export class HttpException extends Error {
    constructor(response: any, status: number);
  }
  export class BadRequestException extends HttpException {
    constructor(message?: string);
  }
  export class Logger {
    constructor(context?: string);
    log(message: string, context?: string): void;
    error(message: string, trace?: string, context?: string): void;
    warn(message: string, context?: string): void;
    debug(message: string, context?: string): void;
  }
  export const HttpStatus: {
    OK: number;
    CREATED: number;
    BAD_REQUEST: number;
    NOT_FOUND: number;
    INTERNAL_SERVER_ERROR: number;
    [key: string]: number;
  };
}
