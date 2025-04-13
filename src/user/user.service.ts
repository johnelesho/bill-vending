import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Logger } from 'winston';
import { Wallet } from 'src/wallet/entities/wallet.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email } = createUserDto;

    // Check if user with this email already exists
    const existingUser = await this.usersRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    try {
      // Create new user
      const user = this.usersRepository.create(createUserDto);

      // Create wallet for the user
      const wallet = new Wallet();
      wallet.balance = 0;
      user.wallet = wallet;

      // Save user with wallet (cascade will save wallet too)
      const savedUser = await this.usersRepository.save(user);

      this.logger.info(`User created with ID: ${savedUser.id}`);

      // Remove password from response
      const { password, ...result } = savedUser;
      return result as User;
    } catch (error) {
      this.logger.error(`Failed to create user: ${error.message}`, {
        stack: error.stack,
        email,
      });
      throw error;
    }
  }

  async findAll(): Promise<User[]> {
    try {
      const users = await this.usersRepository.find();
      return users.map((user) => {
        const { password, ...result } = user;
        return result as User;
      });
    } catch (error) {
      this.logger.error(`Failed to fetch users: ${error.message}`, {
        stack: error.stack,
      });
      throw error;
    }
  }

  async findOne(id: string): Promise<User> {
    try {
      const user = await this.usersRepository.findOne({
        where: { id },
        relations: ['wallet'],
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      const { password, ...result } = user;
      return result as User;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to fetch user: ${error.message}`, {
        stack: error.stack,
        userId: id,
      });
      throw error;
    }
  }

  async findByEmail(email: string): Promise<User> {
    try {
      const user = await this.usersRepository.findOne({
        where: { email },
        relations: ['wallet'],
      });

      if (!user) {
        throw new NotFoundException(`User with email ${email} not found`);
      }

      return user;
    } catch (error) {
      this.logger.error(`Failed to fetch user by email: ${error.message}`, {
        stack: error.stack,
        email,
      });
      throw error;
    }
  }

  async update(id: string, updateUserDto: Partial<User>): Promise<User> {
    try {
      const user = await this.findOne(id);

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      // Prevent updating email to an existing one
      if (updateUserDto.email && updateUserDto.email !== user.email) {
        const existingUser = await this.findByEmail(updateUserDto.email);
        if (existingUser) {
          throw new ConflictException('User with this email already exists');
        }
      }

      // Update user
      await this.usersRepository.update(id, updateUserDto);

      const updatedUser = await this.findOne(id);
      this.logger.info(`User updated with ID: ${id}`);

      return updatedUser;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException
      ) {
        throw error;
      }

      this.logger.error(`Failed to update user: ${error.message}`, {
        stack: error.stack,
        userId: id,
      });
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const user = await this.findOne(id);

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      await this.usersRepository.delete(id);
      this.logger.info(`User deleted with ID: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(`Failed to delete user: ${error.message}`, {
        stack: error.stack,
        userId: id,
      });
      throw error;
    }
  }
}
