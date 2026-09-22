export interface LoginCredentials {
  readonly email: string
  readonly password: string
}

export interface AuthenticatedSuperadmin {
  readonly id: number
  readonly name: string
  readonly email: string
}
