// Local moderation shared by the UI and authoritative care validation.
// This is a maintained denylist, not a guarantee of detecting every abusive phrase.
const severe=['nigger','nigga','chink','gook','wetback','spic','kike','faggot','fag','tranny','retard','coon','heilhitler','whitepower','siegheil','killalljews','killallblacks','nazista','neonazi','nazism','nazi','hitler','negr imundo'.replace(/ /g,''),'macaco preto'.replace(/ /g,''),'voltaprasenzala','morteaosnegros','chinesporco','fuckyou','fuckoff'];
const profanity=['fuck','fucker','motherfucker','shit','bitch','cunt','asshole','dick','pussy','cock','bastard','puta','puto','caralho','porra','foda','foder','fodase','buceta','cacete','cuzao','arrombado','viado','viadinho','paneleiro','maricon','putain'];
const chinese=['黑鬼','黑奴','支那','死基佬','傻逼','傻屄','操你妈','草泥马','肏','妈的','婊子','狗娘养'];
const confusables:Record<string,string>={'а':'a','е':'e','о':'o','р':'p','с':'c','х':'x','у':'y','і':'i','ј':'j','ѕ':'s','к':'k','т':'t','м':'m','н':'h','Α':'a','α':'a','ο':'o','ι':'i','κ':'k','τ':'t','0':'o','1':'i','3':'e','4':'a','5':'s','7':'t','8':'b','@':'a','$':'s','!':'i'};
export function nameIssue(input:unknown):'Invalid name'|'Offensive name'|null{
 if(typeof input!=='string'||!input.trim()||[...input.trim()].length>24||/[<>\p{Cc}\p{Cf}]/u.test(input))return 'Invalid name';
 const normalized=input.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/./gu,c=>confusables[c]??c);
 const compact=normalized.replace(/[^\p{L}\p{N}]/gu,'');
 const tokens=normalized.split(/[^\p{L}\p{N}]+/u);
 const collapsed=compact.replace(/(.)\1+/gu,'$1');
 const folded=(s:string)=>s.replace(/(.)\1+/g,'$1');
 if(chinese.some(t=>compact.includes(t))||[...severe,...profanity].some(t=>compact===t||tokens.includes(t)||collapsed===folded(t)))return 'Offensive name';
 // Longer slurs/phrases stay blocked when decorated with prefixes or digits.
 if(severe.filter(t=>t.length>=5).some(t=>compact.includes(t)||collapsed.includes(folded(t))))return 'Offensive name';
 return null;
}
export function assertAllowedName(name:unknown){const issue=nameIssue(name);if(issue)throw Error(issue);}
