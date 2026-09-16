export type PlayActivity={toy:number;kind:'foraging'|'ball'|'chewing'|'wheel'|'digging';since:number;until:number};
export const playActivity=new Map<string,PlayActivity>();
export const toyVisits=new Map<number,number>();
export function resetPlay(){playActivity.clear();toyVisits.clear();}
