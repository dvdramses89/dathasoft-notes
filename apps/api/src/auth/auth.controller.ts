import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService, type PublicUser } from './auth.service';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // POST /api/auth/register
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto): Promise<PublicUser> {
    return this.auth.register(dto);
  }
}
