import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { SubscriptionGuard } from 'src/subscription/guards/subscription.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { TenantId } from 'src/common/decorators/tenant.decorator';
import moment from 'moment';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('statistics')
  @Roles('super_admin')
  async getStatistics(@TenantId() tenantId: number) {
    const data = await this.dashboardService.getStatistics(tenantId);
    return {
      data,
      message: 'Statistics fetched successfully',
    };
  }

  @Get('recent-orders')
  @Roles('super_admin')
  async getRecentOrders(@TenantId() tenantId: number) {
    const data = await this.dashboardService.getRecentOrders(tenantId, 5);
    return {
      data,
      message: 'Recent orders fetched successfully',
    };
  }

  @Get('top-items')
  @Roles('super_admin')
  async getTopItems(@TenantId() tenantId: number) {
    const data = await this.dashboardService.getTopItems(tenantId, 5);
    return {
      data,
      message: 'Top items fetched successfully',
    };
  }

  @Get('top-distributors')
  @Roles('super_admin')
  async getTopDistributors(@TenantId() tenantId: number) {
    const data = await this.dashboardService.getTopDistributors(tenantId, 5);
    return {
      data,
      message: 'Top distributors fetched successfully',
    };
  }

  @Get('orders-by-date')
  @Roles('super_admin')
  async getOrdersByDate(@TenantId() tenantId: number) {
    const data = await this.dashboardService.getOrdersByDate(tenantId, 7);
    return {
      data,
      message: 'Orders by date fetched successfully',
    };
  }

  @Get('revenue-by-month')
  @Roles('super_admin')
  async getRevenueByMonth(@TenantId() tenantId: number) {
    const data = await this.dashboardService.getRevenueByMonth(tenantId, 6);
    return {
      data,
      message: 'Revenue by month fetched successfully',
    };
  }

  @Get('distributor-item-report')
  @Roles('super_admin')
  async getDistributorItemReport(
    @TenantId() tenantId: number,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    // Default to today if not provided
    const from = fromDate || moment().format('YYYY-MM-DD');
    const to = toDate || moment().format('YYYY-MM-DD');

    const data = await this.dashboardService.getDistributorItemReport(
      from,
      to,
      tenantId,
    );
    return {
      data,
      message: 'Distributor item report fetched successfully',
    };
  }
}
