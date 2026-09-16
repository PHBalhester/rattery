import {compareHabitats} from './habitatComparison';
self.onmessage=event=>{try{self.postMessage({result:compareHabitats(event.data)});}catch(error){self.postMessage({error:error instanceof Error?error.message:'Comparison failed'});}};
