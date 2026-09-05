import { Controller, HttpCode, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MAX_AUDIO_BYTES } from './constants/transcribe.constants';
import { TranscribeService } from './transcribe.service';

@Controller()
export class TranscribeController {
  constructor(private readonly transcribeService: TranscribeService) {}

  // Multipart, not JSON — the body is a recorded audio clip, so this is the
  // one public endpoint that doesn't go through the global ValidationPipe's
  // DTO path. Multer keeps the file in memory (no disk writes on Render's
  // ephemeral filesystem); the size cap is enforced here rather than in the
  // service so an oversized upload is rejected before it's buffered.
  @Post('transcribe')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES, files: 1 } }))
  transcribe(@UploadedFile() audio?: Express.Multer.File) {
    return this.transcribeService.transcribe(audio);
  }
}
