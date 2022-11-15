import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class ACLGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const { auth } = context.switchToHttp().getRequest();
    return auth.user && auth.user !== process.env.BLOCKNATIVE_USER;
  }
}
