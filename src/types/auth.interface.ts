export type UserRole = 'superadmin' | 'party-admin';

export interface LoginCredentials {
  readonly email: string
  readonly password: string
}

export interface AuthenticatedSuperadmin {
  readonly id: number
  readonly name: string
  readonly email: string
}

export interface AuthenticatedUser {
  readonly id: number
  readonly name: string
  readonly email: string
  readonly role: UserRole
  readonly partyId: number | null
  readonly partyName: string | null
}
