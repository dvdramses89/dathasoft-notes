import { Module } from '@nestjs/common';
import { DocumentTagsController } from './document-tags.controller';
import { TagsController } from './tags.controller';
import { TagsService } from './tags.service';

@Module({
  controllers: [TagsController, DocumentTagsController],
  providers: [TagsService],
})
export class TagsModule {}
