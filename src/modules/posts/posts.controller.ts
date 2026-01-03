import { Controller, Get, Post, Param, HttpException, HttpStatus } from '@nestjs/common';
import { PostsService } from './posts.service';

@Controller()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * Get post info by tweet ID
   * GET /posts/:tweetId
   */
  @Get('posts/:tweetId')
  async getPost(@Param('tweetId') tweetId: string) {
    const post = await this.postsService.getPostByTweetId(tweetId);

    if (!post) {
      throw new HttpException(
        { success: false, error: 'Post not found' },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      success: true,
      data: post,
    };
  }

  /**
   * Claim reward for a post
   * POST /claim/:tweetId
   */
  @Post('claim/:tweetId')
  async claimReward(@Param('tweetId') tweetId: string) {
    const result = await this.postsService.claimReward(tweetId);

    if (!result.success) {
      throw new HttpException(
        { success: false, error: result.error },
        HttpStatus.BAD_REQUEST,
      );
    }

    return result;
  }

  /**
   * Get claim status
   * GET /claim/:tweetId/status
   */
  @Get('claim/:tweetId/status')
  async getClaimStatus(@Param('tweetId') tweetId: string) {
    const status = await this.postsService.getClaimStatus(tweetId);

    return {
      success: true,
      data: status,
    };
  }
}
