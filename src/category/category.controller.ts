import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../subscription/guards/subscription.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { responseMessage } from '../common/utilities/responseMessages.utils';

@ApiTags('categories')
@Controller('categories')
@UseGuards(SubscriptionGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a new category (Super Admin only)' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @Body() createCategoryDto: CreateCategoryDto,
    @TenantId() tenantId: number,
  ) {
    const data = await this.categoryService.create(createCategoryDto, tenantId);
    return { data, message: responseMessage.addMessage('Category') };
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({ status: 200, description: 'List of all categories' })
  async findAll(
    @Query('hierarchy') hierarchy: string,
    @TenantId() tenantId: number,
  ) {
    let data;
    if (hierarchy === 'true') {
      data = await this.categoryService.findAllWithHierarchy(tenantId);
    } else {
      data = await this.categoryService.findAll(tenantId);
    }
    return { data, message: responseMessage.fetchMessage('Categories') };
  }

  @Get('parents')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all parent categories' })
  @ApiResponse({ status: 200, description: 'List of parent categories' })
  async findAllParents(@TenantId() tenantId: number) {
    const data = await this.categoryService.findAllParentCategories(tenantId);
    return { data, message: responseMessage.fetchMessage('Parent categories') };
  }

  @Get('active')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all active categories' })
  @ApiResponse({ status: 200, description: 'List of active categories' })
  async findActive(@TenantId() tenantId: number) {
    const data = await this.categoryService.findActiveCategories(tenantId);
    return { data, message: responseMessage.fetchMessage('Active categories') };
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({ status: 200, description: 'Category details' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async findOne(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.categoryService.findOne(id, tenantId);
    return { data, message: responseMessage.fetchMessage('Category') };
  }

  @Get(':id/children')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get sub-categories by parent ID' })
  @ApiResponse({ status: 200, description: 'List of sub-categories' })
  async findChildren(@Param('id', ParseIntPipe) id: number) {
    const data = await this.categoryService.findByParent(id);
    return { data, message: responseMessage.fetchMessage('Sub-categories') };
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update category (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    const data = await this.categoryService.update(
      id,
      updateCategoryDto,
      tenantId,
    );
    return { data, message: responseMessage.updateMessage('Category') };
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete category (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(
    @TenantId() tenantId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const data = await this.categoryService.remove(id, tenantId);
    return { data, message: responseMessage.deleteMessage('Category') };
  }
}
