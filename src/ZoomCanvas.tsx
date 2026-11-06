import {useEffect,useRef,type ReactNode} from 'react';
import {TransformWrapper,TransformComponent,type ReactZoomPanPinchRef} from 'react-zoom-pan-pinch';
import {useReducedMotion} from 'motion/react';
import {Focus,Maximize2,Minus,Plus} from 'lucide-react';
import {Button} from '@/components/ui/button';
export default function ZoomCanvas({children,focusId,interactionLocked=false}:{children:ReactNode;focusId?:string;interactionLocked?:boolean}){
 const controls=useRef<ReactZoomPanPinchRef>(null),reduce=useReducedMotion();
 const focusCard=()=>{if(focusId)void controls.current?.zoomToElement(focusId,6,reduce?0:220);};
 useEffect(()=>{const frame=requestAnimationFrame(()=>{if(focusId)void controls.current?.zoomToElement(focusId,6,reduce?0:220);else controls.current?.resetTransform(0);});return()=>cancelAnimationFrame(frame);},[focusId,reduce]);
 return <TransformWrapper ref={controls} initialScale={1} minScale={.5} maxScale={12} wheel={{step:.1,disabled:interactionLocked}} panning={{activationKeys:['Space'],disabled:interactionLocked}} doubleClick={{disabled:true}}>
  {({zoomIn,zoomOut,resetTransform})=><><div className="canvas-zoom-bar"><span>Scroll to zoom · Space + drag to pan</span><div><Button variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={()=>zoomOut(.3,reduce?0:180)}><Minus/></Button><Button variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={()=>zoomIn(.3,reduce?0:180)}><Plus/></Button><span className="control-divider"/><Button variant="ghost" size="sm" onClick={()=>resetTransform(reduce?0:180)}><Maximize2/>Full page</Button>{focusId&&<Button variant="secondary" size="sm" onClick={focusCard}><Focus/>Focus card</Button>}</div></div><div className="canvas-viewport"><TransformComponent wrapperStyle={{width:'100%',height:'100%'}} contentStyle={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>{children}</TransformComponent></div></>}
 </TransformWrapper>;
}
