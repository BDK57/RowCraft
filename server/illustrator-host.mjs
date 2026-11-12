import path from 'node:path';

export function supportsIllustrator(platform = process.platform) {
  return platform === 'win32' || platform === 'darwin';
}

// Paths are arguments/environment values, never interpolated into script code.
export const macConnectionScript = 'tell application id "com.adobe.illustrator" to get version as text';
export const macDetectionScript = `ObjC.import('AppKit');
var url = $.NSWorkspace.sharedWorkspace.URLForApplicationWithBundleIdentifier('com.adobe.illustrator');
if (!url || url.isNil()) throw new Error('Adobe Illustrator was not found. Install it through Adobe Creative Cloud.');
JSON.stringify({installed:true,path:ObjC.unwrap(url.path)});`;

const macWorkerScript = `on run argv
  set scriptFile to POSIX file (item 1 of argv)
  with timeout of 86400 seconds
    tell application id "com.adobe.illustrator"
      do javascript scriptFile
    end tell
  end timeout
  return ""
end run`;

export function illustratorInvocation(script, {platform = process.platform, env = process.env} = {}) {
  if (!supportsIllustrator(platform)) throw Error('Native artwork generation requires Windows or macOS with Adobe Illustrator installed.');
  if (platform === 'darwin') return {command:'/usr/bin/osascript',args:['-e',macWorkerScript,'--',script],options:{env}};
  const command = path.win32.join(env.SystemRoot || 'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
  const source = "$ErrorActionPreference='Stop'; try { $illustrator=New-Object -ComObject Illustrator.Application; $null=$illustrator.DoJavaScriptFile($env:COVER_STUDIO_SCRIPT) } catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }";
  return {command,args:['-NoLogo','-NoProfile','-NonInteractive','-Command',source],options:{env:{...env,COVER_STUDIO_SCRIPT:script}}};
}

export function illustratorHostError(message, platform = process.platform) {
  if (platform === 'darwin' && /-1743|not authorized to send apple events|not permitted to send apple events/i.test(message)) {
    return 'macOS has not allowed Illustrator automation. In System Settings → Privacy & Security → Automation, allow RowCraft to control Adobe Illustrator, then retry. When running from source, the requesting app may be Terminal or Electron.';
  }
  return message;
}
