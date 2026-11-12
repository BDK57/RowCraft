import type {Board,Template,Workbook,ArtworkSection,Mapping,Row} from '../src/lib/types';
import type {Card} from '../src/CardLoop';
import type {ValidPhoto} from './photos.mjs';
export function sectionCards(board:Board|undefined,box:ArtworkSection['box']|undefined):Card[];
export type SectionPlan={sections:(Omit<ArtworkSection,'mappings'|'labels'|'cardId'|'recordIds'|'photo'> & {sample:Card;slots:Card[];capacity:number;mappings:(Mapping & {index:number;label:string})[];photo:ValidPhoto|null;labels:{role:'heading'|'month';targetId:string;index:number;label:string;value:string;column?:number}[];records:Row[];pages:number})[];boards:{artboard:number;width:number;height:number;pages:number;sectionIds:string[]}[];pages:{artboard:number;boardPage:number;width:number;height:number;x:number;y:number}[];count:number;pageCount:number};
export function planSections(template:Template,workbook:Workbook,sheetName:string,sections:ArtworkSection[],options?:{proof?:boolean}):SectionPlan;
export function sectionAssignments(plan:SectionPlan):unknown[];

export function sectionRange(sheet:import("../src/lib/types").Sheet|undefined,from:string|number,to:string|number):{recordIds:string[]|null;error:string};
