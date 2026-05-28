# Setup Windows Task Scheduler — PhD-Ops Daily Run (DEPRECATED)

## Deprecation Notice (2026-05-17)

**`daily_run.bat` and Windows Task Scheduler setup are no longer active.** PhD discovery now runs inside the unified **`auto/cron.mjs`** orchestrator via pm2, which manages both job and PhD pipelines 24/7 with Telegram notifications tagged `[PHD]` and `[JOB]`.

**New setup:** See README.md "24/7 Orchestrator" section and `ecosystem.config.cjs` for pm2 configuration. Deploy with `scripts/deploy.sh`.

---

**Historical reference** (kept for archives):

## What it does
Tiap pagi jam **07:00**, otomatis jalanin:
- `discover.mjs` — scrape EURAXESS + jobs.ac.uk
- `score.mjs` — rank opportunity baru via OpenAI

Output ke `data/academic/digests/scored-YYYY-MM-DD.md`.

---

## Setup (one-time, 5 menit)

### Cara 1: Via GUI (recommended buat first time)

1. **Buka Task Scheduler**
   - Tekan `Win + R` → ketik `taskschd.msc` → Enter

2. **Create Basic Task** (di panel kanan)
   - **Name**: `PhD-Ops Daily Discovery`
   - **Description**: `Daily PhD/postdoc opportunity discovery and scoring`
   - Klik **Next**

3. **Trigger**
   - Pilih **Daily**
   - Klik **Next**
   - **Start**: hari ini, **07:00:00**
   - **Recur every**: 1 days
   - Klik **Next**

4. **Action**
   - Pilih **Start a program**
   - Klik **Next**
   - **Program/script**: `D:\Downloads\coding project\career-ops\daily_run.bat`
   - **Start in**: `D:\Downloads\coding project\career-ops`
   - Klik **Next**

5. **Finish**
   - Centang **Open the Properties dialog for this task when I click Finish**
   - Klik **Finish**

6. **Properties dialog** (penting!)
   - Tab **General**:
     - Pilih **Run whether user is logged on or not**
     - Centang **Run with highest privileges**
   - Tab **Conditions**:
     - **Uncheck** "Start the task only if the computer is on AC power" (kalo lu pakai laptop)
   - Tab **Settings**:
     - Centang **Run task as soon as possible after a scheduled start is missed**
     - Centang **If the running task does not end when requested, force it to stop**
   - Klik **OK** → minta password Windows lu → masukin

---

### Cara 2: Via PowerShell (one-liner, lebih cepat)

Buka PowerShell **as Administrator**, paste:

```powershell
$action = New-ScheduledTaskAction -Execute "D:\Downloads\coding project\career-ops\daily_run.bat" -WorkingDirectory "D:\Downloads\coding project\career-ops"
$trigger = New-ScheduledTaskTrigger -Daily -At 7:00am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId $env:UserName -RunLevel Highest -LogonType S4U
Register-ScheduledTask -TaskName "PhD-Ops Daily Discovery" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Daily PhD/postdoc opportunity discovery and scoring"
```

---

## Verify

### Cek task terdaftar:
```powershell
Get-ScheduledTask -TaskName "PhD-Ops Daily Discovery" | Get-ScheduledTaskInfo
```

### Run manual (test):
```powershell
Start-ScheduledTask -TaskName "PhD-Ops Daily Discovery"
```

Tunggu 2-3 menit, lalu cek:
```powershell
type "D:\Downloads\coding project\career-ops\logs\daily.log"
```

Harus muncul timestamp baru + "Daily run finished".

---

## Daily Workflow (after setup)

| Time | What happens | What you do |
|---|---|---|
| 07:00 | Task scheduler runs `daily_run.bat` automatically | Sleep / breakfast |
| 07:05 | Discover finishes (~2-3 min) | — |
| 07:10 | Score finishes (~3-5 min) | — |
| 08:00 | You wake up & check digest | `start data\academic\digests\scored-YYYY-MM-DD.md` |
| 09:00 | Pick top 1-3, run tailor | `node auto\tailor.mjs --min-score 70 --limit 3` |
| 10:00 | Apply | Use inspect.mjs + manual fill |

---

## Disable / Remove later

```powershell
# Disable temporary
Disable-ScheduledTask -TaskName "PhD-Ops Daily Discovery"

# Re-enable
Enable-ScheduledTask -TaskName "PhD-Ops Daily Discovery"

# Remove permanent
Unregister-ScheduledTask -TaskName "PhD-Ops Daily Discovery" -Confirm:$false
```

---

## Troubleshooting

**Task ran but no output?**
- Check `logs\daily.log` — apakah ada error?
- Check `logs\discover.log` dan `logs\score.log` — apakah Playwright bisa launch headless?
- Pastikan `.env` file punya `OPENAI_API_KEY`

**Task gak jalan otomatis?**
- Buka Task Scheduler GUI, klik kanan task → **Run** (manual trigger)
- Cek **History** tab di task properties — ada error code?
- Pastikan komputer **menyala** jam 7 AM (atau ganti jadwal ke jam lain)

**Mau ganti jadwal?**
- Buka Task Scheduler GUI → klik task → **Properties** → tab **Triggers** → Edit → ubah time → OK
