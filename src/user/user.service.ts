import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, FindOptionsWhere, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UserEntity, UserRole } from './entities/user.entity';
import { DistributorEntity } from '../distributor/entities/distributor.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(DistributorEntity)
    private distributorRepository: Repository<DistributorEntity>,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
  ) {}

  async create(createUserDto: CreateUserDto, skipLimitCheck: boolean = false) {
    const {
      email,
      phoneNo,
      password,
      role,
      gstin,
      businessName,
      tenantId,
      ...userData
    } = createUserDto;

    // Check if user already exists by phone
    const existingUserByPhone = await this.userRepository.findOne({
      where: { phoneNo },
    });

    if (existingUserByPhone) {
      throw new ConflictException('User with this phone already exists');
    }

    // Check if user already exists by email (only if email is provided)
    if (email) {
      const existingUserByEmail = await this.userRepository.findOne({
        where: { email },
      });

      if (existingUserByEmail) {
        throw new ConflictException('User with this email already exists');
      }
    }

    // Validate tenant requirement
    if ((role === 'super_admin' || role === 'distributor') && !tenantId) {
      throw new BadRequestException(
        'Tenant ID is required for super_admin and distributor roles',
      );
    }

    // master_admin should not have a tenant
    if (role === 'master_admin' && tenantId) {
      throw new BadRequestException('master_admin cannot belong to a tenant');
    }

    // Check subscription limit for users (skip for master_admin creation or internal calls)
    if (tenantId && !skipLimitCheck) {
      const limitCheck = await this.subscriptionService.canCreateUser(tenantId);
      if (!limitCheck.allowed) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'User Limit Exceeded',
          message: limitCheck.message,
          limit: limitCheck.limit,
          current: limitCheck.current,
          remaining: limitCheck.remaining,
          upgradeRequired: true,
        });
      }
    }

    // Validate distributor fields - only businessName is required
    if (role === 'distributor' && !businessName) {
      throw new BadRequestException(
        'Business Name is required for distributor role',
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = this.userRepository.create({
      ...userData,
      email,
      phoneNo,
      password: hashedPassword,
      role,
      tenantId: tenantId || null,
    });

    const savedUser = await this.userRepository.save(user);

    // Create distributor entry if role is distributor
    if (role === 'distributor') {
      const distributor = this.distributorRepository.create({
        userId: savedUser.id,
        gstin,
        businessName,
      });
      await this.distributorRepository.save(distributor);
    }

    // Increment usage count for users
    if (tenantId) {
      await this.subscriptionService.incrementUsage(tenantId, 'usersCount');
    }

    // Remove password from response
    const { password: _, ...result } = savedUser;
    return result;
  }

  async findAll(tenantId?: number, role?: UserRole) {
    const whereCondition: FindOptionsWhere<UserEntity> = {};

    // Filter by tenant
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    if (role) {
      whereCondition.role = role;
    }

    const users = await this.userRepository.find({
      where: whereCondition,
      relations: ['distributor', 'tenant'],
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNo: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return users;
  }

  async findOne(id: number, tenantId?: number) {
    const whereCondition: FindOptionsWhere<UserEntity> = { id };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const user = await this.userRepository.findOne({
      where: whereCondition,
      relations: ['distributor', 'tenant'],
      select: {
        id: true,
        tenantId: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNo: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto, tenantId?: number) {
    const whereCondition: FindOptionsWhere<UserEntity> = { id };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const user = await this.userRepository.findOne({
      where: whereCondition,
      relations: ['distributor'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { password, gstin, businessName, ...updateData } = updateUserDto;

    // Hash password if provided
    if (password) {
      updateData['password'] = await bcrypt.hash(password, 10);
    }

    // Update user
    Object.assign(user, updateData);
    await this.userRepository.save(user);

    // Update distributor if fields provided and user is distributor
    if (user.role === 'distributor' && (gstin || businessName)) {
      let distributor = await this.distributorRepository.findOne({
        where: { userId: id },
      });

      if (!distributor) {
        // Create distributor if doesn't exist
        distributor = this.distributorRepository.create({
          userId: id,
          gstin: gstin || '',
          businessName: businessName || '',
        });
      } else {
        if (gstin) distributor.gstin = gstin;
        if (businessName) distributor.businessName = businessName;
      }

      await this.distributorRepository.save(distributor);
    }

    return this.findOne(id);
  }

  async remove(id: number, tenantId?: number) {
    const whereCondition: FindOptionsWhere<UserEntity> = { id };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const user = await this.userRepository.findOne({
      where: whereCondition,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const userTenantId = user.tenantId;

    // Delete distributor entry if exists
    if (user.role === 'distributor') {
      await this.distributorRepository.delete({ userId: id });
    }

    await this.userRepository.remove(user);

    // Decrement usage count for users
    if (userTenantId) {
      await this.subscriptionService.decrementUsage(userTenantId, 'usersCount');
    }

    return { message: 'User deleted successfully' };
  }

  async findByMobile(phoneNo: string) {
    return await this.userRepository.findOne({
      where: { phoneNo },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phoneNo: true,
        role: true,
      },
    });
  }
}
