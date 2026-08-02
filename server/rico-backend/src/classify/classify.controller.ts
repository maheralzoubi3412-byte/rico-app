import { Body, Controller, Post } from '@nestjs/common';
import { ClassifyService } from './classify.service';
import { ClassifyRequestDto } from './dto/classify-request.dto';

@Controller()
export class ClassifyController {
  // Exposed at POST /classify (the live groq-proxy Worker exposed this at
  // its root path instead — Flutter's base URL constant is updated to
  // append `/classify` as part of this rewrite).
  constructor(private readonly classifyService: ClassifyService) {}

  @Post('classify')
  classify(@Body() dto: ClassifyRequestDto) {
    return this.classifyService.classify(dto);
  }
}
