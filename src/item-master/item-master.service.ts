import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ItemMasterEntity } from './entities/item-master.entity';
import { CreateItemMasterDto } from './dto/create-item-master.dto';
import { UpdateItemMasterDto } from './dto/update-item-master.dto';
import { S3Service } from '../common/services/s3.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class ItemMasterService {
  private readonly bucketName: string;

  constructor(
    @InjectRepository(ItemMasterEntity)
    private itemMasterRepository: Repository<ItemMasterEntity>,
    private s3Service: S3Service,
    private configService: ConfigService,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
  ) {
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') || '';
  }

  async create(
    createItemMasterDto: CreateItemMasterDto,
    tenantId?: number,
    files?: Express.Multer.File[],
  ) {
    // Check subscription limit for items
    if (tenantId) {
      const limitCheck = await this.subscriptionService.canCreateItem(tenantId);
      if (!limitCheck.allowed) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Item Limit Exceeded',
          message: limitCheck.message,
          limit: limitCheck.limit,
          current: limitCheck.current,
          remaining: limitCheck.remaining,
          upgradeRequired: true,
        });
      }
    }

    const assetPaths: string[] = [];

    // Upload files to S3 if provided
    if (files && files.length > 0) {
      for (const file of files) {
        const fileKey = `items/${Date.now()}-${file.originalname}`;
        await this.s3Service.uploadS3File(file, this.bucketName, fileKey);
        assetPaths.push(fileKey);
      }
    }

    const itemMaster = this.itemMasterRepository.create({
      ...createItemMasterDto,
      assets: assetPaths.length > 0 ? assetPaths : undefined,
      tenantId: tenantId || null,
    });

    const savedItem = await this.itemMasterRepository.save(itemMaster);

    // Increment usage count for items
    if (tenantId) {
      await this.subscriptionService.incrementUsage(tenantId, 'itemsCount');
    }

    return savedItem;
  }

  async findAll(tenantId?: number) {
    console.log('tenantId ::', tenantId);
    const whereCondition: any = {};
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const items = await this.itemMasterRepository.find({
      where: whereCondition,
      relations: ['category'],
    });

    // Generate signed URLs for assets
    const itemsWithUrls = await Promise.all(
      items.map(async (item) => {
        const assetsUrls = await this.getSignedUrls(item.assets);
        return {
          ...item,
          assetsUrls,
        };
      }),
    );

    return itemsWithUrls;
  }

  async findOne(id: number, tenantId?: number) {
    const whereCondition: any = { id };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const item = await this.itemMasterRepository.findOne({
      where: whereCondition,
      relations: ['category'],
    });

    if (!item) {
      throw new NotFoundException('Item not found');
    }

    const assetsUrls = await this.getSignedUrls(item.assets);

    return {
      ...item,
      assetsUrls,
    };
  }

  async update(
    id: number,
    updateItemMasterDto: UpdateItemMasterDto,
    tenantId?: number,
    files?: Express.Multer.File[],
  ) {
    const item = await this.findOne(id, tenantId);

    const assetPaths: string[] = item.assets || [];

    // Upload new files to S3 if provided
    if (files && files.length > 0) {
      for (const file of files) {
        const fileKey = `items/${Date.now()}-${file.originalname}`;
        await this.s3Service.uploadS3File(file, this.bucketName, fileKey);
        assetPaths.push(fileKey);
      }
    }

    // Update item
    Object.assign(item, {
      ...updateItemMasterDto,
      assets: assetPaths.length > 0 ? assetPaths : undefined,
    });

    await this.itemMasterRepository.save(item);

    return this.findOne(id, tenantId);
  }

  async remove(id: number, tenantId?: number) {
    const item = await this.findOne(id, tenantId);
    const itemTenantId = item.tenantId;

    // Delete assets from S3
    if (item.assets && item.assets.length > 0) {
      for (const assetKey of item.assets) {
        try {
          await this.s3Service.deleteS3File(this.bucketName, assetKey);
        } catch (error) {
          console.error(`Failed to delete asset: ${assetKey}`, error);
        }
      }
    }

    // Need to get the entity again for removal
    const itemEntity = await this.itemMasterRepository.findOne({
      where: { id: item.id },
    });

    await this.itemMasterRepository.remove(itemEntity);

    // Decrement usage count for items
    if (itemTenantId) {
      await this.subscriptionService.decrementUsage(itemTenantId, 'itemsCount');
    }

    return { message: 'Item deleted successfully' };
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
}
