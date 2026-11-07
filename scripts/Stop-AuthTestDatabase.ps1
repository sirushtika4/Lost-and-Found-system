param([string]$StatePath = (Join-Path ([IO.Path]::GetTempPath()) 'campus-auth-test-state.json'))
$ErrorActionPreference = 'Stop'
$state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
$target = [IO.Path]::GetFullPath($state.DataDirectory)
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\') + '\'
if (-not $target.StartsWith($tempRoot, [StringComparison]::OrdinalIgnoreCase) -or (Split-Path $target -Leaf) -notmatch '^campus-auth-test-[a-f0-9-]{36}$' -or -not (Test-Path -LiteralPath (Join-Path $target '.auth-test-owned'))) {
    throw 'Refusing cleanup: target is not the marked temporary test directory.'
}
$process = Get-CimInstance Win32_Process -Filter "ProcessId=$($state.ProcessId)"
if ($process) {
    if ($process.Name -ne 'mongod.exe' -or -not $process.CommandLine.Contains($target) -or $process.CommandLine -notmatch '--port\s+27018') { throw 'Refusing to stop an unrelated process.' }
    # A successful shutdown can close the shell connection with ECONNRESET.
    try { & mongosh --quiet 'mongodb://127.0.0.1:27018/admin?serverSelectionTimeoutMS=3000' --eval 'db.shutdownServer()' 2>&1 | Out-Null } catch {}
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if (-not (Get-Process -Id $state.ProcessId -ErrorAction SilentlyContinue)) { break }
        Start-Sleep -Milliseconds 250
    }
    if (Get-Process -Id $state.ProcessId -ErrorAction SilentlyContinue) { throw 'Test process is still running; refusing data cleanup.' }
}
# Both resolved path and ownership marker are verified before recursive removal.
Remove-Item -LiteralPath $target -Recurse -Force
Remove-Item -LiteralPath $StatePath
Write-Output 'Stopped and removed only the marked temporary authentication database.'
