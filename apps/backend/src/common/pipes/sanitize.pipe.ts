import { PipeTransform, Injectable, ArgumentMetadata } from '@nestjs/common';
import { sanitizeInput } from '../utils/sanitize.util.js';

@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (
      metadata.type === 'body' ||
      metadata.type === 'query' ||
      metadata.type === 'param'
    ) {
      return sanitizeInput(value);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return value;
  }
}
