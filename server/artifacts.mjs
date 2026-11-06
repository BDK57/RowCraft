import path from 'node:path';
import fs from 'node:fs/promises';

export async function downloadableArtifact(local,id,state,kind){
  if(!/^[a-f0-9-]{36}$/.test(id)||state?.status!=='complete')return null;
  const files={ai:['ai','output/personalized-covers.ai'],pdf:['pdf',state.result?.ai?'output/personalized-covers.pdf':'covers.pdf'],archive:['archive','covers.zip']};
  const entry=files[kind];if(!entry||!state.result?.[entry[0]])return null;
  const file=path.join(local,'jobs',id,entry[1]);
  try{const stat=await fs.stat(file);return stat.isFile()&&stat.size>0?file:null;}catch{return null;}
}
