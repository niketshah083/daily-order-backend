import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { OrderEntity } from './entities/order.entity';
import { OrderItemEntity } from './entities/order-item.entity';
import { ItemMasterEntity } from '../item-master/entities/item-master.entity';
import { UserEntity } from '../user/entities/user.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CompleteOrdersDto } from './dto/complete-orders.dto';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto';
import { responseMessage } from '../common/utilities/responseMessages.utils';
import { CommonConstants } from '../common/constants/common.constant';
import { EDeliveryWindow } from '../common/interface/common.interface';
import { S3Service } from '../common/services/s3.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { LedgerService } from '../ledger/ledger.service';
import moment from 'moment';
import { EncryptionUtils } from 'src/common/utilities/encryption.utils';

@Injectable()
export class OrdersService {
  private readonly bucketName: string;

  constructor(
    @InjectRepository(OrderEntity)
    private orderRepo: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private orderItemRepo: Repository<OrderItemEntity>,
    @InjectRepository(ItemMasterEntity)
    private itemRepo: Repository<ItemMasterEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    private s3Service: S3Service,
    private configService: ConfigService,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
    @Inject(forwardRef(() => LedgerService))
    private ledgerService: LedgerService,
  ) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') || '';
  }

  async findAll(
    userId: number,
    userRole: string,
    tenantId?: number,
    search?: string,
    status?: string,
    distributorId?: number,
  ) {
    const queryBuilder = this.orderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.distributor', 'distributor')
      .leftJoinAndSelect('distributor.distributor', 'distributorDetails')
      .leftJoinAndSelect('order.orderItems', 'orderItems')
      .leftJoinAndSelect('orderItems.item', 'item')
      .leftJoinAndSelect('order.createdByUser', 'createdByUser')
      .leftJoinAndSelect('order.updatedByUser', 'updatedByUser');

    // Tenant filtering (master_admin sees all, others see only their tenant)
    if (tenantId) {
      queryBuilder.andWhere('order.tenantId = :tenantId', { tenantId });
    }

    // Role-based filtering
    if (userRole === 'distributor') {
      queryBuilder.andWhere('order.distributorId = :userId', { userId });
    }
    // super_admin and master_admin see all orders (within tenant scope)

    // Filter by distributorId (super_admin/master_admin only)
    if (
      (userRole === 'super_admin' || userRole === 'master_admin') &&
      distributorId
    ) {
      queryBuilder.andWhere('order.distributorId = :distributorId', {
        distributorId,
      });
    }

    if (search) {
      queryBuilder.andWhere(
        '(order.orderNo LIKE :search OR distributor.firstName LIKE :search OR distributor.lastName LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      queryBuilder.andWhere('order.status = :status', { status: status });
    }

    queryBuilder.orderBy('order.createdAt', 'DESC');

    const [data, totalCount] = await queryBuilder.getManyAndCount();

    // Generate signed URLs for item assets
    const ordersWithUrls = await Promise.all(
      data.map(async (order) => {
        const orderItemsWithUrls = await Promise.all(
          (order.orderItems || []).map(async (orderItem) => {
            if (orderItem.item) {
              const assetsUrls = await this.getSignedUrls(
                orderItem.item.assets,
              );
              return {
                ...orderItem,
                item: {
                  ...orderItem.item,
                  assetsUrls,
                },
              };
            }
            return orderItem;
          }),
        );

        return {
          ...order,
          orderItems: orderItemsWithUrls,
        };
      }),
    );

    return { data: ordersWithUrls, totalCount };
  }

  async findOne(id: number, tenantId?: number) {
    const whereCondition: any = { id };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const order = await this.orderRepo.findOne({
      where: whereCondition,
      relations: ['distributor', 'orderItems', 'orderItems.item'],
    });

    if (!order) {
      throw new NotFoundException(responseMessage.notFoundMessage('Order'));
    }

    // Generate signed URLs for item assets
    const orderItemsWithUrls = await Promise.all(
      (order.orderItems || []).map(async (orderItem) => {
        if (orderItem.item) {
          const assetsUrls = await this.getSignedUrls(orderItem.item.assets);
          return {
            ...orderItem,
            item: {
              ...orderItem.item,
              assetsUrls,
            },
          };
        }
        return orderItem;
      }),
    );

    return {
      ...order,
      orderItems: orderItemsWithUrls,
    };
  }

  async create(
    dto: CreateOrderDto,
    userId: number,
    userRole: string,
    tenantId?: number,
  ) {
    // Check subscription limit for orders (skip for master_admin)
    if (tenantId && userRole !== 'master_admin') {
      const limitCheck =
        await this.subscriptionService.canCreateOrder(tenantId);
      if (!limitCheck.allowed) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Order Limit Exceeded',
          message: limitCheck.message,
          limit: limitCheck.limit,
          current: limitCheck.current,
          remaining: limitCheck.remaining,
          upgradeRequired: true,
        });
      }
    }

    let deliveryWindow: EDeliveryWindow | null = null;

    // Only check delivery window if the feature is enabled
    if (CommonConstants.IS_ORDER_APPROVAL_WINDOW_OPEN) {
      deliveryWindow = this.getDeliveryWindow();
      if (deliveryWindow === EDeliveryWindow.NONE) {
        throw new BadRequestException(
          'You are not allowed to create order right now! Please come back in next morning or evening',
        );
      }
    }

    // Determine distributorId
    let distributorId: number;
    if (
      (userRole === 'super_admin' || userRole === 'master_admin') &&
      dto.distributorId
    ) {
      // Admin can create order for any distributor
      distributorId = dto.distributorId;
    } else if (userRole === 'distributor') {
      // Distributor creates order for themselves
      distributorId = userId;
    } else {
      throw new ForbiddenException('Invalid role for creating orders');
    }

    // Verify distributor exists and has distributor role
    const distributor = await this.userRepo.findOne({
      where: { id: distributorId, role: 'distributor' },
    });

    if (!distributor) {
      throw new NotFoundException('Distributor not found');
    }

    // Check if distributor already has order today in same window (only if window feature is enabled)
    let existingOrder = null;
    if (CommonConstants.IS_ORDER_APPROVAL_WINDOW_OPEN && deliveryWindow) {
      const today = moment().format('YYYY-MM-DD');
      const startOfDay = new Date(`${today} 00:00:00`);
      const endOfDay = new Date(`${today} 23:59:59`);

      existingOrder = await this.orderRepo.findOne({
        where: {
          distributorId,
          deliveryWindow,
          status: 'pending',
          createdAt: Between(startOfDay, endOfDay),
        },
      });
    }

    // Fetch all required items for rate calculation
    const itemIdSet = new Set(dto.items.map((e) => e.itemId));
    const items = await this.itemRepo.find({
      where: { id: In([...itemIdSet]) },
    });

    if (items.length !== itemIdSet.size) {
      throw new NotFoundException(
        responseMessage.notFoundMessage('One of the items'),
      );
    }

    // CASE 1: UPDATE EXISTING ORDER (MERGE ITEMS) - Only if feature is enabled
    if (
      CommonConstants.IS_ORDER_APPROVAL_WINDOW_OPEN &&
      existingOrder &&
      deliveryWindow
    ) {
      const oldItems = await this.orderItemRepo.find({
        where: { orderId: existingOrder.id },
      });

      const mergedItemsMap = new Map<number, { qty: number; rate: number }>();

      // Add old items first
      oldItems.forEach((oi) => {
        mergedItemsMap.set(oi.itemId, {
          qty: oi.qty,
          rate: oi.rate,
        });
      });

      // Add new items (merge qty if exists)
      dto.items.forEach((ni) => {
        const info = items.find((x) => x.id === ni.itemId);
        const old = mergedItemsMap.get(ni.itemId);

        mergedItemsMap.set(ni.itemId, {
          qty: (old?.qty || 0) + ni.qty,
          rate: info?.rate || 0,
        });
      });

      // Recalculate total
      let total = 0;
      const mergedItems: OrderItemEntity[] = [];

      mergedItemsMap.forEach((value, key) => {
        const amount = value.qty * value.rate;
        total += amount;

        mergedItems.push(
          this.orderItemRepo.create({
            orderId: existingOrder.id,
            itemId: key,
            qty: value.qty,
            rate: value.rate,
            amount,
          }),
        );
      });

      // Update main order
      existingOrder.totalAmount = total;
      existingOrder.updatedBy = userId;

      await this.orderRepo.save(existingOrder);

      // Remove old items and store merged items
      await this.orderItemRepo.delete({ orderId: existingOrder.id });
      await this.orderItemRepo.save(mergedItems);

      return this.findOne(existingOrder.id, tenantId);
    }

    // CASE 2: CREATE NEW ORDER
    const orderNo = `ORD-${Date.now()}`;
    let total = 0;

    dto.items.forEach((it) => {
      const itemInfo = items.find((item) => item.id === it.itemId);
      total += it.qty * (itemInfo?.rate || 0);
    });

    const order = this.orderRepo.create({
      orderNo,
      deliveryWindow,
      status: 'pending',
      distributorId,
      totalAmount: total,
      createdBy: userId,
      tenantId: tenantId || null,
    });

    const saved = await this.orderRepo.save(order);

    await Promise.all(
      dto.items.map(async (it) => {
        const info = items.find((x) => x.id === it.itemId);
        const amount = it.qty * (info?.rate || 0);

        const oi = this.orderItemRepo.create({
          orderId: saved.id,
          itemId: it.itemId,
          qty: it.qty,
          rate: info?.rate || 0,
          amount,
        });
        await this.orderItemRepo.save(oi);
      }),
    );

    // Increment usage count for orders
    if (tenantId) {
      await this.subscriptionService.incrementUsage(tenantId, 'ordersCount');
    }

    // Note: Ledger debit entry is created when order is COMPLETED, not when created

    return this.findOne(saved.id, tenantId);
  }

  async update(
    id: number,
    dto: CreateOrderDto,
    userId: number,
    userRole: string,
    tenantId?: number,
  ) {
    const order = await this.findOne(id, tenantId);

    // Determine distributorId
    const distributorId = dto.distributorId || order.distributorId;

    // Verify distributor exists
    const distributor = await this.userRepo.findOne({
      where: { id: distributorId, role: 'distributor' },
    });

    if (!distributor) {
      throw new NotFoundException('Distributor not found');
    }

    // Fetch item rates for recalculation
    const itemIdSet = new Set(dto.items.map((i) => i.itemId));
    const items = await this.itemRepo.find({
      where: { id: In([...itemIdSet]) },
    });

    // Recalculate total
    let total = 0;
    dto.items.forEach((it) => {
      const info = items.find((x) => x.id === it.itemId);
      total += it.qty * (info?.rate || 0);
    });

    // Update main order
    order.distributorId = distributorId;
    order.totalAmount = total;
    order.updatedBy = userId;

    await this.orderRepo.save(order);

    // Remove existing items
    await this.orderItemRepo.delete({ orderId: id });

    // Insert updated items
    await Promise.all(
      dto.items.map(async (it) => {
        const info = items.find((x) => x.id === it.itemId);
        const amount = it.qty * (info?.rate || 0);

        const oi = this.orderItemRepo.create({
          orderId: id,
          itemId: it.itemId,
          qty: it.qty,
          rate: info?.rate || 0,
          amount,
        });
        await this.orderItemRepo.save(oi);
      }),
    );

    return this.findOne(id, tenantId);
  }

  async completeOrders(
    completeOrdersDto: CompleteOrdersDto,
    userId: number,
    tenantId?: number,
  ) {
    const { ids } = completeOrdersDto;

    const whereCondition: any = { id: In(ids) };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const orders = await this.orderRepo.find({
      where: whereCondition,
    });

    if (!orders.length) {
      throw new NotFoundException(responseMessage.notFoundMessage('Orders'));
    }

    // Validate missing orders
    const foundIds = orders.map((o) => o.id);
    const missingIds = ids.filter((x) => !foundIds.includes(x));

    if (missingIds.length) {
      throw new BadRequestException(
        `Orders not found: ${missingIds.join(', ')}`,
      );
    }

    // Check for non-pending orders (only pending orders can be completed)
    const nonPendingOrders = orders.filter(
      (o) => o.status.toLowerCase() !== 'pending',
    );
    if (nonPendingOrders.length) {
      throw new BadRequestException(
        `Only pending orders can be marked as complete. Non-pending orders: ${nonPendingOrders.map((o) => o.orderNo).join(', ')}`,
      );
    }

    // Update all orders and create ledger entries
    for (const order of orders) {
      order.status = 'completed';
      order.updatedBy = userId;

      // Create ledger debit entry when order is completed (distributor owes money)
      if (tenantId) {
        await this.ledgerService.onOrderCreated(
          order.id,
          order.orderNo,
          order.distributorId,
          Number(order.totalAmount),
          tenantId,
          userId,
        );
      }
    }

    await this.orderRepo.save(orders);

    return orders;
  }

  getCurrentWindow(): EDeliveryWindow {
    const now = moment.tz('Asia/Kolkata');

    const morningStart = moment.tz(
      CommonConstants.ORDER_APPROVAL_TIMING.MORNING[0],
      'h:mm A',
      'Asia/Kolkata',
    );
    const morningEnd = moment.tz(
      CommonConstants.ORDER_APPROVAL_TIMING.MORNING[1],
      'h:mm A',
      'Asia/Kolkata',
    );

    const eveningStart = moment.tz(
      CommonConstants.ORDER_APPROVAL_TIMING.EVENING[0],
      'h:mm A',
      'Asia/Kolkata',
    );
    const eveningEnd = moment.tz(
      CommonConstants.ORDER_APPROVAL_TIMING.EVENING[1],
      'h:mm A',
      'Asia/Kolkata',
    );

    if (now.isBetween(morningStart, morningEnd, null, '[)')) {
      return EDeliveryWindow.MORNING;
    }

    if (now.isBetween(eveningStart, eveningEnd, null, '[)')) {
      return EDeliveryWindow.EVENING;
    }

    return EDeliveryWindow.NONE;
  }

  getDeliveryWindow(): EDeliveryWindow {
    const currentWindow = this.getCurrentWindow();
    if (currentWindow === EDeliveryWindow.MORNING) {
      return EDeliveryWindow.EVENING;
    }

    if (currentWindow === EDeliveryWindow.EVENING) {
      return EDeliveryWindow.MORNING;
    }
    return EDeliveryWindow.NONE;
  }

  async fetchLastFivePendingOrders() {
    return await this.orderRepo.find({
      where: { status: 'pending' },
      take: 5,
      order: { createdAt: 'DESC' },
      relations: ['distributor'],
    });
  }

  async fetchOrderInfoByOrderNo(orderNo: string) {
    return await this.orderRepo.findOne({
      where: { orderNo },
      relations: ['distributor', 'orderItems', 'orderItems.item'],
    });
  }

  async processWhatsappData(body: any) {
    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } =
      await EncryptionUtils.decryptRequest(body, process.env.PRIVATE_KEY);

    const { screen, data, version, action, flow_token } = decryptedBody;
    console.log({ screen, data, version, action, flow_token });
    console.log('Decrypted Body: ', decryptedBody);
    if (action === 'ping') {
      const pingResponse = { data: { status: 'active' } };
      return EncryptionUtils.encryptResponse(
        pingResponse,
        aesKeyBuffer,
        initialVectorBuffer,
      );
    } else if (action === 'INIT') {
      const mobileNo = flow_token.split('~')?.[1];
      const user = await this.userRepo.findOne({
        where: { phoneNo: mobileNo },
      });
      const items = await this.itemRepo.find({
        where: { tenantId: user?.tenantId },
      });
      const ORDER_ITEMS = {};
      items.forEach((it, index) => {
        ORDER_ITEMS[`item${index + 1}`] = `${it.name}~(₹${it.rate})`;
      });
      const SCREEN_RESPONSES = {
        screen: 'ORDER',
        data: {
          ...ORDER_ITEMS,
        },
      };
      // Return the response as plaintext
      return EncryptionUtils.encryptResponse(
        SCREEN_RESPONSES,
        aesKeyBuffer,
        initialVectorBuffer,
      );
    } else if (action === 'data_exchange') {
      const mobileNo = flow_token.split('~')?.[1];
      const user = await this.userRepo.findOne({
        where: { phoneNo: mobileNo },
      });
      if (user) {
        // Return the next screen & data to the client
        const items = {};
        Object.keys(data)
          .filter((key) => !key.endsWith('Qty'))
          .map((key) => {
            items[data[key].split('~')[0]] = +data[`${key}Qty`] || 0;
          });

        const itemNames = Object.keys(items);
        const itemList = await this.itemRepo.find({
          where: { name: In(itemNames) },
        });
        const obj: CreateOrderDto = {
          distributorId: user.id,
          items: itemList
            .map((it) => ({
              itemId: it.id,
              qty: items[it.name],
            }))
            .filter((it) => it.qty),
        };
        console.log('obj :: ', obj);
        const order = await this.create(obj, user.id, user.role, user.tenantId);
        console.log('order :: ', order);
        const SCREEN_RESPONSES = {
          screen: 'SUCCESS',
          data: {
            extension_message_response: {
              params: {
                order_number: order.orderNo,
              },
            },
          },
        };
        return EncryptionUtils.encryptResponse(
          SCREEN_RESPONSES,
          aesKeyBuffer,
          initialVectorBuffer,
        );
      } else {
        console.log('User not found :: ');
      }
    }
  }

  private async getSignedUrls(assets: string[]): Promise<string[]> {
    if (!assets || assets.length === 0) {
      return [];
    }

    const urls = await Promise.all(
      assets.map(async (assetKey) => {
        try {
          return await this.s3Service.getFilePathFromUrl(
            assetKey,
            this.bucketName,
            3600,
          );
        } catch (error) {
          console.error(
            `Failed to generate signed URL for: ${assetKey}`,
            error,
          );
          return null;
        }
      }),
    );

    return urls.filter((url) => url !== null);
  }

  async updatePaymentStatus(
    dto: UpdatePaymentStatusDto,
    userId: number,
    tenantId?: number,
  ) {
    const { orderIds, paymentStatus } = dto;

    const whereCondition: any = { id: In(orderIds) };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const orders = await this.orderRepo.find({
      where: whereCondition,
    });

    if (!orders.length) {
      throw new NotFoundException(responseMessage.notFoundMessage('Orders'));
    }

    // Validate missing orders
    const foundIds = orders.map((o) => o.id);
    const missingIds = orderIds.filter((x) => !foundIds.includes(x));

    if (missingIds.length) {
      throw new BadRequestException(
        `Orders not found: ${missingIds.join(', ')}`,
      );
    }

    // Validate: Only completed orders can be marked as paid
    if (paymentStatus === 'paid') {
      const nonCompletedOrders = orders.filter(
        (o) => o.status.toLowerCase() !== 'completed',
      );
      if (nonCompletedOrders.length) {
        throw new BadRequestException(
          `Only completed orders can be marked as paid. Non-completed orders: ${nonCompletedOrders.map((o) => o.orderNo).join(', ')}`,
        );
      }

      // Check for already paid orders
      const alreadyPaidOrders = orders.filter(
        (o) => o.paymentStatus === 'paid',
      );
      if (alreadyPaidOrders.length) {
        throw new BadRequestException(
          `Orders already marked as paid: ${alreadyPaidOrders.map((o) => o.orderNo).join(', ')}`,
        );
      }
    }

    // Process each order
    const updatedOrders = [];
    for (const order of orders) {
      const previousStatus = order.paymentStatus;

      // Only create ledger entry if status is changing to 'paid' from 'unpaid'
      if (paymentStatus === 'paid' && previousStatus !== 'paid' && tenantId) {
        await this.ledgerService.onPaymentReceived(
          order.id,
          order.orderNo,
          order.distributorId,
          Number(order.totalAmount),
          tenantId,
          userId,
        );
      }

      // If changing from 'paid' to 'unpaid', reverse the credit (create debit)
      if (paymentStatus === 'unpaid' && previousStatus === 'paid' && tenantId) {
        await this.ledgerService.createDebitEntry(
          order.distributorId,
          Number(order.totalAmount),
          'adjustment',
          order.id,
          `Payment reversal for Order ${order.orderNo}`,
          tenantId,
          userId,
        );
      }

      order.paymentStatus = paymentStatus;
      order.updatedBy = userId;
      updatedOrders.push(order);
    }

    await this.orderRepo.save(updatedOrders);

    return {
      message: `Payment status updated to '${paymentStatus}' for ${updatedOrders.length} order(s)`,
      orders: updatedOrders,
    };
  }

  async cancelOrder(orderId: number, userId: number, tenantId?: number) {
    const order = await this.findOne(orderId, tenantId);

    if (order.status === 'cancelled') {
      throw new BadRequestException('Order is already cancelled');
    }

    // Only pending orders can be cancelled (no ledger entry exists for pending orders)
    if (order.status.toLowerCase() !== 'pending') {
      throw new BadRequestException(
        'Only pending orders can be cancelled. Completed orders cannot be cancelled.',
      );
    }

    order.status = 'cancelled';
    order.updatedBy = userId;

    await this.orderRepo.save(order);

    return order;
  }

  async cancelOrders(orderIds: number[], userId: number, tenantId?: number) {
    const whereCondition: any = { id: In(orderIds) };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const orders = await this.orderRepo.find({
      where: whereCondition,
    });

    if (!orders.length) {
      throw new NotFoundException(responseMessage.notFoundMessage('Orders'));
    }

    // Validate missing orders
    const foundIds = orders.map((o) => o.id);
    const missingIds = orderIds.filter((x) => !foundIds.includes(x));

    if (missingIds.length) {
      throw new BadRequestException(
        `Orders not found: ${missingIds.join(', ')}`,
      );
    }

    // Only pending orders can be cancelled
    const nonPendingOrders = orders.filter(
      (o) => o.status.toLowerCase() !== 'pending',
    );
    if (nonPendingOrders.length) {
      throw new BadRequestException(
        `Only pending orders can be cancelled. Non-pending orders: ${nonPendingOrders.map((o) => o.orderNo).join(', ')}`,
      );
    }

    // Update all orders
    orders.forEach((o) => {
      o.status = 'cancelled';
      o.updatedBy = userId;
    });

    await this.orderRepo.save(orders);

    return orders;
  }
}
