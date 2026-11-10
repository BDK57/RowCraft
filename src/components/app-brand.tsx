import {cn} from '@/lib/utils';

/** The header and navigation use the same artwork as the browser favicon. */
export function AppBrand({compact=false,className}:{compact?:boolean;className?:string}) {
 return <div className={cn('app-brand',className)}>
  <img src="/cover-studio.svg?v=rowcraft" alt="" width={40} height={40} aria-hidden="true"/>
  <div><span>RowCraft</span>{!compact&&<p>Excel to print-ready artwork</p>}</div>
 </div>;
}
