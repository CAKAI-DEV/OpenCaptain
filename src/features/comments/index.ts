export { commentsRoutes } from './comments.routes';
export {
  createComment,
  deleteComment,
  getComment,
  listComments,
  parseMentions,
  resolveMentions,
} from './comments.service';
export type { CommentResult, CreateCommentInput, ParsedMention } from './comments.types';
