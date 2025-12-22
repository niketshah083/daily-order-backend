import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { CategoryEntity } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(CategoryEntity)
    private categoryRepository: Repository<CategoryEntity>,
    @Inject(forwardRef(() => SubscriptionService))
    private subscriptionService: SubscriptionService,
  ) {}

  async create(
    createCategoryDto: CreateCategoryDto,
    tenantId?: number,
  ): Promise<CategoryEntity> {
    // Check subscription limit for categories
    if (tenantId) {
      const limitCheck =
        await this.subscriptionService.canCreateCategory(tenantId);
      if (!limitCheck.allowed) {
        throw new ForbiddenException({
          statusCode: 403,
          error: 'Category Limit Exceeded',
          message: limitCheck.message,
          limit: limitCheck.limit,
          current: limitCheck.current,
          remaining: limitCheck.remaining,
          upgradeRequired: true,
        });
      }
    }

    // Validate parent category if provided
    if (createCategoryDto.parentCategoryId) {
      const whereCondition: any = { id: createCategoryDto.parentCategoryId };
      if (tenantId) {
        whereCondition.tenantId = tenantId;
      }

      const parentCategory = await this.categoryRepository.findOne({
        where: whereCondition,
      });
      if (!parentCategory) {
        throw new NotFoundException('Parent category not found');
      }
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      tenantId: tenantId || null,
    });
    const savedCategory = await this.categoryRepository.save(category);

    // Increment usage count for categories
    if (tenantId) {
      await this.subscriptionService.incrementUsage(
        tenantId,
        'categoriesCount',
      );
    }

    return savedCategory;
  }

  async findAll(tenantId?: number): Promise<CategoryEntity[]> {
    const whereCondition: any = {};
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    return await this.categoryRepository.find({
      where: whereCondition,
      relations: ['parentCategory', 'children'],
      order: { name: 'ASC' },
    });
  }

  async findAllParentCategories(tenantId?: number): Promise<CategoryEntity[]> {
    const whereCondition: any = { parentCategoryId: IsNull() };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    return await this.categoryRepository.find({
      where: whereCondition,
      relations: ['children'],
      order: { name: 'ASC' },
    });
  }

  async findAllWithHierarchy(tenantId?: number): Promise<any[]> {
    const whereCondition: any = { parentCategoryId: IsNull() };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const categories = await this.categoryRepository.find({
      where: whereCondition,
      relations: ['children'],
      order: { name: 'ASC' },
    });

    return this.buildHierarchy(categories);
  }

  private buildHierarchy(categories: CategoryEntity[]): any[] {
    return categories.map((category) => ({
      ...category,
      children: category.children ? this.buildHierarchy(category.children) : [],
    }));
  }

  async findOne(id: number, tenantId?: number): Promise<CategoryEntity> {
    const whereCondition: any = { id };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    const category = await this.categoryRepository.findOne({
      where: whereCondition,
      relations: ['parentCategory', 'children'],
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async findByParent(parentId: number): Promise<CategoryEntity[]> {
    return await this.categoryRepository.find({
      where: { parentCategoryId: parentId },
      relations: ['children'],
      order: { name: 'ASC' },
    });
  }

  async update(
    id: number,
    updateCategoryDto: UpdateCategoryDto,
    tenantId?: number,
  ): Promise<CategoryEntity> {
    const category = await this.findOne(id, tenantId);

    // Prevent setting self as parent
    if (updateCategoryDto.parentCategoryId === id) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    // Validate parent category if provided
    if (updateCategoryDto.parentCategoryId) {
      const whereCondition: any = { id: updateCategoryDto.parentCategoryId };
      if (tenantId) {
        whereCondition.tenantId = tenantId;
      }

      const parentCategory = await this.categoryRepository.findOne({
        where: whereCondition,
      });
      if (!parentCategory) {
        throw new NotFoundException('Parent category not found');
      }

      // Prevent circular reference
      if (await this.isDescendant(updateCategoryDto.parentCategoryId, id)) {
        throw new BadRequestException(
          'Cannot set a descendant as parent category',
        );
      }
    }

    Object.assign(category, updateCategoryDto);
    return await this.categoryRepository.save(category);
  }

  private async isDescendant(
    categoryId: number,
    potentialAncestorId: number,
  ): Promise<boolean> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
      relations: ['parentCategory'],
    });

    if (!category || !category.parentCategoryId) {
      return false;
    }

    if (category.parentCategoryId === potentialAncestorId) {
      return true;
    }

    return this.isDescendant(category.parentCategoryId, potentialAncestorId);
  }

  async remove(id: number, tenantId?: number): Promise<{ message: string }> {
    const category = await this.findOne(id, tenantId);
    const categoryTenantId = category.tenantId;

    // Check if category has children
    if (category.children && category.children.length > 0) {
      throw new BadRequestException(
        'Cannot delete category with sub-categories. Delete sub-categories first.',
      );
    }

    await this.categoryRepository.remove(category);

    // Decrement usage count for categories
    if (categoryTenantId) {
      await this.subscriptionService.decrementUsage(
        categoryTenantId,
        'categoriesCount',
      );
    }

    return { message: 'Category deleted successfully' };
  }

  async findActiveCategories(tenantId?: number): Promise<CategoryEntity[]> {
    const whereCondition: any = { isActive: true };
    if (tenantId) {
      whereCondition.tenantId = tenantId;
    }

    return await this.categoryRepository.find({
      where: whereCondition,
      relations: ['parentCategory'],
      order: { name: 'ASC' },
    });
  }
}
