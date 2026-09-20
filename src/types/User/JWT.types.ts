import { RowDataPacket } from "mysql2";
import { JWT } from "next-auth/jwt";

export interface MyJWT extends JWT, RowDataPacket {
  id?: string;
  name?: string;
  email?: string;
  image?: string | null;
  is_admin?: boolean;
}

export interface SessionUserClient {
  name: string;
  email: string;
  image: string | null;
  is_admin: boolean;
}
