import { requireUser } from "@/lib/auth/guards";
import { requireOrganizationMember, listOrganizationTeam } from "@/services/organizations";
import TeamClient from "@/components/workspaces/team-client";
import { notFound } from "next/navigation";
export default async function TeamPage({ params }: { params: Promise<{ organizationId: string }> }) { const user = await requireUser(); const { organizationId } = await params; const member = await requireOrganizationMember(user.id, organizationId); if (!member) notFound(); const team = await listOrganizationTeam(user.id, organizationId); if (!team) notFound(); return <TeamClient organizationId={organizationId} currentRole={member.role} initialTeam={team.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email, role: m.role, status: m.status }))} />; }
