import {FileSpreadsheet,ScanText,FileOutput} from 'lucide-react';

/** One definition for desktop navigation and mobile workflow controls. */
export const workflowSteps = [
 {id:'data',label:'People',description:'Choose your Excel rows',icon:FileSpreadsheet},
 {id:'design',label:'Card & fields',description:'Connect columns to the card',icon:ScanText},
 {id:'export',label:'Review & export',description:'Check and download artwork',icon:FileOutput},
] as const;
export type WorkflowView = typeof workflowSteps[number]['id'];
