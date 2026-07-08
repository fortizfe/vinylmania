#!/usr/bin/env pwsh
# Git extension: create-pr.ps1
# Push the current branch and open a pull request via the GitHub CLI (gh).
# Invoked as an optional hook after implementation (or manually at any time).
#
# Usage: create-pr.ps1 <event_name>
#   e.g.: create-pr.ps1 after_implement
param(
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$EventName = "after_implement"
)
$ErrorActionPreference = 'Stop'

function Find-ProjectRoot {
    param([string]$StartDir)
    $current = Resolve-Path $StartDir
    while ($true) {
        foreach ($marker in @('.specify', '.git')) {
            if (Test-Path (Join-Path $current $marker)) {
                return $current
            }
        }
        $parent = Split-Path $current -Parent
        if ($parent -eq $current) { return $null }
        $current = $parent
    }
}

$repoRoot = Find-ProjectRoot -StartDir $PSScriptRoot
if (-not $repoRoot) { $repoRoot = Get-Location }
Set-Location $repoRoot

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Warning "[specify] Warning: Git not found; skipped PR creation"
    exit 0
}

$savedEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    git rev-parse --is-inside-work-tree 2>$null | Out-Null
    $isRepo = $LASTEXITCODE -eq 0
} finally {
    $ErrorActionPreference = $savedEAP
}
if (-not $isRepo) {
    Write-Warning "[specify] Warning: Not a Git repository; skipped PR creation"
    exit 0
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Warning "[specify] Warning: GitHub CLI (gh) not found; skipped PR creation. Install from https://cli.github.com/"
    exit 0
}

$savedEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    gh auth status 2>$null | Out-Null
    $ghAuthed = $LASTEXITCODE -eq 0
} finally {
    $ErrorActionPreference = $savedEAP
}
if (-not $ghAuthed) {
    Write-Warning "[specify] Warning: gh is not authenticated (run 'gh auth login'); skipped PR creation"
    exit 0
}

$savedEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    git remote get-url origin 2>$null | Out-Null
    $hasOrigin = $LASTEXITCODE -eq 0
} finally {
    $ErrorActionPreference = $savedEAP
}
if (-not $hasOrigin) {
    Write-Warning "[specify] Warning: No 'origin' remote configured; skipped PR creation"
    exit 0
}

$currentBranch = git rev-parse --abbrev-ref HEAD

# Read auto_pr config (draft / base / title overrides) from git-config.yml
$configFile = Join-Path $repoRoot ".specify/extensions/git/git-config.yml"
$draft = $false
$base = ""
$title = ""

function Get-YamlScalar {
    param([string]$Raw)
    # Strip inline comment (" # ...") then surrounding quotes.
    $v = $Raw -replace '\s+#.*$', ''
    $v = $v.Trim()
    $v = $v -replace '^"(.*)"$', '$1'
    $v = $v -replace "^'(.*)'`$", '$1'
    return $v
}

if (Test-Path $configFile) {
    $inAutoPr = $false
    foreach ($line in Get-Content $configFile) {
        if ($line -match '^auto_pr:') {
            $inAutoPr = $true
            continue
        }
        if ($inAutoPr -and $line -match '^[a-z]') {
            break
        }
        if ($inAutoPr) {
            if ($line -match '^\s+draft:\s*(.+)$') {
                if ((Get-YamlScalar $matches[1]).ToLower() -eq 'true') { $draft = $true }
            }
            if ($line -match '^\s+base:\s*(.+)$') {
                $base = Get-YamlScalar $matches[1]
            }
            if ($line -match '^\s+title:\s*(.+)$') {
                $title = Get-YamlScalar $matches[1]
            }
        }
    }
}

# Resolve base branch: config override -> repo default branch -> "main"
$baseBranch = $base
if (-not $baseBranch) {
    $baseBranch = gh repo view --json defaultBranchRef -q '.defaultBranchRef.name' 2>$null
}
if (-not $baseBranch) { $baseBranch = "main" }

if ($currentBranch -eq $baseBranch) {
    Write-Warning "[specify] Warning: Current branch ('$currentBranch') is the base branch; skipped PR creation"
    exit 0
}

# Idempotency: skip if a PR already exists for this branch
$existingUrl = gh pr view $currentBranch --json url -q '.url' 2>$null
if ($existingUrl) {
    Write-Host "[specify] Pull request already exists: $existingUrl"
    exit 0
}

# Push the branch
$savedEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    $out = git push -u origin $currentBranch 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "git push failed: $out" }
} catch {
    Write-Warning "[specify] Error: $_"
    exit 1
} finally {
    $ErrorActionPreference = $savedEAP
}

# Derive title/body from feature docs when available
$featureSpec = ""
$tasksFile = ""
$featureDirRel = ""
try {
    $prereqScript = Join-Path $repoRoot ".specify/scripts/bash/check-prerequisites.sh"
    if (Test-Path (Join-Path $repoRoot ".specify/feature.json")) {
        $featureJson = Get-Content (Join-Path $repoRoot ".specify/feature.json") -Raw | ConvertFrom-Json
        if ($featureJson.feature_directory) {
            $featureDirRel = $featureJson.feature_directory
            $featureDir = Join-Path $repoRoot $featureDirRel
            $featureSpec = Join-Path $featureDir "spec.md"
            $tasksFile = Join-Path $featureDir "tasks.md"
        }
    }
} catch {
    # Feature context is best-effort; fall back to branch name below.
}

if (-not $title -and $featureSpec -and (Test-Path $featureSpec)) {
    $headingLine = Select-String -Path $featureSpec -Pattern '^#\s+' | Select-Object -First 1
    if ($headingLine) {
        $title = $headingLine.Line -replace '^#+\s*', ''
    }
}
if (-not $title) {
    $title = ($currentBranch -replace '^[0-9]+-', '') -replace '-', ' '
}

$body = "Implements ``$currentBranch``."
if ($featureSpec -and (Test-Path $featureSpec)) {
    $body += "`n`n- Spec: ``$featureDirRel/spec.md``"
}
if ($tasksFile -and (Test-Path $tasksFile)) {
    $lines = Get-Content $tasksFile
    $total = ($lines | Select-String -Pattern '^- \[[ Xx]\]').Count
    $done = ($lines | Select-String -Pattern '^- \[[Xx]\]').Count
    $body += "`n- Tasks: $done/$total completed"
}

$ghArgs = @('pr', 'create', '--base', $baseBranch, '--head', $currentBranch, '--title', $title, '--body', $body)
if ($draft) { $ghArgs += '--draft' }

$savedEAP = $ErrorActionPreference
$ErrorActionPreference = 'Continue'
try {
    $prOut = gh @ghArgs 2>&1 | Out-String
    if ($LASTEXITCODE -ne 0) { throw "gh pr create failed: $prOut" }
} catch {
    Write-Warning "[specify] Error: $_"
    exit 1
} finally {
    $ErrorActionPreference = $savedEAP
}

Write-Host "[OK] Pull request created ($EventName): $prOut"
