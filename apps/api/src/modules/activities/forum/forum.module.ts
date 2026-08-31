import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Forum, ForumSchema } from './schemas/forum.schema';
import { Discussion, DiscussionSchema } from './schemas/discussion.schema';
import { Post, PostSchema } from './schemas/post.schema';
import { ForumService } from './forum.service';
import { ForumController } from './forum.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Forum.name, schema: ForumSchema },
      { name: Discussion.name, schema: DiscussionSchema },
      { name: Post.name, schema: PostSchema },
    ]),
  ],
  controllers: [ForumController],
  providers: [ForumService],
  exports: [ForumService],
})
export class ForumModule {}
