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
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { responseMessage } from '../common/utilities/responseMessages.utils';

@ApiTags('admin-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('master_admin')
@Controller('admin-users')
export class AdminUserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new master_admin user (Master Admin only)',
  })
  @ApiResponse({ status: 201, description: 'Admin user created successfully' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(@Body() createUserDto: CreateUserDto) {
    createUserDto.role = 'master_admin';
    createUserDto.tenantId = undefined;
    const data = await this.userService.create(createUserDto, true);
    return { data, message: responseMessage.addMessage('Admin User') };
  }

  @Get()
  @ApiOperation({ summary: 'Get all master_admin users (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'List of admin users' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findAll() {
    const data = await this.userService.findAll(undefined, 'master_admin');
    return { data, message: responseMessage.fetchMessage('Admin Users') };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get admin user by ID (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Admin user details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const data = await this.userService.findOne(id);
    if (data.role !== 'master_admin') {
      return { data: null, message: 'Admin user not found' };
    }
    return { data, message: responseMessage.fetchMessage('Admin User') };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update admin user (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Admin user updated successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    delete updateUserDto.role;
    const data = await this.userService.update(id, updateUserDto);
    return { data, message: responseMessage.updateMessage('Admin User') };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete admin user (Master Admin only)' })
  @ApiResponse({ status: 200, description: 'Admin user deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    const data = await this.userService.remove(id);
    return { data, message: responseMessage.deleteMessage('Admin User') };
  }
}
