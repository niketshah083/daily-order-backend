import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { RecordPaymentDto, AdjustmentDto } from './dto/ledger.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../subscription/guards/subscription.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';

@ApiTags('ledger')
@Controller('ledger')
@UseGuards(JwtAuthGuard, RolesGuard, SubscriptionGuard)
@ApiBearerAuth()
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('summary')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Get Ledger Summary' })
  @ApiResponse({
    status: 200,
    description: 'Ledger summary fetched successfully',
  })
  async getSummary(@TenantId() tenantId: number) {
    const summary = await this.ledgerService.getLedgerSummary(tenantId);
    return { data: summary, message: 'Ledger summary fetched successfully' };
  }

  @Get('outstanding')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Get Outstanding Report' })
  @ApiResponse({
    status: 200,
    description: 'Outstanding report fetched successfully',
  })
  async getOutstandingReport(@TenantId() tenantId: number) {
    const report = await this.ledgerService.getOutstandingReport(tenantId);
    return { data: report, message: 'Outstanding report fetched successfully' };
  }

  @Get('statement')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Get Ledger Statement for a Distributor' })
  @ApiResponse({
    status: 200,
    description: 'Ledger statement fetched successfully',
  })
  async getLedgerStatement(
    @TenantId() tenantId: number,
    @Query('distributorId', ParseIntPipe) distributorId: number,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const statement = await this.ledgerService.getLedgerStatement(
      distributorId,
      tenantId,
      startDate,
      endDate,
    );
    return {
      data: statement,
      message: 'Ledger statement fetched successfully',
    };
  }

  @Get('balance')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Get Distributor Balance' })
  @ApiResponse({ status: 200, description: 'Balance fetched successfully' })
  async getDistributorBalance(
    @TenantId() tenantId: number,
    @Query('distributorId', ParseIntPipe) distributorId: number,
  ) {
    const balance = await this.ledgerService.getDistributorBalance(
      distributorId,
      tenantId,
    );
    return { data: { balance }, message: 'Balance fetched successfully' };
  }

  @Post('payment')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Record Payment from Distributor' })
  @ApiResponse({ status: 201, description: 'Payment recorded successfully' })
  async recordPayment(
    @CurrentUser() user: { id: number; role: string },
    @TenantId() tenantId: number,
    @Body() dto: RecordPaymentDto,
  ) {
    const entry = await this.ledgerService.recordPayment(
      dto,
      tenantId,
      user.id,
    );
    return { data: entry, message: 'Payment recorded successfully' };
  }

  @Post('adjustment')
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create Ledger Adjustment' })
  @ApiResponse({ status: 201, description: 'Adjustment created successfully' })
  async createAdjustment(
    @CurrentUser() user: { id: number; role: string },
    @TenantId() tenantId: number,
    @Body() dto: AdjustmentDto,
  ) {
    const entry = await this.ledgerService.createAdjustment(
      dto,
      tenantId,
      user.id,
    );
    return { data: entry, message: 'Adjustment created successfully' };
  }
}
