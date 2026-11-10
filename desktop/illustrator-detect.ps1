# Read-only prerequisite check. A copied EXE without COM registration is insufficient.
$ErrorActionPreference = 'Stop'
$found = $null
foreach ($view in @([Microsoft.Win32.RegistryView]::Registry64, [Microsoft.Win32.RegistryView]::Registry32)) {
    $classes = $null
    $classKey = $null
    $serverKey = $null
    try {
        $classes = [Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::ClassesRoot, $view)
        $classKey = $classes.OpenSubKey('Illustrator.Application\CLSID')
        if ($null -eq $classKey) { continue }
        $clsid = [string]$classKey.GetValue('')
        $serverKey = $classes.OpenSubKey("CLSID\$clsid\LocalServer32")
        if ($null -eq $serverKey) { continue }
        $command = [Environment]::ExpandEnvironmentVariables([string]$serverKey.GetValue(''))
        # Adobe registers both quoted paths and unquoted paths ending with /Automation.
        $match = [regex]::Match($command, '^\s*"?(.+?\.exe)(?:"|\s|$)', 'IgnoreCase')
        if ($match.Success -and (Test-Path -LiteralPath $match.Groups[1].Value -PathType Leaf)) {
            $found = @{ installed = $true; executable = $match.Groups[1].Value }
            break
        }
    } catch { } finally {
        if ($serverKey) { $serverKey.Dispose() }
        if ($classKey) { $classKey.Dispose() }
        if ($classes) { $classes.Dispose() }
    }
}
if ($found) { $found | ConvertTo-Json -Compress; exit 0 }
@{ installed = $false; message = 'Adobe Illustrator is not installed or its automation registration is missing. Install or repair Illustrator through Adobe Creative Cloud, then check again.' } | ConvertTo-Json -Compress
exit 3
