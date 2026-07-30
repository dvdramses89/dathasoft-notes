import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

// Tipo exacto que espera signOptions.expiresIn (number | StringValue de 'ms')
type ExpiresIn = NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

// Defaults del rate limiting, si el .env no los define.
// Login: 5 intentos por minuto. Registro: 3 altas por hora.
const LOGIN_LIMIT = 5;
const LOGIN_TTL_SEGUNDOS = 60;
const REGISTER_LIMIT = 3;
const REGISTER_TTL_SEGUNDOS = 3600;

const MENSAJE_LIMITE = 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '1d') as ExpiresIn,
        },
      }),
    }),
    // Rate limiting con dos contadores independientes. El guard no es global:
    // se aplica con @UseGuards en login y register, y cada uno descarta el
    // contador del otro con @SkipThrottle (ver auth.controller.ts).
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            name: 'login',
            limit: config.get<number>('THROTTLE_LOGIN_LIMIT') ?? LOGIN_LIMIT,
            // El .env lo declara en segundos; throttler espera milisegundos
            ttl: (config.get<number>('THROTTLE_LOGIN_TTL') ?? LOGIN_TTL_SEGUNDOS) * 1000,
          },
          {
            name: 'register',
            limit: config.get<number>('THROTTLE_REGISTER_LIMIT') ?? REGISTER_LIMIT,
            ttl: (config.get<number>('THROTTLE_REGISTER_TTL') ?? REGISTER_TTL_SEGUNDOS) * 1000,
          },
        ],
        errorMessage: MENSAJE_LIMITE,
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
