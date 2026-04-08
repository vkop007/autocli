import { instagramBatchCapability } from "./batch.js";
import { instagramLoginCapability, instagramStatusCapability } from "./login.js";
import {
  instagramFollowersCapability,
  instagramFollowingCapability,
  instagramMediaIdCapability,
  instagramPostsCapability,
  instagramProfileIdCapability,
  instagramSearchCapability,
  instagramStoriesCapability,
} from "./read.js";
import { instagramPostCapability } from "./post.js";
import {
  instagramCommentCapability,
  instagramDeleteCapability,
  instagramDeleteCommentCapability,
  instagramFollowCapability,
  instagramLikeCapability,
  instagramUnfollowCapability,
  instagramUnlikeCapability,
} from "./write.js";

export const instagramCapabilities = [
  instagramLoginCapability,
  instagramStatusCapability,
  instagramPostCapability,
  instagramSearchCapability,
  instagramPostsCapability,
  instagramStoriesCapability,
  instagramFollowersCapability,
  instagramFollowingCapability,
  instagramMediaIdCapability,
  instagramProfileIdCapability,
  instagramLikeCapability,
  instagramUnlikeCapability,
  instagramCommentCapability,
  instagramDeleteCapability,
  instagramDeleteCommentCapability,
  instagramFollowCapability,
  instagramUnfollowCapability,
  instagramBatchCapability,
] as const;
