param(
  [string]$Condition = 'FOR_PARTS_OR_NOT_WORKING'
)

$login = Invoke-RestMethod -Uri 'http://localhost:4191/api/auth/login' -Method POST -ContentType 'application/json' -Body '{"email":"admin@realtrack.local","password":"ChangeMe123!"}'
$headers = @{ Authorization = "Bearer $($login.accessToken)" }

$body = @{
  listingId = '465db00a-e2ad-43ff-824d-cb5e74cb85f2'
  storeIds = @('aae79700-d256-4791-91a6-61b881a32fc8')
  sku = 'BLA-00644'
  title = '2006-2013 Mercedes-Benz R350 Rear Side Window Glass E000251'
  description = 'Used Mercedes R350 rear side window glass. Part number E000251. See photos for condition.'
  categoryId = '33684'
  condition = $Condition
  conditionDescription = 'Used rear side window glass from donor vehicle'
  price = 90
  currency = 'USD'
  quantity = 1
  imageUrls = @(
    'https://solarrisebackupbucket.s3.amazonaws.com/mhn/catalog-images/c61dfa85-c281-4bef-8a9c-912a140455c0/BLA-00644/000.jpg',
    'https://solarrisebackupbucket.s3.amazonaws.com/mhn/catalog-images/c61dfa85-c281-4bef-8a9c-912a140455c0/BLA-00644/001.jpg',
    'https://solarrisebackupbucket.s3.amazonaws.com/mhn/catalog-images/c61dfa85-c281-4bef-8a9c-912a140455c0/BLA-00644/002.jpg',
    'https://solarrisebackupbucket.s3.amazonaws.com/mhn/catalog-images/c61dfa85-c281-4bef-8a9c-912a140455c0/BLA-00644/003.jpg',
    'https://solarrisebackupbucket.s3.amazonaws.com/mhn/catalog-images/c61dfa85-c281-4bef-8a9c-912a140455c0/BLA-00644/004.jpg',
    'https://solarrisebackupbucket.s3.amazonaws.com/mhn/catalog-images/c61dfa85-c281-4bef-8a9c-912a140455c0/BLA-00644/005.jpg',
    'https://solarrisebackupbucket.s3.amazonaws.com/mhn/catalog-images/c61dfa85-c281-4bef-8a9c-912a140455c0/BLA-00644/006.jpg'
  )
  aspects = @{
    Brand = @('MERCEDES')
    'Manufacturer Part Number' = @('E000251')
    Type = @('Rear Side Window Glass')
  }
  fulfillmentPolicyId = '410665908022'
  paymentPolicyId = '410665874022'
  returnPolicyId = '410665876022'
  listingFormat = 'FIXED_PRICE'
  listingDuration = 'GTC'
} | ConvertTo-Json -Depth 6

Write-Host "Testing condition: $Condition"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  $result = Invoke-RestMethod -Uri 'http://localhost:4191/api/channels/ebay/publish' -Method POST -ContentType 'application/json' -Headers $headers -Body $body -TimeoutSec 120
  $sw.Stop()
  Write-Host "Elapsed: $($sw.Elapsed.TotalSeconds)s"
  $result | ConvertTo-Json -Depth 6
} catch {
  $sw.Stop()
  Write-Host "Elapsed: $($sw.Elapsed.TotalSeconds)s"
  Write-Host $_.Exception.Message
  if ($_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
}
