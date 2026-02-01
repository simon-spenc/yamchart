import { useAuthContext } from '../providers/AuthProvider';

export function useAuth() {
  const { session, loading, client, refresh } = useAuthContext();

  return {
    user: session?.user ?? null,
    orgs: session?.orgs ?? [],
    currentOrg: session?.currentOrg ?? null,
    currentRole: session?.currentRole ?? null,
    loading,
    isAuthenticated: !!session?.user,

    // Auth actions
    signIn: client.signIn.bind(client),
    signUp: client.signUp.bind(client),
    signInWithGoogle: () => client.signInWithOAuth('google'),
    signInWithGitHub: () => client.signInWithOAuth('github'),
    signOut: client.signOut.bind(client),

    // Org actions
    createOrg: client.createOrg.bind(client),
    switchOrg: async (orgId: string) => {
      await client.switchOrg(orgId);
      await refresh();
    },

    // Invitation actions
    inviteUser: client.inviteUser.bind(client),
    acceptInvitation: client.acceptInvitation.bind(client),

    // Refresh session
    refresh,
  };
}
