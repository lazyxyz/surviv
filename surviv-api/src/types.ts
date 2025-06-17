export interface Crate {
  to: string;
  tier: number;
  amount: number;
  salt: string;
  expiry: number;
}

export interface CrateClaim extends Document {
  crate: Crate;
  signature: string;
  rank: number;
  teamMode: boolean;
  gameId: number;
  createdAt: Date;
}