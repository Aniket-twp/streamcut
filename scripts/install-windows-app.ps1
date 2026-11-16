# Install StreamCut as a Native Windows 11 Desktop Application

$appName = "StreamCut"
$targetUrl = "http://localhost:5173"
$iconPath = Join-Path $PSScriptRoot "..\public\icon-512.png"
$icoPath = Join-Path $PSScriptRoot "..\public\favicon.ico"

# Find Edge or Chrome to run in native App Window mode
$browserPath = ""
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$chromePathUser = "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"

if (Test-Path $edgePath) {
    $browserPath = $edgePath
} elseif (Test-Path $chromePath) {
    $browserPath = $chromePath
} elseif (Test-Path $chromePathUser) {
    $browserPath = $chromePathUser
}

if (-not $browserPath) {
    Write-Error "No compatible browser found to host the native app window."
    exit 1
}

$desktopPath = [System.Environment]::GetFolderPath('Desktop')
$startMenuPath = [System.Environment]::GetFolderPath('Programs')

$wscript = New-Object -ComObject WScript.Shell

function Create-Shortcut {
    param([string]$DestinationFile)
    $shortcut = $wscript.CreateShortcut($DestinationFile)
    $shortcut.TargetPath = $browserPath
    $shortcut.Arguments = "--app=$targetUrl --user-data-dir=`"$env:LOCALAPPDATA\StreamCutApp`""
    $shortcut.Description = "StreamCut — AI Stream Clipper (Windows 11 Native App)"
    if (Test-Path $icoPath) {
        $shortcut.IconLocation = $icoPath
    }
    $shortcut.Save()
    Write-Host "Created shortcut: $DestinationFile"
}

# Create desktop shortcut
Create-Shortcut -DestinationFile (Join-Path $desktopPath "$appName.lnk")

# Create Start Menu shortcut
Create-Shortcut -DestinationFile (Join-Path $startMenuPath "$appName.lnk")

Write-Host "StreamCut successfully installed as a native Windows 11 desktop app!"
