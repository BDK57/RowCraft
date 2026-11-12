import {motion,useReducedMotion} from 'motion/react';
import {Archive,ArrowRight,BookOpen,Check,ChevronRight,HelpCircle,LockKeyhole,FileSpreadsheet,Layers,X} from 'lucide-react';
import {AppBrand} from '@/components/app-brand';
import {Button} from '@/components/ui/button';
import {Sidebar,SidebarContent,SidebarFooter,SidebarGroup,SidebarGroupContent,SidebarGroupLabel,SidebarHeader,SidebarMenu,SidebarMenuButton,SidebarMenuItem,useSidebar} from '@/components/ui/sidebar';
import {workflowSteps,type WorkflowView} from '@/lib/workflow';

type AppSidebarProps={view:WorkflowView;complete:readonly (boolean|undefined)[];peopleReady:boolean;ready:boolean;selectedCount:number;sectionMode?:boolean;onNavigate:(view:WorkflowView)=>void;onHelp:()=>void;onRequirements:()=>void};

export function AppSidebar({view,complete,peopleReady,ready,selectedCount,sectionMode=false,onNavigate,onHelp,onRequirements}:AppSidebarProps){
 const {isMobile,state,setOpenMobile}=useSidebar(),reduce=useReducedMotion();
 const expanded=isMobile||state==='expanded';
 function navigate(next:WorkflowView){onNavigate(next);if(isMobile)setOpenMobile(false);}
 return <Sidebar className="app-sidebar" collapsible="icon" data-expanded={expanded}>
  <SidebarHeader className="app-sidebar-header"><AppBrand/>{isMobile&&<Button variant="ghost" size="icon" aria-label="Close navigation" onClick={()=>setOpenMobile(false)}><X/></Button>}</SidebarHeader>
  <SidebarContent className="app-sidebar-content">
   <SidebarGroup><SidebarGroupLabel>Print workflow</SidebarGroupLabel><SidebarGroupContent><nav aria-label="Batch workflow"><SidebarMenu>
    {workflowSteps.map((step,index)=><SidebarMenuItem key={step.id}>
     <SidebarMenuButton className="app-workflow-link" size="lg" tooltip={step.label} aria-label={step.label} isActive={view===step.id} aria-current={view===step.id?'step':undefined} disabled={index===1&&!peopleReady||index===2&&!ready} onClick={()=>navigate(step.id)}>
      {view===step.id&&<motion.span className="app-nav-indicator" layoutId="workflow-active" transition={{duration:reduce?0:.18}}/>}
      <step.icon className="app-nav-icon" strokeWidth={1.6} aria-hidden="true"/>
      <motion.span className="app-nav-copy" initial={false} animate={{opacity:expanded?1:0,x:expanded?0:-4}} transition={{duration:reduce?0:.14,delay:expanded&&!reduce?.12:0}}><strong>{step.label}</strong><small>{step.description}</small></motion.span>
      {complete[index]?<Check className="app-nav-state" aria-label="Complete"/>:view===step.id?<ChevronRight className="app-nav-state" aria-hidden="true"/>:null}
     </SidebarMenuButton>
    </SidebarMenuItem>)}
   </SidebarMenu></nav></SidebarGroupContent></SidebarGroup>
   <div className="app-batch-summary"><div><FileSpreadsheet aria-hidden="true"/><span>Excel row</span><ArrowRight aria-hidden="true"/><Layers aria-hidden="true"/><span>Printed card</span></div><p>{selectedCount?`${selectedCount.toLocaleString()} ${sectionMode?'cards configured across sections':'people selected for this batch'}.`:'Choose your people to start a new print batch.'}</p></div>
  </SidebarContent>
  <SidebarFooter className="app-sidebar-footer"><SidebarMenu>
   <SidebarMenuItem><SidebarMenuButton tooltip="Batch history" aria-label="Batch history" onClick={()=>navigate('export')}><Archive aria-hidden="true"/><span>Batch history</span></SidebarMenuButton></SidebarMenuItem>
   <SidebarMenuItem><SidebarMenuButton tooltip="How it works" aria-label="How it works" onClick={()=>{onHelp();if(isMobile)setOpenMobile(false);}}><HelpCircle aria-hidden="true"/><span>How it works</span></SidebarMenuButton></SidebarMenuItem>
   <SidebarMenuItem><SidebarMenuButton tooltip="Template requirements" aria-label="Template requirements" onClick={()=>{onRequirements();if(isMobile)setOpenMobile(false);}}><BookOpen aria-hidden="true"/><span>Template requirements</span></SidebarMenuButton></SidebarMenuItem>
  </SidebarMenu><div className="app-local-note"><LockKeyhole aria-hidden="true"/><div><strong>Private by design</strong><p>Your files stay on this computer.</p></div></div></SidebarFooter>
 </Sidebar>;
}
