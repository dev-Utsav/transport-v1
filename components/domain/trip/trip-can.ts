/** What the signed-in person may do on a trip screen (from their permissions). */
export type TripCan = {
  manage: boolean;
  load: boolean;
  advance: boolean;
  deliver: boolean;
  openChallans: boolean;
  openParties: boolean;
};
