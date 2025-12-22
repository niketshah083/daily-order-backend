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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TenantService } from './tenant.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { responseMessage } from '../common/utilities/responseMessages.utils';

@ApiTags('tenants')
@Controller('tenants')
export class TenantController {
  constructor(private readonly tenantService: TenantService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('master_admin')
  @ApiOperation({ summary: 'Create a new tenant (Master Admin only)' })
  @ApiResponse({ status: 201, description: 'Tenant created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createTenantDto: CreateTenantDto) {
    const data = await this.tenantService.create(createTenantDto);
    return { data, message: responseMessage.addMessage('Tenant') };
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('master_admin')
  @ApiOperation({ summary: 'Get all tenants (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'List of all tenants' })
  async findAll() {
    const data = await this.tenantService.findAll();
    return { data, message: responseMessage.fetchMessage('Tenants') };
  }

  @Get('active')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('master_admin')
  @ApiOperation({ summary: 'Get all active tenants (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'List of active tenants' })
  async findActive() {
    const data = await this.tenantService.findActiveTenants();
    return { data, message: responseMessage.fetchMessage('Active tenants') };
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('master_admin')
  @ApiOperation({ summary: 'Get tenant by ID (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant details' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.tenantService.findOne(id);
    return { data, message: responseMessage.fetchMessage('Tenant') };
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('master_admin')
  @ApiOperation({ summary: 'Update tenant (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateTenantDto: UpdateTenantDto,
  ) {
    const data = await this.tenantService.update(id, updateTenantDto);
    return { data, message: responseMessage.updateMessage('Tenant') };
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('master_admin')
  @ApiOperation({ summary: 'Delete tenant (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Tenant deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tenant not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const data = await this.tenantService.remove(id);
    return { data, message: responseMessage.deleteMessage('Tenant') };
  }
}
