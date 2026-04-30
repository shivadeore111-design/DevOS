const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

// Exactly as in core/tools/nowPlaying.ts
const PS_SCRIPT = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
function Await($WinRtTask, $ResultType) {
    $m = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and
        $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'
    })[0]
    $m = $m.MakeGenericMethod($ResultType)
    $t = $m.Invoke($null, @($WinRtTask))
    $t.Wait(-1) | Out-Null
    $t.Result
}
$mgType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]
$mgr = Await ($mgType::RequestAsync()) $mgType
$s = $mgr.GetCurrentSession()
if ($s) {
    $pType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties,Windows.Media.Control,ContentType=WindowsRuntime]
    $p = Await ($s.TryGetMediaPropertiesAsync()) $pType
    $pb = $s.GetPlaybackInfo()
    @{ app=$s.SourceAppUserModelId; title=$p.Title; artist=$p.Artist; album=$p.AlbumTitle; isPlaying=($pb.PlaybackStatus -eq 'Playing'); playbackStatus=$pb.PlaybackStatus.ToString() } | ConvertTo-Json -Compress
} else {
    '{"isPlaying":false,"message":"No media session active"}'
}
`.trim()

async function test() {
  try {
    const { stdout, stderr } = await execAsync(PS_SCRIPT, {
      shell: 'powershell.exe',
      timeout: 5000,
    })
    console.log('STDOUT:', stdout.trim())
    if (stderr) console.log('STDERR:', stderr.trim())
  } catch (e) {
    console.log('ERROR:', e.message)
    console.log('STDOUT:', e.stdout)
    console.log('STDERR:', e.stderr)
  }
}

test()
