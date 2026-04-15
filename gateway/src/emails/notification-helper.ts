import { WorkspaceRepository } from '../../shared/database/repositories/workspace-repository';
import { UserRepository } from '../../shared/database/repositories/user-repository';
import { createLogger } from '../../shared/logger/logger';
import type { EmailRecipient } from './sender';

const logger = createLogger('email-notification');
const workspaceRepo = new WorkspaceRepository();
const userRepo = new UserRepository();

export async function resolveWorkspaceRecipient(orgId: string): Promise<EmailRecipient | null> {
  try {
    const workspace = await workspaceRepo.findById(orgId);
    if (!workspace) return null;

    const user = await userRepo.findById(workspace.owner_id);
    if (!user?.email) return null;

    return { email: user.email, name: user.name, locale: 'en' };
  } catch (err) {
    logger.warn('Failed to resolve workspace recipient', { orgId, error: (err as Error).message });
    return null;
  }
}
