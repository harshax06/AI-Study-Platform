# PowerShell script to clear the database
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/admin/clear-database" -Method Delete
    Write-Host "✅ Database cleared successfully!" -ForegroundColor Green
    Write-Host "`nDeleted records:" -ForegroundColor Cyan
    Write-Host "  - Users: $($response.deletedCounts.users)" -ForegroundColor Yellow
    Write-Host "  - Tasks: $($response.deletedCounts.tasks)" -ForegroundColor Yellow
    Write-Host "  - Scores: $($response.deletedCounts.scores)" -ForegroundColor Yellow
    Write-Host "  - Notifications: $($response.deletedCounts.notifications)" -ForegroundColor Yellow
} catch {
    Write-Host "❌ Error clearing database: $_" -ForegroundColor Red
}
