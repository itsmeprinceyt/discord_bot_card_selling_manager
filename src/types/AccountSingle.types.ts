import { GameType } from "../utils/Dashboard/accountLabels";

export interface AccountSingleType {
  id: string;
  name: string;
  game_type: GameType;
  created_at: string;
}

export interface StatsSingle {
  activeBuyers: number;
  totalCards: number;
  completedToday: number;
  completedLast30Days: number;
}
