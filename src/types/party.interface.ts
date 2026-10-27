export interface CreatePartyInput {
  readonly name: string
  readonly description: string | null
  readonly imageUrl: string | null
  readonly abbreviation: string | null
  readonly color: string | null
  readonly seats: number | null
  readonly leader: string | null
  readonly isActive: boolean
}

export interface Party extends CreatePartyInput {
  readonly id: number
  readonly createdAt: string
  readonly updatedAt: string
}

export type UpdatePartyInput = Partial<CreatePartyInput>;
