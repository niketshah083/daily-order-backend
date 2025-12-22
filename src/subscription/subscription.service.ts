import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import {
  PlanEntity,
  PlanType,
  BillingCycle,
  PlanLimits,
  PlanFeatures,
} from './entities/plan.entity';
import {
  TenantPlanEntity,
  SubscriptionStatus,
} from './entities/tenant-plan.entity';
import { UsageEntity } from './entities/usage.entity';
import {
  CreatePlanDto,
  UpdatePlanDto,
  AssignPlanDto,
  UpdateTenantPlanDto,
  UpgradePlanDto,
  PurchaseAddonDto,
} from './dto';

export interface TenantLimits {
  users: number;
  ordersPerMonth: number;
  categories: number;
  items: number;
}

export interface TenantUsage {
  users: number;
  ordersThisMonth: number;
  categories: number;
  items: number;
}

export interface LimitCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
  remaining: number;
  message?: string;
}

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(PlanEntity)
    private planRepo: Repository<PlanEntity>,
    @InjectRepository(TenantPlanEntity)
    private tenantPlanRepo: Repository<TenantPlanEntity>,
    @InjectRepository(UsageEntity)
    private usageRepo: Repository<UsageEntity>,
  ) {}

  // ==================== PLAN CRUD ====================

  async createPlan(dto: CreatePlanDto): Promise<PlanEntity> {
    const existing = await this.planRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(
        `Plan with slug "${dto.slug}" already exists`,
      );
    }

    const plan = this.planRepo.create(dto);
    return this.planRepo.save(plan);
  }

  async findAllPlans(planType?: PlanType): Promise<PlanEntity[]> {
    const where: any = { isActive: true };
    if (planType) {
      where.planType = planType;
    }
    return this.planRepo.find({
      where,
      order: { sortOrder: 'ASC', price: 'ASC' },
    });
  }

  async findPlanById(id: number): Promise<PlanEntity> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }
    return plan;
  }

  async updatePlan(id: number, dto: UpdatePlanDto): Promise<PlanEntity> {
    const plan = await this.findPlanById(id);

    if (dto.slug && dto.slug !== plan.slug) {
      const existing = await this.planRepo.findOne({
        where: { slug: dto.slug },
      });
      if (existing) {
        throw new ConflictException(
          `Plan with slug "${dto.slug}" already exists`,
        );
      }
    }

    Object.assign(plan, dto);
    return this.planRepo.save(plan);
  }

  async deletePlan(id: number): Promise<void> {
    const plan = await this.findPlanById(id);

    // Check if any tenant is using this plan
    const activeSubscriptions = await this.tenantPlanRepo.count({
      where: { planId: id, status: SubscriptionStatus.ACTIVE },
    });

    if (activeSubscriptions > 0) {
      throw new BadRequestException(
        `Cannot delete plan. ${activeSubscriptions} tenant(s) are currently using this plan.`,
      );
    }

    await this.planRepo.remove(plan);
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  async assignPlanToTenant(dto: AssignPlanDto): Promise<TenantPlanEntity> {
    const plan = await this.findPlanById(dto.planId);

    // For base plans, check if tenant already has an active base plan
    if (plan.planType === PlanType.BASE) {
      const existingBasePlan = await this.getActiveTenantBasePlan(dto.tenantId);
      if (existingBasePlan) {
        throw new BadRequestException(
          'Tenant already has an active base plan. Use upgrade instead.',
        );
      }
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : new Date();
    const endDate = dto.endDate
      ? new Date(dto.endDate)
      : this.calculateEndDate(startDate, plan.billingCycle);

    const tenantPlan = this.tenantPlanRepo.create({
      tenantId: dto.tenantId,
      planId: dto.planId,
      quantity: dto.quantity || 1,
      startDate,
      endDate,
      autoRenew: dto.autoRenew ?? true,
      pricePaid: dto.pricePaid ?? plan.price * (dto.quantity || 1),
      paymentMethod: dto.paymentMethod,
      transactionId: dto.transactionId,
      notes: dto.notes,
      status: SubscriptionStatus.ACTIVE,
    });

    return this.tenantPlanRepo.save(tenantPlan);
  }

  async upgradePlan(dto: UpgradePlanDto): Promise<TenantPlanEntity> {
    const newPlan = await this.findPlanById(dto.newPlanId);

    if (newPlan.planType !== PlanType.BASE) {
      throw new BadRequestException('Can only upgrade to a base plan');
    }

    // Cancel current base plan
    const currentPlan = await this.getActiveTenantBasePlan(dto.tenantId);
    if (currentPlan) {
      currentPlan.status = SubscriptionStatus.CANCELLED;
      currentPlan.cancelledAt = new Date();
      currentPlan.cancellationReason = 'Upgraded to new plan';
      await this.tenantPlanRepo.save(currentPlan);
    }

    // Create new subscription
    return this.assignPlanToTenant({
      tenantId: dto.tenantId,
      planId: dto.newPlanId,
      paymentMethod: dto.paymentMethod,
      transactionId: dto.transactionId,
    });
  }

  async purchaseAddon(dto: PurchaseAddonDto): Promise<TenantPlanEntity> {
    const addon = await this.findPlanById(dto.addonPlanId);

    if (addon.planType !== PlanType.ADDON) {
      throw new BadRequestException('Selected plan is not an addon');
    }

    // Check if tenant has an active base plan
    const basePlan = await this.getActiveTenantBasePlan(dto.tenantId);
    if (!basePlan) {
      throw new BadRequestException(
        'Tenant must have an active base plan to purchase addons',
      );
    }

    // Align addon end date with base plan
    return this.assignPlanToTenant({
      tenantId: dto.tenantId,
      planId: dto.addonPlanId,
      quantity: dto.quantity || 1,
      endDate: basePlan.endDate.toISOString(),
      paymentMethod: dto.paymentMethod,
      transactionId: dto.transactionId,
    });
  }

  async cancelSubscription(
    tenantPlanId: number,
    reason?: string,
  ): Promise<TenantPlanEntity> {
    const tenantPlan = await this.tenantPlanRepo.findOne({
      where: { id: tenantPlanId },
    });

    if (!tenantPlan) {
      throw new NotFoundException('Subscription not found');
    }

    tenantPlan.status = SubscriptionStatus.CANCELLED;
    tenantPlan.cancelledAt = new Date();
    tenantPlan.cancellationReason = reason;
    tenantPlan.autoRenew = false;

    return this.tenantPlanRepo.save(tenantPlan);
  }

  async updateTenantPlan(
    id: number,
    dto: UpdateTenantPlanDto,
  ): Promise<TenantPlanEntity> {
    const tenantPlan = await this.tenantPlanRepo.findOne({ where: { id } });

    if (!tenantPlan) {
      throw new NotFoundException('Subscription not found');
    }

    if (dto.status === SubscriptionStatus.CANCELLED) {
      tenantPlan.cancelledAt = new Date();
      tenantPlan.cancellationReason = dto.cancellationReason;
    }

    Object.assign(tenantPlan, dto);
    return this.tenantPlanRepo.save(tenantPlan);
  }

  // ==================== TENANT PLAN QUERIES ====================

  async getActiveTenantBasePlan(
    tenantId: number,
  ): Promise<TenantPlanEntity | null> {
    const today = new Date();

    return this.tenantPlanRepo
      .findOne({
        where: {
          tenantId,
          status: SubscriptionStatus.ACTIVE,
          startDate: LessThanOrEqual(today),
          endDate: MoreThanOrEqual(today),
        },
        relations: ['plan'],
        order: { createdAt: 'DESC' },
      })
      .then((tp) => {
        if (tp && tp.plan.planType === PlanType.BASE) return tp;
        return null;
      });
  }

  async getTenantActivePlans(tenantId: number): Promise<TenantPlanEntity[]> {
    const today = new Date();

    return this.tenantPlanRepo.find({
      where: {
        tenantId,
        status: SubscriptionStatus.ACTIVE,
        startDate: LessThanOrEqual(today),
        endDate: MoreThanOrEqual(today),
      },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  async getTenantSubscriptionHistory(
    tenantId: number,
  ): Promise<TenantPlanEntity[]> {
    return this.tenantPlanRepo.find({
      where: { tenantId },
      relations: ['plan'],
      order: { createdAt: 'DESC' },
    });
  }

  // ==================== LIMIT CALCULATIONS ====================

  async getTenantLimits(tenantId: number): Promise<TenantLimits> {
    const activePlans = await this.getTenantActivePlans(tenantId);

    // Default limits (no plan = very restricted)
    const limits: TenantLimits = {
      users: 1,
      ordersPerMonth: 10,
      categories: 3,
      items: 10,
    };

    for (const tp of activePlans) {
      const planLimits = tp.plan.limits;
      const qty = tp.quantity || 1;

      // -1 means unlimited
      if (planLimits.users !== undefined) {
        if (planLimits.users === -1) {
          limits.users = -1;
        } else if (limits.users !== -1) {
          limits.users += planLimits.users * qty;
        }
      }

      if (planLimits.ordersPerMonth !== undefined) {
        if (planLimits.ordersPerMonth === -1) {
          limits.ordersPerMonth = -1;
        } else if (limits.ordersPerMonth !== -1) {
          limits.ordersPerMonth += planLimits.ordersPerMonth * qty;
        }
      }

      if (planLimits.categories !== undefined) {
        if (planLimits.categories === -1) {
          limits.categories = -1;
        } else if (limits.categories !== -1) {
          limits.categories += planLimits.categories * qty;
        }
      }

      if (planLimits.items !== undefined) {
        if (planLimits.items === -1) {
          limits.items = -1;
        } else if (limits.items !== -1) {
          limits.items += planLimits.items * qty;
        }
      }
    }

    return limits;
  }

  async getTenantFeatures(tenantId: number): Promise<PlanFeatures> {
    const basePlan = await this.getActiveTenantBasePlan(tenantId);

    if (!basePlan || !basePlan.plan.features) {
      return {
        whatsappIntegration: false,
        analyticsBasic: false,
        analyticsFull: false,
        apiAccess: false,
        prioritySupport: false,
        customBranding: false,
        exportReports: false,
        multipleWarehouses: false,
      };
    }

    return basePlan.plan.features;
  }

  // ==================== USAGE TRACKING ====================

  async getCurrentUsage(tenantId: number): Promise<TenantUsage> {
    const currentMonth = this.getCurrentMonth();

    let usage = await this.usageRepo.findOne({
      where: { tenantId, periodMonth: currentMonth },
    });

    if (!usage) {
      usage = this.usageRepo.create({
        tenantId,
        periodMonth: currentMonth,
        usersCount: 0,
        ordersCount: 0,
        categoriesCount: 0,
        itemsCount: 0,
      });
      await this.usageRepo.save(usage);
    }

    return {
      users: usage.usersCount,
      ordersThisMonth: usage.ordersCount,
      categories: usage.categoriesCount,
      items: usage.itemsCount,
    };
  }

  async incrementUsage(
    tenantId: number,
    field: 'usersCount' | 'ordersCount' | 'categoriesCount' | 'itemsCount',
    amount: number = 1,
  ): Promise<void> {
    const currentMonth = this.getCurrentMonth();

    await this.usageRepo
      .createQueryBuilder()
      .insert()
      .into(UsageEntity)
      .values({
        tenantId,
        periodMonth: currentMonth,
        [field]: amount,
      })
      .orUpdate([field], ['tenantId', 'periodMonth'])
      .execute()
      .catch(async () => {
        // Fallback: update existing record
        const usage = await this.usageRepo.findOne({
          where: { tenantId, periodMonth: currentMonth },
        });
        if (usage) {
          usage[field] += amount;
          await this.usageRepo.save(usage);
        }
      });
  }

  async decrementUsage(
    tenantId: number,
    field: 'usersCount' | 'ordersCount' | 'categoriesCount' | 'itemsCount',
    amount: number = 1,
  ): Promise<void> {
    const currentMonth = this.getCurrentMonth();

    const usage = await this.usageRepo.findOne({
      where: { tenantId, periodMonth: currentMonth },
    });

    if (usage && usage[field] > 0) {
      usage[field] = Math.max(0, usage[field] - amount);
      await this.usageRepo.save(usage);
    }
  }

  async syncUsageCounts(
    tenantId: number,
    counts: Partial<TenantUsage>,
  ): Promise<void> {
    const currentMonth = this.getCurrentMonth();

    let usage = await this.usageRepo.findOne({
      where: { tenantId, periodMonth: currentMonth },
    });

    if (!usage) {
      usage = this.usageRepo.create({
        tenantId,
        periodMonth: currentMonth,
      });
    }

    if (counts.users !== undefined) usage.usersCount = counts.users;
    if (counts.ordersThisMonth !== undefined)
      usage.ordersCount = counts.ordersThisMonth;
    if (counts.categories !== undefined)
      usage.categoriesCount = counts.categories;
    if (counts.items !== undefined) usage.itemsCount = counts.items;

    await this.usageRepo.save(usage);
  }

  // ==================== LIMIT CHECKS ====================

  async checkLimit(
    tenantId: number,
    limitType: 'users' | 'ordersPerMonth' | 'categories' | 'items',
  ): Promise<LimitCheckResult> {
    const limits = await this.getTenantLimits(tenantId);
    const usage = await this.getCurrentUsage(tenantId);

    let limit: number;
    let current: number;

    switch (limitType) {
      case 'users':
        limit = limits.users;
        current = usage.users;
        break;
      case 'ordersPerMonth':
        limit = limits.ordersPerMonth;
        current = usage.ordersThisMonth;
        break;
      case 'categories':
        limit = limits.categories;
        current = usage.categories;
        break;
      case 'items':
        limit = limits.items;
        current = usage.items;
        break;
    }

    // -1 means unlimited
    if (limit === -1) {
      return {
        allowed: true,
        limit: -1,
        current,
        remaining: -1,
      };
    }

    const remaining = limit - current;
    const allowed = remaining > 0;

    return {
      allowed,
      limit,
      current,
      remaining: Math.max(0, remaining),
      message: allowed
        ? undefined
        : `${limitType} limit reached. Current: ${current}, Limit: ${limit}. Please upgrade your plan or purchase an addon.`,
    };
  }

  async canCreateUser(tenantId: number): Promise<LimitCheckResult> {
    return this.checkLimit(tenantId, 'users');
  }

  async canCreateOrder(tenantId: number): Promise<LimitCheckResult> {
    return this.checkLimit(tenantId, 'ordersPerMonth');
  }

  async canCreateCategory(tenantId: number): Promise<LimitCheckResult> {
    return this.checkLimit(tenantId, 'categories');
  }

  async canCreateItem(tenantId: number): Promise<LimitCheckResult> {
    return this.checkLimit(tenantId, 'items');
  }

  // ==================== SUBSCRIPTION STATUS ====================

  async isSubscriptionActive(tenantId: number): Promise<boolean> {
    const basePlan = await this.getActiveTenantBasePlan(tenantId);
    return !!basePlan;
  }

  async getSubscriptionStatus(tenantId: number): Promise<{
    hasActivePlan: boolean;
    plan: PlanEntity | null;
    daysRemaining: number;
    isExpiringSoon: boolean;
    limits: TenantLimits;
    usage: TenantUsage;
    features: PlanFeatures;
  }> {
    const basePlan = await this.getActiveTenantBasePlan(tenantId);
    const limits = await this.getTenantLimits(tenantId);
    const usage = await this.getCurrentUsage(tenantId);
    const features = await this.getTenantFeatures(tenantId);

    let daysRemaining = 0;
    if (basePlan) {
      const today = new Date();
      const endDate = new Date(basePlan.endDate);
      daysRemaining = Math.ceil(
        (endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
    }

    return {
      hasActivePlan: !!basePlan,
      plan: basePlan?.plan || null,
      daysRemaining,
      isExpiringSoon: daysRemaining > 0 && daysRemaining <= 7,
      limits,
      usage,
      features,
    };
  }

  // ==================== EXPIRATION HANDLING ====================

  async processExpiredSubscriptions(): Promise<number> {
    const today = new Date();

    const expired = await this.tenantPlanRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: LessThanOrEqual(today),
      },
    });

    for (const subscription of expired) {
      subscription.status = SubscriptionStatus.EXPIRED;
      await this.tenantPlanRepo.save(subscription);

      // TODO: Send notification to tenant about expiration
      // TODO: Handle auto-renewal if enabled
    }

    return expired.length;
  }

  async getExpiringSubscriptions(
    daysAhead: number = 7,
  ): Promise<TenantPlanEntity[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + daysAhead);

    return this.tenantPlanRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        endDate: LessThanOrEqual(futureDate),
      },
      relations: ['plan', 'tenant'],
    });
  }

  // ==================== HELPERS ====================

  private calculateEndDate(startDate: Date, billingCycle: string): Date {
    const endDate = new Date(startDate);
    if (billingCycle === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }
    return endDate;
  }

  private getCurrentMonth(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // ==================== SEEDING DEFAULT PLANS ====================

  async seedDefaultPlans(): Promise<void> {
    const existingPlans = await this.planRepo.count();
    if (existingPlans > 0) return;

    const defaultPlans: CreatePlanDto[] = [
      {
        name: 'Free',
        slug: 'free',
        description: 'Perfect for getting started',
        planType: PlanType.BASE,
        price: 0,
        billingCycle: BillingCycle.MONTHLY,
        limits: { users: 2, ordersPerMonth: 100, categories: 5, items: 50 },
        features: {
          whatsappIntegration: false,
          analyticsBasic: true,
          analyticsFull: false,
          apiAccess: false,
          prioritySupport: false,
          customBranding: false,
          exportReports: false,
        },
        sortOrder: 1,
        isActive: true,
      },
      {
        name: 'Basic',
        slug: 'basic',
        description: 'For small businesses',
        planType: PlanType.BASE,
        price: 999,
        billingCycle: BillingCycle.MONTHLY,
        limits: { users: 5, ordersPerMonth: 500, categories: 20, items: 200 },
        features: {
          whatsappIntegration: true,
          analyticsBasic: true,
          analyticsFull: false,
          apiAccess: false,
          prioritySupport: false,
          customBranding: false,
          exportReports: true,
        },
        sortOrder: 2,
        isActive: true,
      },
      {
        name: 'Pro',
        slug: 'pro',
        description: 'For growing businesses',
        planType: PlanType.BASE,
        price: 2499,
        billingCycle: BillingCycle.MONTHLY,
        limits: {
          users: 20,
          ordersPerMonth: 2000,
          categories: 100,
          items: 1000,
        },
        features: {
          whatsappIntegration: true,
          analyticsBasic: true,
          analyticsFull: true,
          apiAccess: true,
          prioritySupport: true,
          customBranding: false,
          exportReports: true,
        },
        sortOrder: 3,
        isActive: true,
        isPopular: true,
        badgeText: 'Most Popular',
      },
      {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'For large organizations',
        planType: PlanType.BASE,
        price: 4999,
        billingCycle: BillingCycle.MONTHLY,
        limits: { users: -1, ordersPerMonth: -1, categories: -1, items: -1 },
        features: {
          whatsappIntegration: true,
          analyticsBasic: true,
          analyticsFull: true,
          apiAccess: true,
          prioritySupport: true,
          customBranding: true,
          exportReports: true,
          multipleWarehouses: true,
        },
        sortOrder: 4,
        isActive: true,
        badgeText: 'Best Value',
      },
      // Add-ons
      {
        name: 'Extra 5 Users',
        slug: 'addon-users-5',
        description: 'Add 5 more users to your plan',
        planType: PlanType.ADDON,
        price: 299,
        billingCycle: BillingCycle.MONTHLY,
        limits: { users: 5 },
        sortOrder: 10,
        isActive: true,
      },
      {
        name: 'Extra 10 Users',
        slug: 'addon-users-10',
        description: 'Add 10 more users to your plan',
        planType: PlanType.ADDON,
        price: 499,
        billingCycle: BillingCycle.MONTHLY,
        limits: { users: 10 },
        sortOrder: 11,
        isActive: true,
      },
      {
        name: 'Extra 500 Orders',
        slug: 'addon-orders-500',
        description: 'Add 500 more orders per month',
        planType: PlanType.ADDON,
        price: 199,
        billingCycle: BillingCycle.MONTHLY,
        limits: { ordersPerMonth: 500 },
        sortOrder: 12,
        isActive: true,
      },
      {
        name: 'Extra 1000 Orders',
        slug: 'addon-orders-1000',
        description: 'Add 1000 more orders per month',
        planType: PlanType.ADDON,
        price: 349,
        billingCycle: BillingCycle.MONTHLY,
        limits: { ordersPerMonth: 1000 },
        sortOrder: 13,
        isActive: true,
      },
    ];

    for (const planDto of defaultPlans) {
      await this.createPlan(planDto);
    }
  }
}
