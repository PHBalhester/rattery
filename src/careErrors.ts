/** Explicit public messages only. Never expose arbitrary server errors. */
export const CARE_ERRORS:Record<string,string>={
 'Rat busy or needs rest':'This rat is busy socializing, caring for pups, or needs rest. Wait a moment and try again. No tokens were burned.',
 'Cooldown active':'This action is on cooldown for this rat. Try another action or wait for the cooldown to end.',
 'Already satiated':'This rat already has full energy and does not need food or treats right now.',
 'Water unavailable or not needed':'This rat does not need water right now. Choose another rat or action.',
 'No acute stress to relieve':'This rat has no acute stress to relieve right now.',
 'Exploration unavailable':'This rat is not ready to play or explore yet.',
 'Adults only':'This action is only available for adult rats.',
 'Only owner may interact':'Only this rat’s owner can provide individual care.',
 'Ownership conflict':'This rat is owned by another wallet or has already been minted. Refresh its status.',
 'Rat unavailable':'This rat is no longer available. Select a living rat.',
 'Insufficient unreserved balance':'Your available RATTERY is below this action’s cost. Pending reservations also hold part of your balance. Cancel unused reservations and try again.',
 'Resolve pending actions first':'Resolve or cancel your pending actions before starting another one.',
 'Colony catching up':'The colony is catching up. Please wait a few seconds and try again.',
 'Balance unavailable':'Could not check your token balance. Please try again shortly.',
 'Wrong payment network':'Switch your wallet to Robinhood Chain and try again.',
 'Snake unavailable':'The snake cannot be activated right now. Check the population, protection and any active snake action.',
 'Offensive name':'Choose another name. Racist, hateful or offensive names are not allowed.',
 'Invalid name':'Please choose a valid rat name.',
};
export function publicCareError(message:string){return Object.prototype.hasOwnProperty.call(CARE_ERRORS,message)?message:undefined;}
