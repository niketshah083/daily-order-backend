import { Module, Global } from '@nestjs/common';
import { S3Service } from './services/s3.service';
import { TransformInterceptor } from './interceptors/response.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

@Global()
@Module({
  providers: [S3Service, TransformInterceptor, LoggingInterceptor],
  exports: [S3Service, TransformInterceptor, LoggingInterceptor],
})
export class CommonModule {}
