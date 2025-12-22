import {
  Injectable,
  NotFoundException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { TenantEntity } from './entities/tenant.entity';
import { OrderEntity } from '../orders/entities/order.entity';
import { UserEntity } from '../user/entities/user.entity';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { PlanEntity, PlanType } from '../subscription/entities/plan.entity';

@Injectable()
export class TenantService {
  constructor(
    @InjectRepository(TenantEntity)
    private tenantRepository: Repository<TenantEntity>,
    @InjectRepository(OrderEntity)
    private orderRepository: Repository<OrderEntity>,
    @InjectRepository(UserEntity)
    private userRepository: Repository<UserEntity>,
    @InjectRepository(PlanEntity)
    private planRepository: Repository<PlanEntity>,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
  ) {}

  async create(
    createTenantDto: CreateTenantDto,
  ): Promise<
    TenantEntity & { adminUser?: { email: string; password: string } }
  > {
    const {
      adminFirstName,
      adminLastName,
      adminEmail,
      adminPhoneNo,
      adminPassword,
      ...tenantData
    } = createTenantDto;

    // Check if slug already exists
    const existingTenant = await this.tenantRepository.findOne({
      where: { slug: tenantData.slug },
    });

    if (existingTenant) {
      throw new ConflictException('Tenant with this slug already exists');
    }

    // Check if admin email or phone already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ email: adminEmail }, { phoneNo: adminPhoneNo }],
    });

    if (existingUser) {
      throw new ConflictException(
        'User with this email or phone already exists',
      );
    }

    // Create tenant
    const tenant = this.tenantRepository.create(tenantData);
    const savedTenant = await this.tenantRepository.save(tenant);

    // Generate password if not provided
    const generatedPassword = adminPassword || this.generateRandomPassword();
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // Create super_admin user for this tenant
    const adminUser = this.userRepository.create({
      firstName: adminFirstName,
      lastName: adminLastName,
      email: adminEmail,
      phoneNo: adminPhoneNo,
      password: hashedPassword,
      role: 'super_admin',
      tenantId: savedTenant.id,
    });

    await this.userRepository.save(adminUser);

    // Assign free plan to the tenant
    const freePlan = await this.planRepository.findOne({
      where: { slug: 'free', planType: PlanType.BASE, isActive: true },
    });

    if (freePlan) {
      await this.subscriptionService.assignPlanToTenant({
        tenantId: savedTenant.id,
        planId: freePlan.id,
        pricePaid: 0,
        notes: 'Default free plan assigned on tenant creation',
      });
    }

    // Initialize usage tracking with 1 user (the admin)
    await this.subscriptionService.syncUsageCounts(savedTenant.id, {
      users: 1,
      ordersThisMonth: 0,
      categories: 0,
      items: 0,
    });

    // Return tenant with admin credentials (password only shown once)
    return {
      ...savedTenant,
      adminUser: {
        email: adminEmail,
        password: generatedPassword,
      },
    };
  }

  private generateRandomPassword(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  async findAll(): Promise<
    (TenantEntity & { userCount: number; orderCount: number })[]
  > {
    const tenants = await this.tenantRepository.find({
      relations: ['users'],
      order: { createdAt: 'DESC' },
    });

    // Get order counts for each tenant
    const tenantsWithCounts = await Promise.all(
      tenants.map(async (tenant) => {
        const orderCount = await this.orderRepository.count({
          where: { tenantId: tenant.id },
        });
        return {
          ...tenant,
          userCount: tenant.users?.length || 0,
          orderCount,
        };
      }),
    );

    return tenantsWithCounts;
  }

  async findOne(id: number): Promise<TenantEntity> {
    const tenant = await this.tenantRepository.findOne({
      where: { id },
      relations: ['users'],
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findBySlug(slug: string): Promise<TenantEntity> {
    const tenant = await this.tenantRepository.findOne({
      where: { slug },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async update(
    id: number,
    updateTenantDto: UpdateTenantDto,
  ): Promise<TenantEntity> {
    const tenant = await this.findOne(id);

    // Check if slug is being changed and if it already exists
    if (updateTenantDto.slug && updateTenantDto.slug !== tenant.slug) {
      const existingTenant = await this.tenantRepository.findOne({
        where: { slug: updateTenantDto.slug },
      });

      if (existingTenant) {
        throw new ConflictException('Tenant with this slug already exists');
      }
    }

    Object.assign(tenant, updateTenantDto);
    return await this.tenantRepository.save(tenant);
  }

  async remove(id: number): Promise<{ message: string }> {
    const tenant = await this.findOne(id);

    // Check if tenant has users
    if (tenant.users && tenant.users.length > 0) {
      throw new ConflictException(
        'Cannot delete tenant with existing users. Remove users first.',
      );
    }

    await this.tenantRepository.remove(tenant);
    return { message: 'Tenant deleted successfully' };
  }

  async findActiveTenants(): Promise<TenantEntity[]> {
    return await this.tenantRepository.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    });
  }
}
