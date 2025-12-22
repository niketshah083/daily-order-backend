import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { OrderEntity } from '../orders/entities/order.entity';
import { ItemMasterEntity } from '../item-master/entities/item-master.entity';
import { UserEntity } from '../user/entities/user.entity';
import { OrderItemEntity } from '../orders/entities/order-item.entity';
import moment from 'moment';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(OrderEntity)
    private orderRepo: Repository<OrderEntity>,
    @InjectRepository(ItemMasterEntity)
    private itemRepo: Repository<ItemMasterEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    @InjectRepository(OrderItemEntity)
    private orderItemRepo: Repository<OrderItemEntity>,
  ) {}

  async getStatistics(tenantId?: number) {
    const today = moment().format('YYYY-MM-DD');
    const startOfDay = new Date(`${today} 00:00:00`);
    const endOfDay = new Date(`${today} 23:59:59`);

    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();

    // Build where conditions for tenant filtering
    const orderWhere: any = {};
    const itemWhere: any = {};
    const userWhere: any = { role: 'distributor' };

    if (tenantId) {
      orderWhere.tenantId = tenantId;
      itemWhere.tenantId = tenantId;
      userWhere.tenantId = tenantId;
    }

    // Total counts
    const totalOrders = await this.orderRepo.count({ where: orderWhere });
    const totalItems = await this.itemRepo.count({ where: itemWhere });
    const totalDistributors = await this.userRepo.count({ where: userWhere });

    // Today's orders
    const todayOrders = await this.orderRepo.count({
      where: {
        ...orderWhere,
        createdAt: Between(startOfDay, endOfDay),
      },
    });

    // Pending orders
    const pendingOrders = await this.orderRepo.count({
      where: { ...orderWhere, status: 'pending' },
    });

    // Completed orders
    const completedOrders = await this.orderRepo.count({
      where: { ...orderWhere, status: 'completed' },
    });

    // Today's revenue
    const todayOrdersData = await this.orderRepo.find({
      where: {
        ...orderWhere,
        createdAt: Between(startOfDay, endOfDay),
      },
    });
    const todayRevenue = todayOrdersData.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );

    // This month's revenue
    const monthOrdersData = await this.orderRepo.find({
      where: {
        ...orderWhere,
        createdAt: Between(startOfMonth, endOfMonth),
      },
    });
    const monthRevenue = monthOrdersData.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );

    // Total revenue
    const allOrders = await this.orderRepo.find({ where: orderWhere });
    const totalRevenue = allOrders.reduce(
      (sum, order) => sum + Number(order.totalAmount || 0),
      0,
    );

    return {
      totalOrders,
      totalItems,
      totalDistributors,
      todayOrders,
      pendingOrders,
      completedOrders,
      todayRevenue,
      monthRevenue,
      totalRevenue,
    };
  }

  async getRecentOrders(tenantId?: number, limit: number = 5) {
    const whereCondition: any = {};
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    return await this.orderRepo.find({
      where: whereCondition,
      take: limit,
      order: { createdAt: 'DESC' },
      relations: ['distributor', 'orderItems'],
    });
  }

  async getTopItems(tenantId?: number, limit: number = 5) {
    const whereCondition: any = {};
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const orders = await this.orderRepo.find({
      where: whereCondition,
      relations: ['orderItems', 'orderItems.item'],
    });

    const itemStats = new Map<
      number,
      { item: any; totalQty: number; totalRevenue: number; orderCount: number }
    >();

    orders.forEach((order) => {
      order.orderItems.forEach((orderItem) => {
        if (orderItem.item) {
          const existing = itemStats.get(orderItem.itemId);
          if (existing) {
            existing.totalQty += Number(orderItem.qty || 0);
            existing.totalRevenue += Number(orderItem.amount || 0);
            existing.orderCount += 1;
          } else {
            itemStats.set(orderItem.itemId, {
              item: orderItem.item,
              totalQty: Number(orderItem.qty || 0),
              totalRevenue: Number(orderItem.amount || 0),
              orderCount: 1,
            });
          }
        }
      });
    });

    const topItems = Array.from(itemStats.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    return topItems;
  }

  async getTopDistributors(tenantId?: number, limit: number = 5) {
    const whereCondition: any = {};
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const orders = await this.orderRepo.find({
      where: whereCondition,
      relations: ['distributor'],
    });

    const distributorStats = new Map<
      number,
      { distributor: any; totalOrders: number; totalRevenue: number }
    >();

    orders.forEach((order) => {
      if (order.distributor) {
        const existing = distributorStats.get(order.distributorId);
        if (existing) {
          existing.totalOrders += 1;
          existing.totalRevenue += Number(order.totalAmount || 0);
        } else {
          distributorStats.set(order.distributorId, {
            distributor: order.distributor,
            totalOrders: 1,
            totalRevenue: Number(order.totalAmount || 0),
          });
        }
      }
    });

    const topDistributors = Array.from(distributorStats.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);

    return topDistributors;
  }

  async getOrdersByDate(tenantId?: number, days: number = 7) {
    const result = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = moment().subtract(i, 'days').format('YYYY-MM-DD');
      const startOfDay = new Date(`${date} 00:00:00`);
      const endOfDay = new Date(`${date} 23:59:59`);

      const whereCondition: any = {
        createdAt: Between(startOfDay, endOfDay),
      };
      if (tenantId) {
        whereCondition.tenantId = tenantId;
      }

      const orders = await this.orderRepo.find({
        where: whereCondition,
      });

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce(
        (sum, order) => sum + Number(order.totalAmount || 0),
        0,
      );

      result.push({
        date,
        totalOrders,
        totalRevenue,
      });
    }

    return result;
  }

  async getRevenueByMonth(tenantId?: number, months: number = 6) {
    const result = [];

    for (let i = months - 1; i >= 0; i--) {
      const startOfMonth = moment()
        .subtract(i, 'months')
        .startOf('month')
        .toDate();
      const endOfMonth = moment().subtract(i, 'months').endOf('month').toDate();
      const monthName = moment().subtract(i, 'months').format('MMM YYYY');

      const whereCondition: any = {
        createdAt: Between(startOfMonth, endOfMonth),
      };
      if (tenantId) {
        whereCondition.tenantId = tenantId;
      }

      const orders = await this.orderRepo.find({
        where: whereCondition,
      });

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce(
        (sum, order) => sum + Number(order.totalAmount || 0),
        0,
      );

      result.push({
        month: monthName,
        totalOrders,
        totalRevenue,
      });
    }

    return result;
  }

  async getDistributorItemReport(
    fromDate: string,
    toDate: string,
    tenantId?: number,
  ) {
    const startDate = new Date(`${fromDate} 00:00:00`);
    const endDate = new Date(`${toDate} 23:59:59`);

    // Get all items for column headers
    const itemWhere: any = {};
    if (tenantId) {
      itemWhere.tenantId = tenantId;
    }

    const allItems = await this.itemRepo.find({
      where: itemWhere,
      order: { name: 'ASC' },
    });

    // Get all orders within date range with items and distributor
    const orderWhere: any = {
      createdAt: Between(startDate, endDate),
    };
    if (tenantId) {
      orderWhere.tenantId = tenantId;
    }

    const orders = await this.orderRepo.find({
      where: orderWhere,
      relations: ['distributor', 'orderItems', 'orderItems.item'],
    });

    // Build distributor-item quantity map
    const distributorMap = new Map<
      number,
      { distributor: any; itemQuantities: Map<number, number> }
    >();

    orders.forEach((order) => {
      if (!order.distributor) return;

      if (!distributorMap.has(order.distributorId)) {
        distributorMap.set(order.distributorId, {
          distributor: order.distributor,
          itemQuantities: new Map<number, number>(),
        });
      }

      const distData = distributorMap.get(order.distributorId)!;

      order.orderItems.forEach((orderItem) => {
        if (orderItem.item) {
          const currentQty = distData.itemQuantities.get(orderItem.itemId) || 0;
          distData.itemQuantities.set(
            orderItem.itemId,
            currentQty + Number(orderItem.qty || 0),
          );
        }
      });
    });

    // Convert to array format for response
    const reportData = Array.from(distributorMap.values()).map((distData) => {
      const row: any = {
        distributorId: distData.distributor.id,
        distributorName: `${distData.distributor.firstName} ${distData.distributor.lastName}`,
        businessName: distData.distributor.distributor?.businessName || '',
        items: {},
      };

      allItems.forEach((item) => {
        row.items[item.id] = distData.itemQuantities.get(item.id) || 0;
      });

      return row;
    });

    // Sort by distributor name
    reportData.sort((a, b) =>
      a.distributorName.localeCompare(b.distributorName),
    );

    return {
      items: allItems.map((item) => ({ id: item.id, name: item.name })),
      distributors: reportData,
      fromDate,
      toDate,
    };
  }
}
