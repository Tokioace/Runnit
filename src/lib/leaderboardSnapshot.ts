/** Read only the snapshot belonging to the current account, query and refresh. */
export function currentLeaderboardSnapshot<T extends {key:string}>(snapshot:T|null,key:string):T|null {
  return snapshot?.key===key?snapshot:null;
}
