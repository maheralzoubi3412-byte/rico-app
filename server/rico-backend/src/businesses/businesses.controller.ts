import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BusinessesService } from './businesses.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { ListBusinessDto } from './dto/list-business.dto';
import { SessionGuard } from '../common/guards/session.guard';
import { RequireApp } from '../common/decorators/require-app.decorator';

@Controller('businesses')
export class BusinessesController {
  constructor(private readonly businessesService: BusinessesService) {}

  // Writes are owner-app only — Business rows are platform-owned master
  // data; vendors never edit them directly, only claim + manage their own
  // Product/Discount/Deal under one via /vendor/*.
  @UseGuards(SessionGuard)
  @RequireApp('owner')
  @Post()
  create(@Body() dto: CreateBusinessDto) {
    return this.businessesService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListBusinessDto) {
    return this.businessesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.businessesService.findOne(id);
  }

  @UseGuards(SessionGuard)
  @RequireApp('owner')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBusinessDto) {
    return this.businessesService.update(id, dto);
  }

  @UseGuards(SessionGuard)
  @RequireApp('owner')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.businessesService.remove(id);
  }
}
