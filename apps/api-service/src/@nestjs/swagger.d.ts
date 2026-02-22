declare module '@nestjs/swagger' {
  export function ApiTags(...tags: string[]): ClassDecorator;
  export function ApiOperation(options: any): MethodDecorator;
  export function ApiResponse(options: any): MethodDecorator;
  export function ApiProperty(options?: any): PropertyDecorator;
}
