import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { WorkspaceRepository } from './workspace.repository';

@Injectable()
export class SupabaseIdentityService {
  private client?: SupabaseClient;
  constructor(private readonly repository: WorkspaceRepository) {}

  admin() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new ServiceUnavailableException(
        'Supabase authentication is not configured'
      );
    }
    return (this.client ||= createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    ));
  }

  async verify(accessToken: string) {
    // Auth's getUser validates the token with the project server. No client metadata grants roles.
    const { data, error } = await this.admin().auth.getUser(accessToken);
    if (error || !data.user || !data.user.email_confirmed_at) {
      throw new UnauthorizedException('Sign in again');
    }
    const identity = await this.repository.identity(data.user.id);
    if (!identity)
      throw new UnauthorizedException('An agency invitation is required');
    if (data.user.email)
      await this.repository.syncEmail(
        data.user.id,
        data.user.email.trim().toLowerCase()
      );
    return identity.id;
  }

  async invite(email: string) {
    const existing = await this.repository.findInvitedUser(email);
    if (existing) {
      const current = await this.admin().auth.admin.getUserById(
        existing.supabaseId!
      );
      if (current.error || !current.data.user?.email)
        throw new ServiceUnavailableException(
          'The existing identity cannot be verified'
        );
      const confirmedEmail = current.data.user.email.trim().toLowerCase();
      await this.repository.syncEmail(existing.supabaseId!, confirmedEmail);
      if (confirmedEmail === email) return existing.supabaseId!;
    }
    const { data, error } = await this.admin().auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: `${process.env.FRONTEND_URL}/auth/callback?next=/auth/set-password`,
      }
    );
    if (error || !data.user)
      throw new ServiceUnavailableException(
        'The invitation could not be sent. Check Auth email delivery and whether this address already exists in Supabase.'
      );
    return data.user.id;
  }
}
