import { ONE_HOUR } from "../utils/TTL.util";
import { getDBName } from "../utils/ValueFetcher/getDBName.util";
import { getProduction } from "../utils/ValueFetcher/getProduction.util";

/**
 * @brief Centralized Redis key + TTL builder.
 *
 * @description
 * Every Redis entry the app writes should get its key and TTL from here
 * so namespacing and expiration stay consistent and auditable.
 */
export class RedisKeyService {
  static heartbeat(): { redis_key: string; redis_ttl: number } {
    const env = getProduction();
    const dbName = getDBName();
    return {
      redis_key: `${dbName}:heartbeat_last_check:${env}`,
      redis_ttl: ONE_HOUR,
    };
  }
}
