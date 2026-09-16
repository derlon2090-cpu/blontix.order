import bidiFactory from 'bidi-js';
const bidi=bidiFactory();
// Order directional runs, keeping Arabic logical text intact for fontkit shaping.
// Reversing the entire string corrupts Latin names and multi-digit numbers.
export function pdfTextRuns(text:string){
  if(!text)return [];
  const levels=bidi.getEmbeddingLevels(text,'rtl');
  const mirrors=bidi.getMirroredCharactersMap(text,levels);
  const runs:{text:string;level:number}[]=[];
  const owners:number[]=[];
  for(let i=0;i<text.length;i++){
    const level=levels.levels[i];
    if(i===0||level!==levels.levels[i-1])runs.push({text:'',level});
    owners[i]=runs.length-1;
    runs[runs.length-1].text+=mirrors.get(i)||text[i];
  }
  const indices=Array.from({length:text.length},(_,i)=>i);
  for(const [start,end] of bidi.getReorderSegments(text,levels)){
    const reversed=indices.slice(start,end+1).reverse();
    indices.splice(start,reversed.length,...reversed);
  }
  const seen=new Set<number>();
  return indices.flatMap(index=>{
    const owner=owners[index];
    if(seen.has(owner))return [];
    seen.add(owner);
    const run=runs[owner];
    return [run.level%2 && !/\p{Script=Arabic}/u.test(run.text) ? Array.from(run.text).reverse().join('') : run.text];
  });
}
