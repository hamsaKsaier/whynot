import bcrypt from 'bcryptjs';
import { query } from '../connection';

export async function seedAdminUser(
  email: string,
  password: string,
  name: string
): Promise<void> {
  const passwordHash = await bcrypt.hash(password, 10);

  // Upsert the admin user
  const [user] = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'super_admin')
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       role = 'super_admin'
     RETURNING id`,
    [email.trim().toLowerCase(), passwordHash, name]
  );

  // Ensure the admin has a workspace (requireAuth needs one)
  const workspaces = await query<{ id: string }>(
    `SELECT id FROM workspaces WHERE owner_id = $1 LIMIT 1`,
    [user.id]
  );

  if (workspaces.length === 0) {
    await query(
      `INSERT INTO workspaces (owner_id, name) VALUES ($1, $2)`,
      [user.id, `${name}'s Workspace`]
    );
  }
}
