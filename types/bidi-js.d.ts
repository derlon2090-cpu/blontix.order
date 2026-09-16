declare module 'bidi-js' {
  type Levels={levels:Uint8Array;paragraphs:{start:number;end:number;level:number}[]};
  export default function bidiFactory():{
    getEmbeddingLevels(text:string,direction:'rtl'|'ltr'):Levels;
    getReorderSegments(text:string,levels:Levels):[number,number][];
    getMirroredCharactersMap(text:string,levels:Levels):Map<number,string>;
  };
}
