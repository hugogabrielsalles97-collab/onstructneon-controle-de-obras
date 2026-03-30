$files = Get-ChildItem -Path "components\*.tsx"

foreach ($file in $files) {
    if ($file.Name -in "Sidebar.tsx", "Header.tsx", "MonitoringControlPage.tsx") { continue }
    
    $content = Get-Content -Raw $file.FullName
    $modified = $false

    # 1. Interface Optional Prop
    if ($content -match "onNavigateToLeanConstruction\?: \(\) => void;") {
        if ($content -notmatch "onNavigateToMonitoringControl\?: \(\) => void;") {
            $content = $content -replace "onNavigateToLeanConstruction\?: \(\) => void;", "onNavigateToLeanConstruction?: () => void;`n  onNavigateToMonitoringControl?: () => void;"
            $modified = $true
        }
    }
    
    # 2. Interface Required Prop
    if ($content -match "onNavigateToLeanConstruction: \(\) => void;") {
        if ($content -notmatch "onNavigateToMonitoringControl(\?)?: \(\) => void;") {
            $content = $content -replace "onNavigateToLeanConstruction: \(\) => void;", "onNavigateToLeanConstruction: () => void;`n  onNavigateToMonitoringControl?: () => void;"
            $modified = $true
        }
    }

    # 3. Component destructuring parameter
    if ($content -match "onNavigateToLeanConstruction,") {
        if ($content -notmatch "onNavigateToMonitoringControl,") {
            $content = $content -replace "onNavigateToLeanConstruction,", "onNavigateToLeanConstruction, onNavigateToMonitoringControl,"
            $modified = $true
        }
    }
    
    # 4. Sidebar / Header Prop passing
    if ($content -match "onNavigateToLeanConstruction=\{onNavigateToLeanConstruction\}") {
        if ($content -notmatch "onNavigateToMonitoringControl=\{onNavigateToMonitoringControl\}") {
            $content = $content -replace "onNavigateToLeanConstruction=\{onNavigateToLeanConstruction\}", "onNavigateToLeanConstruction={onNavigateToLeanConstruction}`n                onNavigateToMonitoringControl={onNavigateToMonitoringControl}"
            $modified = $true
        }
    }
    
    # Header inline object fallback (if Header or Sidebar gets it in some weird way)
    if ($content -match "onNavigateToLeanConstruction=\{\(\) => \{\}\}") {
         if ($content -notmatch "onNavigateToMonitoringControl=\{(\(\))?") {
            $content = $content -replace "onNavigateToLeanConstruction=\{\(\) => \{\}\}", "onNavigateToLeanConstruction={() => {}}`n                onNavigateToMonitoringControl={() => {}}"
            $modified = $true
        }
    }

    if ($modified) {
        Set-Content -Path $file.FullName -Value $content
        Write-Host "Updated $($file.Name)"
    }
}
