export const REACTION_EMOJIS = ['🔥', '😂', '👏', '😤'] as const;
export type ReactionEmoji = typeof REACTION_EMOJIS[number];

export interface PredictionReaction {
  id: string;        // `${reactorId}_${predictionId}`
  predictionId: string;
  groupId: string;
  reactorId: string;
  emoji: ReactionEmoji;
  createdAt: number;
}

/** Merr numërimin { emoji → count } dhe nëse unë e kam dhënë atë */
export interface ReactionSummary {
  emoji: ReactionEmoji;
  count: number;
  myReaction: boolean;
}