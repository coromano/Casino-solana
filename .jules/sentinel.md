
## 2024-05-18 - [Fix Fake Treasury Account Vulnerability in ComprarBloque]
**Vulnerability:** A fake account vulnerability existed in the `ComprarBloque` instruction of the Anchor program where the `tesoreria` account was missing validation. An attacker could substitute their own wallet to receive SOL intended for the game's treasury.
**Learning:** In Solana/Anchor, any account passed via `AccountInfo` without specific constraints is an open door for users to inject arbitrary accounts. This is dangerous when transferring native SOL out of a user account.
**Prevention:** Always enforce constraints on accounts that receive funds. In Anchor, use the `address = ...` constraint to verify that an account matches a specific expected pubkey (e.g., `address = TESORERIA_WALLET`).
