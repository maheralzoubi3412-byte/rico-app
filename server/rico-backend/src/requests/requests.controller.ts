import { Body, Controller, Post } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  // Public, unauthenticated — same trust model as POST /submit-deal. A
  // customer picking a product/deal in chat has no Rico account.
  @Post()
  create(@Body() dto: CreateRequestDto) {
    return this.requestsService.create(dto);
  }
}
