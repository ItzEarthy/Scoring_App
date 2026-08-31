declare module "glicko2" {
  export interface Glicko2Player {
    getRating(): number;
    getRd(): number;
    getVol(): number;
    predict(opponent: Glicko2Player): number;
  }

  export interface Glicko2Settings {
    tau?: number;
    rating?: number;
    rd?: number;
    vol?: number;
  }

  export type Glicko2Match = [Glicko2Player, Glicko2Player, number];

  export class Glicko2 {
    constructor(settings?: Glicko2Settings);
    makePlayer(rating?: number, rd?: number, vol?: number): Glicko2Player;
    updateRatings(matches: Glicko2Match[]): void;
    getPlayers(): Glicko2Player[];
    predict(p1: Glicko2Player, p2: Glicko2Player): number;
  }
}
