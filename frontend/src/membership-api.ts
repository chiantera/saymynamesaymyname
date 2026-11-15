import {cloudRequest} from './cloud';

export interface Member { user_id: string; alias: string; is_self: boolean; can_contact: boolean; blocked_by_me: boolean }
export interface Invitation { id: string; email: string; version: number; status: string; expires_at: string | null; approved: boolean; approval_count: number; member_count: number; my_approval: boolean }
export interface Space {
  id: string; label: string; membership_version: number;
  mine: {alias: string; generation: number; muted: boolean; archived: boolean};
  members: Member[]; invitations: Invitation[];
}
export interface Workspace { relationships: Space[]; blocks: {user_id: string; alias: string}[] }
export interface InvitePreview { label: string; members: string[]; expires_at: string }

export const membership = {
  workspace: () => cloudRequest('/relationships/workspace', 'GET', undefined) as Promise<Workspace>,
  action: (action: string, args: Record<string, unknown>) => cloudRequest('/relationships/action', 'POST', {action, args}),
  preview: (token: string) => cloudRequest('/relationships/preview', 'POST', {token}) as Promise<InvitePreview>,
};
