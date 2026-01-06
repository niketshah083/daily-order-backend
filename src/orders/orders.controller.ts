import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CompleteOrdersDto } from './dto/complete-orders.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { responseMessage } from '../common/utilities/responseMessages.utils';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../subscription/guards/subscription.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { SkipTransform } from 'src/common/decorators/skip-interceptor.decorator';
import { SkipSubscriptionCheck } from '../subscription/decorators/skip-subscription.decorator';
import { Request, Response } from 'express';

@ApiTags('orders')
@Controller('orders')
@UseGuards(SubscriptionGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('whatsapp')
  @SkipTransform()
  @SkipSubscriptionCheck()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Process WhatsApp Order Data (Public)',
    description:
      'Public webhook endpoint to process orders from WhatsApp Business API. No authentication required.',
  })
  @ApiOkResponse({ description: 'WhatsApp data processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid WhatsApp data' })
  async processWhatsappData(@Req() req: Request, @Res() res: Response) {
    try {
      const data = await this.ordersService.processWhatsappData(req.body);
      res
        .status(HttpStatus.OK)
        .set('Content-Type', 'application/json')
        .json(data);
    } catch (error) {
      throw error;
    }
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get All Orders',
    description:
      'Retrieve list of orders. Master admin sees all, super admin sees tenant orders, distributors see only their orders',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by order number or distributor name',
  })
  @ApiQuery({
    name: 'distributorId',
    required: false,
    description: 'Filter by distributor ID (admin only)',
  })
  @ApiResponse({ status: 200, description: 'Orders retrieved successfully' })
  async list(
    @CurrentUser() user: { id: number; role: string },
    @TenantId() tenantId: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('distributorId') distributorId?: string,
  ) {
    const data = await this.ordersService.findAll(
      user.id,
      user.role,
      tenantId,
      search,
      status,
      distributorId ? parseInt(distributorId) : undefined,
    );
    return {
      data: data.data,
      totalCount: data.totalCount,
      message: responseMessage.fetchMessage('Orders'),
    };
  }

  @Get('current-window')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Current Time Window',
    description: 'Get the current time window for order processing',
  })
  @ApiResponse({
    status: 200,
    description: 'Current window retrieved successfully',
  })
  async getCurrentWindow() {
    const currentWindow = this.ordersService.getCurrentWindow();
    return {
      data: currentWindow,
      message: responseMessage.fetchMessage('Current window'),
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get Order Details',
    description: 'Retrieve details of a specific order',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Order ID' })
  @ApiResponse({ status: 200, description: 'Order retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async get(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.ordersService.findOne(id, tenantId);
    return { data, message: responseMessage.fetchMessage('Order') };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create Order',
    description:
      'Create a new order. Distributors create for themselves, admins can create for any distributor',
  })
  @ApiBody({ type: CreateOrderDto, description: 'Order details' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid order data' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @CurrentUser() user: { id: number; role: string },
    @TenantId() tenantId: number,
    @Body() dto: CreateOrderDto,
  ) {
    const data = await this.ordersService.create(
      dto,
      user.id,
      user.role,
      tenantId,
    );
    return { data, message: responseMessage.addMessage('Order') };
  }

  @Put('complete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super_admin')
  @ApiOperation({
    summary: 'Bulk Complete Orders',
    description: 'Mark multiple orders as complete (Super Admin only)',
  })
  @ApiBody({ type: CompleteOrdersDto, description: 'Order IDs to complete' })
  @ApiResponse({ status: 200, description: 'Orders completed successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only admins can complete orders',
  })
  async completeOrders(
    @CurrentUser() user: { id: number; role: string },
    @TenantId() tenantId: number,
    @Body() completeOrdersDto: CompleteOrdersDto,
  ) {
    const data = await this.ordersService.completeOrders(
      completeOrdersDto,
      user.id,
      tenantId,
    );
    return { data, message: responseMessage.completeMessage('Orders') };
  }

  @Put('payment-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super_admin')
  @ApiOperation({
    summary: 'Update Payment Status',
    description:
      'Update payment status for multiple orders and create ledger entries (Super Admin only)',
  })
  @ApiBody({
    type: UpdatePaymentStatusDto,
    description: 'Order IDs and payment status',
  })
  @ApiResponse({
    status: 200,
    description: 'Payment status updated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only super admin can update payment status',
  })
  async updatePaymentStatus(
    @CurrentUser() user: { id: number; role: string },
    @TenantId() tenantId: number,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    const result = await this.ordersService.updatePaymentStatus(
      dto,
      user.id,
      tenantId,
    );
    return { data: result.orders, message: result.message };
  }

  @Put('cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super_admin')
  @ApiOperation({
    summary: 'Bulk Cancel Orders',
    description:
      'Cancel multiple pending orders (Super Admin only). Only pending orders can be cancelled.',
  })
  @ApiBody({ type: CompleteOrdersDto, description: 'Order IDs to cancel' })
  @ApiResponse({ status: 200, description: 'Orders cancelled successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - only super admin can cancel orders',
  })
  async cancelOrders(
    @CurrentUser() user: { id: number; role: string },
    @TenantId() tenantId: number,
    @Body() dto: CompleteOrdersDto,
  ) {
    const data = await this.ordersService.cancelOrders(
      dto.ids,
      user.id,
      tenantId,
    );
    return { data, message: 'Orders cancelled successfully' };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles('super_admin', 'distributor')
  @ApiOperation({
    summary: 'Update Order',
    description: 'Update order details',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Order ID' })
  @ApiBody({ type: CreateOrderDto, description: 'Updated order details' })
  @ApiResponse({ status: 200, description: 'Order updated successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden',
  })
  async update(
    @CurrentUser() user: { id: number; role: string },
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOrderDto,
  ) {
    const data = await this.ordersService.update(
      id,
      dto,
      user.id,
      user.role,
      tenantId,
    );
    return { data, message: responseMessage.updateMessage('Order') };
  }
}
