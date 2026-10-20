import { GameType } from "../utils/Dashboard/accountLabels";

export interface AccountItem {
  id: string;
  name: string;
  game_type: GameType;
  pending_count: number;
  isWarnIncoming: boolean;
}

export type SortOption = "az" | "pending";
