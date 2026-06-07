$f = 'F:\apps\realtrackapp\backend\src\channels\ebay\ebay-publish.service.ts'
$c = [System.IO.File]::ReadAllText($f)

# Fix 1: enrichPoliciesFromMarketplace - add currency from marketplace config
$old1 = @'
    if (!mpRow) {
      return {
        ...req,
        fulfillmentPolicyId:
          fulfillmentPolicyId ?? store.fulfillmentPolicyId ?? undefined,
        paymentPolicyId: paymentPolicyId ?? store.paymentPolicyId ?? undefined,
        returnPolicyId: returnPolicyId ?? store.returnPolicyId ?? undefined,
        merchantLocationKey,
      };
    }

    return {
      ...req,
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
      merchantLocationKey,
    };
'@

$new1 = @'
    const currency = this.mpConfig.require(marketplaceId).currency;

    if (!mpRow) {
      return {
        ...req,
        currency,
        fulfillmentPolicyId:
          fulfillmentPolicyId ?? store.fulfillmentPolicyId ?? undefined,
        paymentPolicyId: paymentPolicyId ?? store.paymentPolicyId ?? undefined,
        returnPolicyId: returnPolicyId ?? store.returnPolicyId ?? undefined,
        merchantLocationKey,
      };
    }

    return {
      ...req,
      currency,
      fulfillmentPolicyId,
      paymentPolicyId,
      returnPolicyId,
      merchantLocationKey,
    };
'@

$c = $c.Replace($old1, $new1)

# Fix 2: buildOffer - use currency from request instead of hardcoded 'USD'  
$old2 = @'
        price: {
          value: req.price.toFixed(2),
          currency: req.currency ?? 'USD',
        },
'@

$new2 = @'
        price: {
          value: req.price.toFixed(2),
          currency: req.currency ?? 'USD',
        },
'@
# buildOffer is fine as-is since enrich now sets currency before it's called

# Fix 3: updatePriceQuantity - use currency from request
$old3 = @'
            price: { value: o.price.toFixed(2), currency: o.currency ?? 'USD' },
'@

$new3 = @'
            price: { value: o.price.toFixed(2), currency: o.currency ?? 'USD' },
'@
# This one's fine too since it receives currency from the caller

[System.IO.File]::WriteAllText($f, $c)
Write-Host 'Done - enrichPoliciesFromMarketplace currency fix applied'