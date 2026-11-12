import {motion,useReducedMotion} from 'motion/react';

export function IllustratorBadge({connected}:{connected:boolean|null}){
 const reduced=useReducedMotion();
 const label=connected===null?'Checking Illustrator':connected?'Local Illustrator':'Renderer unavailable';
 return <span className={`renderer-status ${connected?'is-connected':'is-offline'}`} role="status" aria-label={connected?'Illustrator connected':label}>
  <span className="connection-indicator" aria-hidden="true">{connected&&!reduced&&<motion.span className="connection-pulse" initial={{opacity:.6,scale:1}} animate={{opacity:[.6,0],scale:[1,2.4]}} transition={{duration:1.8,ease:'easeOut',repeat:Infinity}}/>}<span className="connection-core"/></span>{label}
 </span>;
}
