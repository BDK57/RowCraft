import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {cn} from '@/lib/utils';
type Option={value:string;label:string;disabled?:boolean};
export function ChoiceSelect({value,onChange,options,label,placeholder,disabled,className}:{value:string;onChange:(value:string)=>void;options:Option[];label:string;placeholder?:string;disabled?:boolean;className?:string}){
 return <Select value={value||undefined} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className={cn('w-full',className)}><SelectValue placeholder={placeholder||'Choose…'}/></SelectTrigger><SelectContent position="popper" align="start" sideOffset={6} className="choice-select-menu max-h-80"><>{options.map(o=><SelectItem key={o.value} value={o.value} disabled={o.disabled}>{o.label}</SelectItem>)}</></SelectContent></Select>;
}
