import { instagramBatchCapability } from "./batch.js";
import { instagramLoginCapability } from "./login.js";
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
  instagramFollowCapability,
  instagramLikeCapability,
  instagramUnfollowCapability,
  instagramUnlikeCapability,
} from "./write.js";

export const instagramCapabilities = [
  instagramLoginCapability,
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
  instagramFollowCapability,
  instagramUnfollowCapability,
  instagramBatchCapability,
] as const;
