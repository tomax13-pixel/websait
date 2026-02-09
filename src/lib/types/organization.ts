// Organization types for multi-tenant SaaS

export interface Organization {
    id: string;
    name: string;
    join_code: string;
    plan: 'free' | 'pro';
    member_limit: number;
    billing_email?: string;
    stripe_customer_id?: string;
    created_by?: string;
    created_at: string;
}

export interface OrganizationMember {
    id: string;
    organization_id: string;
    user_id: string;
    role: 'owner' | 'admin' | 'member';
    created_at: string;
}

export interface Profile {
    user_id: string;
    organization_id?: string;
    role: 'owner' | 'admin' | 'member';
    display_name: string;
    created_at: string;
}

// Permissions helper
export const canManageOrganization = (role: string) => role === 'owner';
export const canManageContent = (role: string) => ['owner', 'admin'].includes(role);
export const isMember = (role: string) => ['owner', 'admin', 'member'].includes(role);
