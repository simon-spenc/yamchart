-- Enable RLS on all tables
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user is member of org
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.org_id = $1
    AND memberships.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check user's role in org
CREATE OR REPLACE FUNCTION get_org_role(org_id UUID)
RETURNS VARCHAR AS $$
BEGIN
  RETURN (
    SELECT role FROM memberships
    WHERE memberships.org_id = $1
    AND memberships.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: Check if user is org admin or owner
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM memberships
    WHERE memberships.org_id = $1
    AND memberships.user_id = auth.uid()
    AND memberships.role IN ('owner', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users policies
CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON users FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can view members of their orgs"
  ON users FOR SELECT
  USING (
    id IN (
      SELECT m2.user_id FROM memberships m1
      JOIN memberships m2 ON m1.org_id = m2.org_id
      WHERE m1.user_id = auth.uid()
    )
  );

-- Orgs policies
CREATE POLICY "Users can view orgs they belong to"
  ON orgs FOR SELECT
  USING (is_org_member(id));

CREATE POLICY "Admins can update their orgs"
  ON orgs FOR UPDATE
  USING (is_org_admin(id));

CREATE POLICY "Users can create orgs"
  ON orgs FOR INSERT
  WITH CHECK (true);

-- Memberships policies
CREATE POLICY "Users can view memberships of their orgs"
  ON memberships FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Admins can manage memberships"
  ON memberships FOR ALL
  USING (is_org_admin(org_id));

-- Projects policies
CREATE POLICY "Members can view projects"
  ON projects FOR SELECT
  USING (is_org_member(org_id));

CREATE POLICY "Admins can manage projects"
  ON projects FOR ALL
  USING (is_org_admin(org_id));

-- Invitations policies
CREATE POLICY "Admins can manage invitations"
  ON invitations FOR ALL
  USING (is_org_admin(org_id));

CREATE POLICY "Invited users can view their invitation"
  ON invitations FOR SELECT
  USING (email = auth.jwt()->>'email');

-- Audit logs policies
CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING (is_org_admin(org_id));

CREATE POLICY "System can insert audit logs"
  ON audit_logs FOR INSERT
  WITH CHECK (true);
