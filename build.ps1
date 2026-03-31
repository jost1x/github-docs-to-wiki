param(
    [switch]$UpgradePackages
)

if ($UpgradePackages) {
    & npm upgrade "@actions/core"
    & npm upgrade "@actions/exec"
}

& npm run build
