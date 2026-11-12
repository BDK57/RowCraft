import {test} from 'node:test';
import assert from 'node:assert/strict';
import {illustratorInvocation,illustratorHostError,supportsIllustrator} from '../server/illustrator-host.mjs';

test('Windows worker keeps COM and passes JSX paths through the environment',()=>{
  const script='C:\\User files\\Has "quotes"\\worker.jsx',env={SystemRoot:'D:\\Windows',PRESERVED:'yes'};
  const invocation=illustratorInvocation(script,{platform:'win32',env});
  assert.equal(invocation.command,'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
  assert.match(invocation.args.at(-1),/New-Object -ComObject Illustrator.Application/);
  assert.match(invocation.args.at(-1),/DoJavaScriptFile\(\$env:COVER_STUDIO_SCRIPT\)/);
  assert.equal(invocation.options.env.COVER_STUDIO_SCRIPT,script);
  assert.equal(invocation.options.env.PRESERVED,'yes');assert.equal(env.COVER_STUDIO_SCRIPT,undefined);
  assert.equal(invocation.args.some(arg=>arg.includes(script)),false);
});

test('macOS worker passes paths as an argument without shell or AppleScript interpolation',()=>{
  const script='/Users/Ali/Images "special"/$(touch nope)/worker.jsx';
  const invocation=illustratorInvocation(script,{platform:'darwin',env:{KEEP:'yes'}});
  assert.equal(invocation.command,'/usr/bin/osascript');
  assert.equal(invocation.args.at(-1),script);assert.equal(invocation.args.at(-2),'--');
  assert.match(invocation.args[1],/POSIX file \(item 1 of argv\)/);
  assert.match(invocation.args[1],/do javascript scriptFile/);
  assert.match(invocation.args[1],/com.adobe.illustrator/);
  assert.equal(invocation.args[1].includes(script),false);
  assert.equal(invocation.options.env.KEEP,'yes');
});

test('unsupported platforms fail clearly and macOS denied automation gives actionable guidance',()=>{
  assert.equal(supportsIllustrator('win32'),true);assert.equal(supportsIllustrator('darwin'),true);assert.equal(supportsIllustrator('linux'),false);
  assert.throws(()=>illustratorInvocation('/worker.jsx',{platform:'linux'}),/Windows or macOS/);
  assert.match(illustratorHostError('Not authorized to send Apple events (-1743)','darwin'),/Privacy & Security → Automation/);
  assert.equal(illustratorHostError('Missing font','darwin'),'Missing font');
  assert.equal(illustratorHostError('COM error','win32'),'COM error');
});
