export interface PartyAdminAccount {
  readonly id: number
  readonly partyId: number
  readonly name: string
  readonly email: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CreatePartyAdminInput {
  readonly name: string
  readonly email: string
  readonly password: string
}

export type UpdatePartyAdminInput = Partial<CreatePartyAdminInput>;
