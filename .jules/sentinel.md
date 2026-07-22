## 2024-07-22 - [CRITICAL] Unvalidated Smart Contract Treasury Account

**Vulnerability:**
The smart contract contained a critical vulnerability where the `tesoreria` (treasury) account was passed into the `comprar_bloques` instruction without address validation (`/// CHECK: Tesorería del juego` only). The frontend was similarly passing the dummy System Program ID as the treasury wallet instead of a synchronized address. This would allow an attacker to pass their own wallet address as the `tesoreria` account, effectively siphoning all user funds meant for the protocol treasury into the attacker's wallet.

**Learning:**
Any account that represents a constant destination for protocol funds (like a treasury, fee collector, or commission wallet) must have its address explicitly hardcoded and validated in the Anchor constraint macros. Relying solely on a `/// CHECK` allows arbitrary accounts to be substituted. When adding constant addresses in `anchor-lang = "0.32.1"`, the `pubkey!` macro must be used, which requires adding `solana-program = "=2.3.0"` to the dependencies.

**Prevention:**
Always use `address = pubkey!("...")` constraints for statically known protocol destination accounts within Anchor structures. Never use the System Program ID as a placeholder for wallets in frontend components. Ensure constant addresses in the frontend matches the smart contract's expected constant.
