## 2024-07-19 - Missing Treasury Account Validation
**Vulnerability:** The Anchor smart contract failed to validate the address of the constant destination for protocol funds (the tesoreria / treasury account). An attacker could supply an arbitrary account as the destination, siphoning the funds from blocks purchases.
**Learning:** In Solana/Anchor, an account constraint like `#[account(mut)]` is not sufficient for accounts meant to act as fixed fee destinations, because it only means the account can be mutated. It does not ensure the account is the actual desired account.
**Prevention:** Use an `address` constraint with a constant Pubkey (using the `pubkey!` macro) on accounts representing constant destinations for protocol funds.
