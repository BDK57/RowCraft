import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const {build}=createRequire(import.meta.resolve('vite'))('esbuild');
// DOM must exist before React/Base UI dependencies are imported by the bundle.
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','HTMLElement','Element','Node','Event','MouseEvent','MutationObserver','getComputedStyle'])Object.defineProperty(globalThis,key,{configurable:true,value:key==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
window.matchMedia=()=>({matches:process.env.ROWCRAFT_UI_REDUCED_MOTION==='1',addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});
globalThis.requestAnimationFrame=callback=>setTimeout(()=>callback(performance.now()),0);globalThis.cancelAnimationFrame=clearTimeout;
globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
const folder=path.resolve('.local','ui-test-'+crypto.randomUUID());await fs.mkdir(folder,{recursive:true});
try{
 const output=path.join(folder,'workflow.mjs');
 await build({entryPoints:['tests/fixtures/workflow-ui.tsx'],outfile:output,bundle:true,platform:'node',format:'esm',packages:'external',alias:{'@':path.resolve('src')},jsx:'automatic',logLevel:'silent'});
 await import(pathToFileURL(output).href);
}finally{assert.equal(path.dirname(folder),path.resolve('.local'));await fs.rm(folder,{recursive:true,force:true});}
