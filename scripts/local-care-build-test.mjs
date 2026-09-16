import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const files=readdirSync('dist/assets').filter(name=>name.endsWith('.js'));
assert(files.length,'Build the app first');
for(const file of files){
 const content=readFileSync('dist/assets/'+file,'utf8');
 for(const marker of ['Local payment lab','/api/care?op=','rattery-local-payment:','/api/colony'])assert(!content.includes(marker),'Local-only payment UI leaked into production bundle: '+file);
}
console.log('PASS production build excludes local payment lab, its API client and payment journal');
