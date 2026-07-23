
## 2024-05-18 - Missing Address Constraint on Treasury/System Accounts
**Vulnerability:** Arbitrary Destination Address. A smart contract allowed users to specify the `tesoreria` account in `ComprarBloque` struct without validating if the provided address was the intended treasury key.
**Learning:** This is a critical security vulnerability because an attacker could provide an arbitrary account they control (or even the system program itself in certain contexts if unchecked) instead of the actual treasury wallet, siphoning funds meant for the protocol.
**Prevention:** In Solana Anchor smart contracts, accounts representing constant destinations for protocol funds (like treasuries or commission wallets) must explicitly validate their address using an `address` constraint (e.g., `#[account(address = pubkey!("..."))]`) to prevent attackers from supplying arbitrary accounts and siphoning funds. Avoid using the Solana System Program ID or dummy values as placeholders in production.
