import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Protege rutas: exige un Bearer token JWT valido.
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
