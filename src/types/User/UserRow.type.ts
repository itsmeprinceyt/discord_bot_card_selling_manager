import { RowDataPacket } from "mysql2";

export interface UserRow extends RowDataPacket {
  id: string;
  google_id: string;
  email: string;
  name: string;
  image: string | null;
  is_admin: 0 | 1;
  created_at: string;
  updated_at: string;
}
