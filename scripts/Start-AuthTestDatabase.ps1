param(
    [string]$MongodPath = 'C:\Program Files\MongoDB\Server\8.3\bin\mongod.exe',
    [string]$StatePath = (Join-Path ([IO.Path]::GetTempPath()) 'campus-auth-test-state.json')
)
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $StatePath) { throw 'Test state already exists. Stop the prior test instance before starting another.' }
if (-not (Test-Path -LiteralPath $MongodPath)) { throw 'Pass -MongodPath with the installed mongod.exe path.' }
$probe = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 27018)
try { $probe.Start() } finally { $probe.Stop() }
$dataDirectory = Join-Path ([IO.Path]::GetTempPath()) ('campus-auth-test-' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $dataDirectory | Out-Null
Set-Content -LiteralPath (Join-Path $dataDirectory '.auth-test-owned') -Value 'Temporary authentication tests only'
$logPath = Join-Path $dataDirectory 'mongod.log'
$arguments = @('--dbpath', ('"{0}"' -f $dataDirectory), '--port', '27018', '--bind_ip', '127.0.0.1', '--logpath', ('"{0}"' -f $logPath), '--wiredTigerCacheSizeGB', '0.25')
$process = Start-Process -FilePath $MongodPath -ArgumentList $arguments -WindowStyle Hidden -PassThru
$key = New-Object byte[] 32
$random = [Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($key)
$random.Dispose()
$envFile = Join-Path $dataDirectory 'auth-test.env'
[IO.File]::WriteAllText($envFile, ('AUTH_TEST_JWT_SECRET=' + [Convert]::ToBase64String($key) + "`nAUTH_TEST_MONGODB_URI=mongodb://host.docker.internal:27018/lost_found_db`n"))
$state = [pscustomobject]@{ ProcessId = $process.Id; DataDirectory = $dataDirectory; EnvFile = $envFile }
$state | ConvertTo-Json | Set-Content -LiteralPath $StatePath -Encoding UTF8
for ($attempt = 0; $attempt -lt 60; $attempt++) {
    $process.Refresh()
    if ($process.HasExited) { throw "Temporary mongod exited. Inspect $logPath" }
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $connection = $client.ConnectAsync('127.0.0.1', 27018)
        if ($connection.Wait(250) -and $client.Connected) { $state; return }
    } catch {} finally { $client.Dispose() }
    Start-Sleep -Milliseconds 250
}
throw 'Temporary MongoDB did not become ready; inspect the test log and stop it using the state file.'
