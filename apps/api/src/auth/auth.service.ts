import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  constructor(private readonly users: UsersService) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('El email ya esta registrado');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.users.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    // Nunca devolvemos el hash de la contrasena
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }
}
