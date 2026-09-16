import fontkit from '@pdf-lib/fontkit';
type Layout=(text:string,features?:Parameters<fontkit.Font['layout']>[1],script?:string,language?:string,direction?:string)=>ReturnType<fontkit.Font['layout']>;
export const documentFontkit={
  create(bytes:Uint8Array){
    const font=fontkit.create(bytes);
    const layout=font.layout.bind(font) as Layout;
    const cache=new Map<string,ReturnType<Layout>>();
    font.layout=(text,features)=>{
      const direction=Array.from(text).some(character=>/\p{Script=Arabic}/u.test(character)&&/\p{Letter}/u.test(character)) ? 'rtl' : 'ltr';
      if(features!==undefined)return layout(text,features,undefined,undefined,direction);
      let run=cache.get(text);
      if(!run){run=layout(text,features,undefined,undefined,direction);cache.set(text,run);}
      return run;
    };
    return font;
  },
};
