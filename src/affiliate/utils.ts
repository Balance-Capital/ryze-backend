// Tier 1 - Bronze 30%
// Tier 2 - Silver 40%
// Tier 3 - Gold 50%
// Tier 4 - Platinum 70%
// Tier 5 - Diamond 100%

// Tier 1 : 0 Qualified referees
// Tier 2 : 50 Qualified referees
// Tier 3 : 100 Qualified referees
// Tier 4 : 150 Qualified referees
// Tier 5 : 250 Qualified referees

export enum TIER {
  Bronze = 1,
  Silver = 2,
  Gold = 3,
  Platinum = 4,
  Diamond = 5,
}

// TODO Need to add constant
// export const getTier = (qualifiedRefereeCount: number, totalTradingVolume: number) => {
//     let tier = TIERS.LOW.value;

//     if (qualifiedRefereeCount >= TIERS.HIGH.eligible_referee || totalTradingVolume >= TIERS.HIGH.eligible_volume) {
//       // Tier 3
//       tier = TIERS.HIGH.value;
//     } else if (qualifiedRefereeCount >= TIERS.MEDIUM.eligible_referee) {
//       // Tier 2
//       tier = TIERS.MEDIUM.value;
//     }

//     return tier;
// }
