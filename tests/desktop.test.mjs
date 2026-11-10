import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {isLocalNavigation,isAdobeLink,isExportDownload,downloadName}=require('../desktop/policy.cjs');
test('desktop navigation stays on its actual local origin',()=>{
 const origin='http://127.0.0.1:41234';
 assert.equal(isLocalNavigation(origin+'/api/health',origin),true);
 for(const url of ['https://evil.example','http://127.0.0.1:4317','file:///C:/private','javascript:alert(1)'])assert.equal(isLocalNavigation(url,origin),false);
});
test('external desktop links are limited to official Adobe HTTPS pages',()=>{
 assert.equal(isAdobeLink('https://www.adobe.com/products/illustrator.html'),true);
 for(const url of ['http://www.adobe.com','https://www.adobe.com.evil.example','https://evil.example','https://user@www.adobe.com'])assert.equal(isAdobeLink(url),false);
});
test('desktop downloads only accept actual export routes and safe filenames',()=>{
 const origin='http://127.0.0.1:41234',id='12345678-1234-1234-1234-123456789abc';
 for(const route of ['ai','pdf','download'])assert.equal(isExportDownload(`${origin}/api/jobs/${id}/${route}`,origin),true);
 assert.equal(isExportDownload(origin+'/api/session',origin),false);assert.equal(isExportDownload('https://evil.example/api/jobs/'+id+'/ai',origin),false);
 assert.equal(downloadName('../../private.ai'),'private.ai');assert.equal(downloadName('C:\\folder\\result.pdf'),'result.pdf');
});
