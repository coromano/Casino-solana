## 2025-08-07 - Add proper treasury address check

**Vulnerability:**
The Anchor smart contract's `comprar_bloques` function lacked a hardcoded validation on the `tesoreria` account. It allowed users to pass in any account, potentially draining the funds to any arbitrary user. There was no explicit checking for `tesoreria`'s address.

**Learning:**
I must validate the target account's address when doing native sol transfer from user to contract, to ensure the funds go to the expected destination.

**Prevention:**
Validate the address by using `#[account(mut, address = TESORERIA_PUBKEY)]` instead of `/// CHECK: Tesorería del juego\n#[account(mut)]` to prevent unauthorized destinations from receiving funds.
