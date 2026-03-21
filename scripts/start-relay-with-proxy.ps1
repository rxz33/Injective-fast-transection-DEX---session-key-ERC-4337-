# PowerShell script to start RPC Proxy and Relay
# Replicates the behavior of scripts/start-relay-with-proxy.sh on Windows

$ErrorActionPreference = "Stop"

# Get root directory (one level up from this script's directory)
$RootDir = Get-Item -Path "$PSScriptRoot\.." | Select-Object -ExpandProperty FullName
Set-Location -Path $RootDir

Write-Host "[relay-stack-win] Killing existing processes on ports 8547 and 8787"
# Attempt to find PIDs listening on 8547 and 8787
$ProcessesToKill = @()
try {
    $NetStatOutput = netstat -ano | Select-String ":8547", ":8787"
    foreach ($line in $NetStatOutput) {
        if ($line -match "LISTENING\s+(\d+)") {
            $ProcessesToKill += $matches[1]
        }
    }
} catch {
    # Ignore netstat errors
}

foreach ($pidToKill in ($ProcessesToKill | Select-Object -Unique)) {
    try {
        Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
        Write-Host "Killed process with PID $pidToKill"
    } catch {
        # Ignore individual stop failures
    }
}

Write-Host "[relay-stack-win] Starting rpc-proxy in background..."
# Start the proxy in the background and capture its job
$ProxyJob = Start-Job -ScriptBlock {
    param($Dir)
    Set-Location -Path $Dir
    npm run rpc-proxy
} -ArgumentList $RootDir

# Wait for proxy to boot
Write-Host "Waiting 3 seconds for proxy..."
Start-Sleep -Seconds 3

# Display some proxy output if available yet
$ProxyOutput = Receive-Job -Job $ProxyJob
if ($ProxyOutput) { Write-Host $ProxyOutput }

Write-Host "[relay-stack-win] Starting relay in foreground..."
try {
    # This will use the cross-env command we just added to package.json
    npm run relay
} finally {
    Write-Host "[relay-stack-win] Cleaning up rpc-proxy..."
    Stop-Job -Job $ProxyJob -ErrorAction SilentlyContinue
    # Also attempt to find the node process specifically if the job didn't clean it well
    $NetStatAfter = netstat -ano | Select-String ":8547"
    foreach ($line in $NetStatAfter) {
        if ($line -match "LISTENING\s+(\d+)") {
            Stop-Process -Id $matches[1] -Force -ErrorAction SilentlyContinue
        }
    }
    Write-Host "[relay-stack-win] Cleanup complete."
}
