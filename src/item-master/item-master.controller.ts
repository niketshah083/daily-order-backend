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
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
} from '@nestjs/swagger';
import { ItemMasterService } from './item-master.service';
import { CreateItemMasterDto } from './dto/create-item-master.dto';
import { UpdateItemMasterDto } from './dto/update-item-master.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SubscriptionGuard } from '../subscription/guards/subscription.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../common/decorators/tenant.decorator';
import { FileUtils } from '../common/utilities/file.utils';
import { FileConstants } from '../common/constants/file.constant';
import { CommonUtils } from '../common/utilities/common.utils';
import { responseMessage } from '../common/utilities/responseMessages.utils';

@ApiTags('item-master')
@Controller('item-master')
@UseGuards(SubscriptionGuard)
export class ItemMasterController {
  constructor(private readonly itemMasterService: ItemMasterService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Create a new item (Super Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Item created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseInterceptors(
    AnyFilesInterceptor(
      FileUtils.multerConfig([
        FileConstants.FILE_TYPE.IMAGE,
        FileConstants.FILE_TYPE.VIDEO,
      ]),
    ),
  )
  async create(
    @Body() createItemMasterDto: CreateItemMasterDto,
    @TenantId() tenantId: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      const data = await this.itemMasterService.create(
        createItemMasterDto,
        tenantId,
        files,
      );
      return { data, message: responseMessage.addMessage('Item') };
    } finally {
      // Clean up uploaded files
      if (files && files.length > 0) {
        CommonUtils.removeFiles(files);
      }
    }
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all items (filtered by tenant)' })
  @ApiResponse({ status: 200, description: 'List of items with signed URLs' })
  async findAll(@TenantId() tenantId: number) {
    const data = await this.itemMasterService.findAll(tenantId);
    return { data, message: responseMessage.fetchMessage('Items') };
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get item by ID' })
  @ApiResponse({ status: 200, description: 'Item details with signed URLs' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.itemMasterService.findOne(id, tenantId);
    return { data, message: responseMessage.fetchMessage('Item') };
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Update item (Super Admin only)' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 200, description: 'Item updated successfully' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @UseInterceptors(
    AnyFilesInterceptor(
      FileUtils.multerConfig([
        FileConstants.FILE_TYPE.IMAGE,
        FileConstants.FILE_TYPE.VIDEO,
      ]),
    ),
  )
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateItemMasterDto: UpdateItemMasterDto,
    @TenantId() tenantId: number,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      const data = await this.itemMasterService.update(
        id,
        updateItemMasterDto,
        tenantId,
        files,
      );
      return { data, message: responseMessage.updateMessage('Item') };
    } finally {
      // Clean up uploaded files
      if (files && files.length > 0) {
        CommonUtils.removeFiles(files);
      }
    }
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin')
  @ApiOperation({ summary: 'Delete item (Super Admin only)' })
  @ApiResponse({ status: 200, description: 'Item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Item not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @TenantId() tenantId: number,
  ) {
    const data = await this.itemMasterService.remove(id, tenantId);
    return { data, message: responseMessage.deleteMessage('Item') };
  }
}
