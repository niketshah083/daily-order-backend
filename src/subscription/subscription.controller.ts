import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { SubscriptionService } from './subscription.service';
import { PlanType } from './entities/plan.entity';
import { responseMessage } from '../common/utilities/responseMessages.utils';
import {
  CreatePlanDto,
  UpdatePlanDto,
  AssignPlanDto,
  UpdateTenantPlanDto,
  UpgradePlanDto,
  PurchaseAddonDto,
} from './dto';

@ApiTags('subscription')
@Controller('subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ==================== PLAN MANAGEMENT (master_admin only) ====================

  @Get('plans')
  @ApiOperation({ summary: 'Get all plans' })
  @ApiResponse({ status: 200, description: 'Plans retrieved successfully' })
  async getAllPlans(@Query('type') type?: string) {
    const planType =
      type === 'addon'
        ? PlanType.ADDON
        : type === 'base'
          ? PlanType.BASE
          : undefined;
    const data = await this.subscriptionService.findAllPlans(planType);
    return { data, message: responseMessage.fetchMessage('Plans') };
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get plan by ID' })
  @ApiResponse({ status: 200, description: 'Plan retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async getPlanById(@Param('id', ParseIntPipe) id: number) {
    const data = await this.subscriptionService.findPlanById(id);
    return { data, message: responseMessage.fetchMessage('Plan') };
  }

  @Post('plans')
  @Roles('master_admin')
  @ApiOperation({ summary: 'Create a new plan (Master Admin only)' })
  @ApiResponse({ status: 201, description: 'Plan created successfully' })
  @ApiResponse({ status: 409, description: 'Plan with slug already exists' })
  async createPlan(@Body() dto: CreatePlanDto) {
    const data = await this.subscriptionService.createPlan(dto);
    return { data, message: responseMessage.addMessage('Plan') };
  }

  @Patch('plans/:id')
  @Roles('master_admin')
  @ApiOperation({ summary: 'Update plan (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Plan updated successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  async updatePlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePlanDto,
  ) {
    const data = await this.subscriptionService.updatePlan(id, dto);
    return { data, message: responseMessage.updateMessage('Plan') };
  }

  @Delete('plans/:id')
  @Roles('master_admin')
  @ApiOperation({ summary: 'Delete plan (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Plan deleted successfully' })
  @ApiResponse({ status: 404, description: 'Plan not found' })
  @ApiResponse({ status: 400, description: 'Plan is in use' })
  async deletePlan(@Param('id', ParseIntPipe) id: number) {
    await this.subscriptionService.deletePlan(id);
    return { data: null, message: responseMessage.deleteMessage('Plan') };
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  @Post('assign')
  @Roles('master_admin')
  @ApiOperation({ summary: 'Assign plan to tenant (Master Admin only)' })
  @ApiResponse({ status: 201, description: 'Plan assigned successfully' })
  async assignPlanToTenant(@Body() dto: AssignPlanDto) {
    const data = await this.subscriptionService.assignPlanToTenant(dto);
    return { data, message: 'Plan assigned to tenant successfully' };
  }

  @Post('upgrade')
  @Roles('master_admin', 'super_admin')
  @ApiOperation({ summary: 'Upgrade tenant plan' })
  @ApiResponse({ status: 200, description: 'Plan upgraded successfully' })
  async upgradePlan(
    @Body() dto: UpgradePlanDto,
    @TenantId() tenantId: number,
    @Req() req: any,
  ) {
    // master_admin can upgrade any tenant, super_admin can only upgrade their own
    if (req.user?.role !== 'master_admin') {
      dto.tenantId = tenantId;
    }
    const data = await this.subscriptionService.upgradePlan(dto);
    return { data, message: 'Plan upgraded successfully' };
  }

  @Post('addon/purchase')
  @Roles('master_admin', 'super_admin')
  @ApiOperation({ summary: 'Purchase addon for tenant' })
  @ApiResponse({ status: 201, description: 'Addon purchased successfully' })
  async purchaseAddon(
    @Body() dto: PurchaseAddonDto,
    @TenantId() tenantId: number,
    @Req() req: any,
  ) {
    // master_admin can purchase for any tenant, super_admin can only purchase for their own
    if (req.user?.role !== 'master_admin') {
      dto.tenantId = tenantId;
    }
    const data = await this.subscriptionService.purchaseAddon(dto);
    return { data, message: 'Addon purchased successfully' };
  }

  @Patch('tenant-plan/:id')
  @Roles('master_admin')
  @ApiOperation({ summary: 'Update tenant plan (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant plan updated successfully' })
  async updateTenantPlan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTenantPlanDto,
  ) {
    const data = await this.subscriptionService.updateTenantPlan(id, dto);
    return { data, message: 'Tenant plan updated successfully' };
  }

  @Post('cancel/:id')
  @Roles('master_admin', 'super_admin')
  @ApiOperation({ summary: 'Cancel subscription' })
  @ApiResponse({ status: 200, description: 'Subscription cancelled' })
  async cancelSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason?: string,
  ) {
    const data = await this.subscriptionService.cancelSubscription(id, reason);
    return { data, message: 'Subscription cancelled successfully' };
  }

  // ==================== TENANT SUBSCRIPTION INFO ====================

  @Get('current')
  @Roles('super_admin', 'distributor')
  @ApiOperation({ summary: 'Get current subscription status' })
  @ApiResponse({ status: 200, description: 'Subscription status retrieved' })
  async getCurrentSubscription(@TenantId() tenantId: number) {
    const data = await this.subscriptionService.getSubscriptionStatus(tenantId);
    return { data, message: responseMessage.fetchMessage('Subscription') };
  }

  @Get('tenant/:tenantId')
  @Roles('master_admin')
  @ApiOperation({ summary: 'Get tenant subscription (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant subscription retrieved' })
  async getTenantSubscription(
    @Param('tenantId', ParseIntPipe) tenantId: number,
  ) {
    const data = await this.subscriptionService.getSubscriptionStatus(tenantId);
    return {
      data,
      message: responseMessage.fetchMessage('Tenant subscription'),
    };
  }

  @Get('tenant/:tenantId/history')
  @Roles('master_admin')
  @ApiOperation({
    summary: 'Get tenant subscription history (Master Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Subscription history retrieved' })
  async getTenantSubscriptionHistory(
    @Param('tenantId', ParseIntPipe) tenantId: number,
  ) {
    const data =
      await this.subscriptionService.getTenantSubscriptionHistory(tenantId);
    return {
      data,
      message: responseMessage.fetchMessage('Subscription history'),
    };
  }

  @Get('history')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Get my subscription history' })
  @ApiResponse({ status: 200, description: 'Subscription history retrieved' })
  async getMySubscriptionHistory(@TenantId() tenantId: number) {
    const data =
      await this.subscriptionService.getTenantSubscriptionHistory(tenantId);
    return {
      data,
      message: responseMessage.fetchMessage('Subscription history'),
    };
  }

  @Get('active-plans')
  @Roles('super_admin', 'distributor')
  @ApiOperation({ summary: 'Get my active plans' })
  @ApiResponse({ status: 200, description: 'Active plans retrieved' })
  async getMyActivePlans(@TenantId() tenantId: number) {
    const data = await this.subscriptionService.getTenantActivePlans(tenantId);
    return { data, message: responseMessage.fetchMessage('Active plans') };
  }

  // ==================== USAGE & LIMITS ====================

  @Get('usage')
  @Roles('super_admin', 'distributor')
  @ApiOperation({ summary: 'Get current usage' })
  @ApiResponse({ status: 200, description: 'Usage retrieved' })
  async getCurrentUsage(@TenantId() tenantId: number) {
    const data = await this.subscriptionService.getCurrentUsage(tenantId);
    return { data, message: responseMessage.fetchMessage('Usage') };
  }

  @Get('limits')
  @Roles('super_admin', 'distributor')
  @ApiOperation({ summary: 'Get tenant limits' })
  @ApiResponse({ status: 200, description: 'Limits retrieved' })
  async getTenantLimits(@TenantId() tenantId: number) {
    const data = await this.subscriptionService.getTenantLimits(tenantId);
    return { data, message: responseMessage.fetchMessage('Limits') };
  }

  @Get('features')
  @Roles('super_admin', 'distributor')
  @ApiOperation({ summary: 'Get tenant features' })
  @ApiResponse({ status: 200, description: 'Features retrieved' })
  async getTenantFeatures(@TenantId() tenantId: number) {
    const data = await this.subscriptionService.getTenantFeatures(tenantId);
    return { data, message: responseMessage.fetchMessage('Features') };
  }

  @Get('check-limit/:type')
  @Roles('super_admin', 'distributor')
  @ApiOperation({ summary: 'Check specific limit' })
  @ApiResponse({ status: 200, description: 'Limit check result' })
  async checkLimit(
    @TenantId() tenantId: number,
    @Param('type') type: 'users' | 'ordersPerMonth' | 'categories' | 'items',
  ) {
    const data = await this.subscriptionService.checkLimit(tenantId, type);
    return { data, message: 'Limit checked successfully' };
  }

  // ==================== ADMIN OPERATIONS ====================

  @Get('expiring')
  @Roles('master_admin')
  @ApiOperation({ summary: 'Get expiring subscriptions (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Expiring subscriptions retrieved' })
  async getExpiringSubscriptions(@Query('days') days?: string) {
    const daysAhead = days ? parseInt(days, 10) : 7;
    const data =
      await this.subscriptionService.getExpiringSubscriptions(daysAhead);
    return {
      data,
      message: responseMessage.fetchMessage('Expiring subscriptions'),
    };
  }

  @Post('process-expired')
  @Roles('master_admin')
  @ApiOperation({
    summary: 'Process expired subscriptions (Master Admin only)',
  })
  @ApiResponse({ status: 200, description: 'Expired subscriptions processed' })
  async processExpiredSubscriptions() {
    const count = await this.subscriptionService.processExpiredSubscriptions();
    return {
      data: { processedCount: count },
      message: `Processed ${count} expired subscriptions`,
    };
  }

  @Post('seed-plans')
  @Roles('master_admin')
  @ApiOperation({ summary: 'Seed default plans (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Default plans seeded' })
  async seedDefaultPlans() {
    await this.subscriptionService.seedDefaultPlans();
    return { data: null, message: 'Default plans seeded successfully' };
  }
}
