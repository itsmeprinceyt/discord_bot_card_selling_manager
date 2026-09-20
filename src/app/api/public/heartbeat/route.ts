import { NextResponse } from "next/server";
import { runHeartbeat } from "../../../../utils/Heartbeat/Heartbeat.util";
import { HeartbeatResponseDTO } from "../../../../types/Heartbeat.types";

/**
 * @brief Health check endpoint to keep MySQL and Redis connections active.
 *
 * @description
 * Thin HTTP wrapper around `runHeartbeat()`. All logic lives in the
 * utility so it can be reused by cron jobs, CLI scripts, or other routes.
 */
export async function GET(): Promise<NextResponse> {
  const result = await runHeartbeat();

  return NextResponse.json<HeartbeatResponseDTO>(result, {
    status: result.success ? 200 : 500,
  });
}
