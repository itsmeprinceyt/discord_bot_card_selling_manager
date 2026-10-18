export type GameType = "SOFI" | "KARUTA";

export const GAME_LABEL: Record<GameType, string> = {
  SOFI: "SOFI · Silver & Wist",
  KARUTA: "KARUTA · Gold & Tickets",
};

export function getValidCurrencies(gameType: GameType): string[] {
  return gameType === "SOFI" ? ["silver", "wist"] : ["gold", "tickets"];
}
